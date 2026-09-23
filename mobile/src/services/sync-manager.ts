import type { QueryClient } from '@tanstack/react-query';
import client from '@/api/client';
import type { OfflineQueueItem, SyncProgress } from '@/types/offline.types';
import {
  OFFLINE_MAX_RETRIES,
  isFinancialCriticalOperation,
} from '@/types/offline.types';
import {
  getPendingItems,
  getFailedItems,
  getExpiredItems,
  updateQueueItem,
  removeFromQueue,
  findDuplicate,
  getQueueStats,
  getQueueItemsReferencingTempId,
  getQueue,
  restoreSnapshot,
} from '@/db/offline-queue-db';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { db } from '@/db';
import { offlineQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { upsertClientes, deleteCliente } from '@/db/clientes-db';
import { upsertPrestamos, deletePrestamo } from '@/db/prestamos-db';
import { upsertPagos, deletePago } from '@/db/pagos-db';
import { saveCajaActiva } from '@/db/caja-db';
import { reconciliarPrestamoLocal } from '@/services/data-sync';
import type { Pago } from '@/types/prestamo.types';
import { useAuthStore } from '@/store/auth.store';

type ProgressListener = (progress: SyncProgress) => void;
type CompletionListener = (result: {
  synced: number;
  failed: number;
  errors: string[];
}) => void;

const progressListeners = new Set<ProgressListener>();
const completionListeners = new Set<CompletionListener>();

/**
 * Evento por transición de estado de un item de la cola. Se usa para que la
 * pantalla de sincronización refleje en vivo el avance uno-a-uno (pending →
 * syncing → synced/failed), en lugar de esperar a que termine todo el sync.
 */
export interface SyncItemEvent {
  id: string;
  status: 'syncing' | 'synced' | 'failed';
}

const itemEventListeners = new Set<(event: SyncItemEvent) => void>();

export function onSyncProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

export function onSyncComplete(listener: CompletionListener): () => void {
  completionListeners.add(listener);
  return () => completionListeners.delete(listener);
}

export function onSyncItemEvent(listener: (event: SyncItemEvent) => void): () => void {
  itemEventListeners.add(listener);
  return () => itemEventListeners.delete(listener);
}

function emitProgress(progress: SyncProgress) {
  progressListeners.forEach((l) => l(progress));
}

function emitCompletion(result: { synced: number; failed: number; errors: string[] }) {
  completionListeners.forEach((l) => l(result));
}

function emitItemEvent(event: SyncItemEvent) {
  itemEventListeners.forEach((l) => l(event));
}

let syncing = false;

export function isSyncing(): boolean {
  return syncing;
}

function isNetworkError(error: any): boolean {
  return (
    !error?.statusCode ||
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'ECONNABORTED' ||
    error?.message?.includes('Network Error')
  );
}

function isRetryableError(error: any): boolean {
  if (isNetworkError(error)) return true;
  const status = error?.statusCode;
  if (!status) return true;
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

// `setQueryData` sin la opción `updatedAt` sella la query con
// `dataUpdatedAt: Date.now()` y limpia `isInvalidated`, incluso si el updater
// devuelve los mismos datos. Eso dejaba queries como el detalle del préstamo o
// la caja (cuyos datos no contienen el `tempId`) marcadas como frescas y sin
// refetch tras el sync. Este helper solo escribe cuando hay un cambio real.
function setQueryDataIfChanged(
  queryClient: QueryClient | undefined,
  queryKey: readonly unknown[],
  updater: (old: any) => any,
): void {
  if (!queryClient) return;
  const old = queryClient.getQueryData(queryKey);
  if (old === undefined) return;
  const next = updater(old);
  if (next !== old) {
    queryClient.setQueryData(queryKey, next);
  }
}

function replaceTempIdInData(obj: any, oldId: string, newId: string): void {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      replaceTempIdInData(item, oldId, newId);
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (obj[key] === oldId) {
        obj[key] = newId;
      } else if (typeof obj[key] === 'object') {
        replaceTempIdInData(obj[key], oldId, newId);
      }
    }
  }
}

function getErrorMessage(error: any): string {
  const status = error?.statusCode;
  if (status === 409) return 'Conflicto con datos existentes';
  if (status === 422) return 'Error de validación del servidor';
  if (status === 401 || status === 403) return 'Sesión expirada';
  if (status && status >= 500) return 'Error temporal del servidor';
  return error?.message || 'Error desconocido';
}

function isIdempotencyConflict(error: any): boolean {
  // Con el nuevo backend:
  // - Replay legítimo devuelve 200 OK → nunca llega al catch
  // - Colisión real devuelve 409 con code: "IDEMPOTENCY_KEY_COLLISION"
  // No hay caso donde un error 409 signifique "ya procesado".
  // Esta función se mantiene por compatibilidad pero siempre retorna false.
  return false;
}

function isIdempotencyKeyCollision(error: any): boolean {
  const status = error?.statusCode;
  if (status !== 409) return false;
  const code = error?.code;
  return code === 'IDEMPOTENCY_KEY_COLLISION';
}

// Deriva el préstamo afectado por un item de la cola para poder reconciliar su
// estado local tras un sync exitoso. Soporta pagos, saldo total y todas las
// mutaciones de préstamo (/prestamos/:id, /estado, /desembolsar, /cancelar,
// /refinanciar). La creación (POST /prestamos) no aplica: no tiene id aún.
function derivarPrestamoId(item: OfflineQueueItem): string | null {
  const endpoint = item.endpoint;

  const saldarMatch = endpoint.match(/^\/pagos\/saldar\/([^/]+)/);
  if (saldarMatch) return saldarMatch[1];

  if (endpoint === '/pagos' && item.method === 'POST') {
    let data: any = item.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return null;
      }
    }
    return data?.prestamoId ?? null;
  }

  const prestamoMatch = endpoint.match(/^\/prestamos\/([^/]+)/);
  if (prestamoMatch) return prestamoMatch[1];

  return null;
}

// ids de entidades con mutaciones locales aún no confirmadas en el servidor
// (status pending/syncing). El pull (prefetch) las excluye de su upsert a
// SQLite para no pisar datos locales recién encolados con un snapshot del
// servidor que todavía no incluye esas operaciones.
export function getEntitiesWithPendingMutations(): {
  prestamos: Set<string>;
  clientes: Set<string>;
} {
  const prestamos = new Set<string>();
  const clientes = new Set<string>();

  for (const item of getQueue()) {
    if (item.status === 'failed') continue;

    const prestamoId = derivarPrestamoId(item);
    if (prestamoId) prestamos.add(prestamoId);

    const clienteMatch = item.endpoint.match(/^\/clientes\/([^/]+)/);
    if (clienteMatch) {
      clientes.add(clienteMatch[1]);
    } else if (item.endpoint === '/clientes' && item.tempId) {
      clientes.add(item.tempId);
    }
  }

  return { prestamos, clientes };
}

export async function processItem(
  item: OfflineQueueItem,
  queryClient?: QueryClient,
): Promise<boolean> {
  try {
    const existing = await findDuplicate(item.endpoint, item.method, item.data);
    if (existing && existing.id !== item.id) {
      await removeFromQueue(item.id);
      if (__DEV__) {
        console.log(`[Sync] Duplicate detected for ${item.endpoint}, removing item ${item.id}`);
      }
      return true;
    }

    await updateQueueItem(item.id, { status: 'syncing' });
    emitItemEvent({ id: item.id, status: 'syncing' });

    let body = item.method !== 'DELETE' ? item.data : undefined;
    if (
      body !== undefined &&
      item.idempotencyKey &&
      item.endpoint.startsWith('/pagos')
    ) {
      const parsed = typeof body === 'string' ? JSON.parse(body) : { ...body };
      body = { ...parsed, idempotencyKey: item.idempotencyKey };
    }

    // Upload de cédula offline: el endpoint exige multipart/form-data, no JSON.
    // Se reconstruye el FormData igual que uploadCedula() online (file + tipo).
    if (item.method === 'POST' && /^\/clientes\/[^/]+\/cedula$/.test(item.endpoint)) {
      const parsed =
        typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      const uri = parsed?.uri as string | undefined;
      const tipo = parsed?.tipo as 'cedula-frontal' | 'cedula-trasera' | undefined;
      if (uri && tipo) {
        const formData = new FormData();
        formData.append('file', {
          uri,
          type: 'image/jpeg',
          name: `${tipo}.jpg`,
        } as any);
        formData.append('tipo', tipo);
        body = formData;
      }
    }

    const response = await client({
      method: item.method,
      url: item.endpoint,
      data: body,
      params: item.method === 'DELETE' ? item.data : undefined,
      timeout: 15000,
      headers: item.idempotencyKey
        ? { 'X-Idempotency-Key': item.idempotencyKey }
        : undefined,
    });

    if (queryClient && item.queryKeys?.length > 0) {
      const invalidatedKeys = new Set<string>();
      for (const key of item.queryKeys) {
        const keyStr = JSON.stringify(key);
        if (!invalidatedKeys.has(keyStr)) {
          invalidatedKeys.add(keyStr);
          await queryClient.invalidateQueries({ queryKey: key });
        }
      }
    }

    if (queryClient && response?.data && item.tempId) {
      const serverData = ((response.data as any)?.pago ?? response.data) as any;
      if (serverData?.id && serverData.id !== item.tempId) {
        for (const key of item.queryKeys) {
          const allMatching = queryClient.getQueryCache().findAll({
            queryKey: key,
            exact: false,
          });
          for (const query of allMatching) {
            setQueryDataIfChanged(queryClient, query.queryKey, (old: any) => {
              if (!old) return old;
              if (old.id === item.tempId) return { ...old, id: serverData.id };
              if (Array.isArray(old)) {
                return old.map((i: any) =>
                  i.id === item.tempId ? { ...i, id: serverData.id } : i,
                );
              }
              if (old?.pages && Array.isArray(old.pages)) {
                return {
                  ...old,
                  pages: old.pages.map((page: any) => {
                    if (!page?.data || !Array.isArray(page.data)) return page;
                    return {
                      ...page,
                      data: page.data.map((i: any) =>
                        i.id === item.tempId ? { ...i, id: serverData.id } : i,
                      ),
                    };
                  }),
                };
              }
              if (old?.data && Array.isArray(old.data)) {
                return {
                  ...old,
                  data: old.data.map((i: any) =>
                    i.id === item.tempId ? { ...i, id: serverData.id } : i,
                  ),
                };
              }
              return old;
            });
          }
        }

        // Solo los items pendientes que referencian este tempId (payload,
        // endpoint o queryKeys), no toda la cola.
        const referencingItems = getQueueItemsReferencingTempId(item.tempId);
        for (const pending of referencingItems) {
          const parsed = typeof pending.data === 'string' ? JSON.parse(pending.data) : JSON.parse(JSON.stringify(pending.data));
          replaceTempIdInData(parsed, item.tempId, serverData.id);
          const updatedStr = JSON.stringify(parsed);
          const hasEndpointRef = pending.endpoint.includes(item.tempId);
          const newEndpoint = hasEndpointRef
            ? pending.endpoint.split(item.tempId).join(serverData.id)
            : pending.endpoint;
          const serializedKeys = JSON.stringify(pending.queryKeys);
          const newQueryKeys = serializedKeys.split(item.tempId).join(serverData.id);
          const hasKeysRef = newQueryKeys !== serializedKeys;

          if (updatedStr !== JSON.stringify(pending.data) || hasEndpointRef || hasKeysRef) {
            const updates: Record<string, string> = {};
            if (updatedStr !== JSON.stringify(pending.data)) updates.data = updatedStr;
            if (hasEndpointRef) updates.endpoint = newEndpoint;
            if (hasKeysRef) updates.queryKeys = newQueryKeys;
            db.update(offlineQueue)
              .set(updates)
              .where(eq(offlineQueue.id, pending.id))
              .run();
            if (__DEV__) {
              console.log(`[Sync] Updated queue item ${pending.id}: replaced ${item.tempId} → ${serverData.id}`);
            }
          }
        }
      }
    }

    if (response?.data) {
      const endpoint = item.endpoint.replace(/\/\d+(\/|$)/, '/:id$1');
      if (endpoint === '/clientes' && item.method === 'POST') {
        const data = Array.isArray(response.data) ? response.data : [response.data];
        upsertClientes(data);
      } else if (endpoint === '/prestamos' && item.method === 'POST') {
        const data = Array.isArray(response.data) ? response.data : [response.data];
        upsertPrestamos(data);
      } else if (
        (endpoint === '/pagos' || /^\/pagos\/saldar\//.test(endpoint)) &&
        item.method === 'POST'
      ) {
        // 2.1: el saldo total (POST /pagos/saldar/:id) también devuelve un
        // `pago`; se persiste en la tabla local igual que un pago normal para
        // que aparezca en el historial sin conexión.
        const serverPago = ((response.data as any)?.pago ?? response.data) as any;
        const sp = Array.isArray(serverPago) ? serverPago[0] : serverPago;
        const pago: Pago = {
          id: sp.id,
          montoTotal: sp.montoTotal,
          capital: sp.capital,
          interes: sp.interes,
          mora: sp.mora ?? 0,
          metodo: sp.metodo,
          referencia: sp.referencia ?? null,
          observacion: sp.observacion ?? null,
          prestamoId: derivarPrestamoId(item) ?? (item.data as any)?.prestamoId,
          usuarioId: useAuthStore.getState().user?.id || '',
          cajaId: sp.cajaId ?? null,
          createdAt: sp.createdAt,
        };
        upsertPagos([pago]);
      } else if (endpoint === '/caja/abrir' && item.method === 'POST') {
        // C2: tras sincronizar la apertura offline, persistir la caja real en
        // SQLite (reemplaza el tempId por el id del servidor). Sin esto, el
        // arranque en frío offline sembraría una caja obsoleta.
        const sp = Array.isArray(response.data) ? response.data[0] : response.data;
        if (sp?.id) {
          saveCajaActiva({
            id: sp.id,
            estado: sp.estado,
            montoInicial: sp.montoInicial,
            fecha: sp.fecha,
            horaApertura: sp.createdAt,
            totalIngresos: sp.totalIngresos ?? 0,
            totalEgresos: sp.totalEgresos ?? 0,
            cantidadMovimientos: 0,
          });
        }
      } else if (item.endpoint.match(/^\/caja\/[^/]+\/cerrar$/) && item.method === 'PATCH') {
        // C2: tras sincronizar el cierre offline, borrar la caja persistida
        // para que el siguiente arranque en frío no autorice pagos contra una
        // caja ya cerrada en el servidor. Se matchea sobre el endpoint crudo
        // porque la normalización de arriba no toca ids con UUID.
        saveCajaActiva(null);
      } else if (
        /^\/clientes\/[^/]+$/.test(item.endpoint) &&
        (item.method === 'PATCH' || item.method === 'DELETE')
      ) {
        // Mutaciones de cliente offline (editar/deshabilitar): persistir la
        // respuesta del servidor en SQLite para que el arranque en frío no
        // revierta el cambio, y mergear el detalle cacheado (no truncarlo).
        const sp = Array.isArray(response.data) ? response.data[0] : response.data;
        if (sp?.id) {
          upsertClientes([sp]);
          setQueryDataIfChanged(queryClient, ['clientes', sp.id], (old: any) =>
            old ? { ...old, ...sp } : sp,
          );
        }
      } else if (
        /^\/clientes\/[^/]+\/reactivar$/.test(item.endpoint) &&
        item.method === 'PATCH'
      ) {
        const sp = Array.isArray(response.data) ? response.data[0] : response.data;
        if (sp?.id) {
          upsertClientes([sp]);
          setQueryDataIfChanged(queryClient, ['clientes', sp.id], (old: any) =>
            old ? { ...old, ...sp } : sp,
          );
        }
      }

      if (item.tempId) {
        if (endpoint === '/clientes' && item.method === 'POST') {
          deleteCliente(item.tempId);
        } else if (endpoint === '/prestamos' && item.method === 'POST') {
          deletePrestamo(item.tempId);
        } else if (endpoint === '/pagos' && item.method === 'POST') {
          deletePago(item.tempId);
        }
      }

      const prestamoId = derivarPrestamoId(item);
      if (prestamoId) {
        await reconciliarPrestamoLocal(prestamoId);
      }
    }

    await removeFromQueue(item.id);
    emitItemEvent({ id: item.id, status: 'synced' });
    return true;
  } catch (error: any) {
    // Colisión real de idempotencyKey (409 con code: IDEMPOTENCY_KEY_COLLISION):
    // la key pertenece a otra operación/recurso. NO fue procesada.
    // Tratar como fallo permanente: mantener en cola, NO hacer rollback de snapshot
    // (la operación local es válida, solo la key colisiona).
    if (isIdempotencyKeyCollision(error)) {
      if (__DEV__) {
        console.log(`[Sync] Idempotency key collision for ${item.endpoint} - key belongs to another resource, keeping in queue as failed`);
      }
      await updateQueueItem(item.id, {
        status: 'failed',
        retryCount: item.retryCount + 1,
        lastError: 'Colisión de idempotencyKey: la clave ya pertenece a otra operación',
        retryable: false,
      });
      emitItemEvent({ id: item.id, status: 'failed' });
      return false;
    }

    if (isRetryableError(error) && item.retryCount < OFFLINE_MAX_RETRIES) {
      // Error reintentable: lo dejamos pendiente para el siguiente ciclo de
      // auto-sync (network-provider reintenta cada ~5s). No bloqueamos el resto
      // de la cola con `delay`: un solo item fallando retrasaba todo el sync.
      await updateQueueItem(item.id, {
        status: 'pending',
        retryCount: item.retryCount + 1,
        lastError: getErrorMessage(error),
        retryable: true,
      });
      emitItemEvent({ id: item.id, status: 'failed' });
      return false;
    }

    const isCriticalExpired = item.status === 'expired' && isFinancialCriticalOperation(item);

    if (!isCriticalExpired) {
      restoreSnapshot(item);
      if (item.tempId) {
        const normEndpoint = item.endpoint.replace(/\/\d+(\/|$)/, '/:id$1');
        if (normEndpoint === '/clientes' && item.method === 'POST') {
          deleteCliente(item.tempId);
        } else if (normEndpoint === '/prestamos' && item.method === 'POST') {
          deletePrestamo(item.tempId);
        } else if (normEndpoint === '/pagos' && item.method === 'POST') {
          deletePago(item.tempId);
        }
      }
    } else if (__DEV__) {
      console.log(
        `[Sync] Operación crítica expirada (${item.endpoint}) falló permanentemente: se conserva como expired sin rollback`,
      );
    }

    await updateQueueItem(item.id, {
      status: isCriticalExpired ? 'expired' : 'failed',
      retryCount: item.retryCount + 1,
      lastError: getErrorMessage(error),
      retryable: isCriticalExpired ? true : isRetryableError(error),
    });
    emitItemEvent({ id: item.id, status: isCriticalExpired ? 'failed' : 'failed' });
    return false;
  }
}

export async function syncNow(queryClient?: QueryClient): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  if (syncing) return { synced: 0, failed: 0, errors: ['Ya hay una sincronización en curso'] };

  const network = getNetworkStatus();
  if (!network.isOnline) return { synced: 0, failed: 0, errors: ['Sin conexión a internet'] };

  syncing = true;
  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  try {
    // Procesar tanto items pendientes como expirados (expirados son operaciones
    // financieras críticas que requieren revisión manual pero pueden reintentarse)
    let pending = await getPendingItems();
    let expired = await getExpiredItems();
    let allItems = [...pending, ...expired];
    const total = allItems.length;
    const retryingIds = new Set<string>();

    while (allItems.length > 0) {
      const item = allItems[0];
      emitProgress({ processed: synced + failed, total, current: item });

      const success = await processItem(item, queryClient);
      if (success) {
        synced++;
      } else {
        const network2 = getNetworkStatus();
        if (!network2.isOnline) {
          errors.push('Conexión perdida durante sincronización');
          break;
        }
        const pendingItems = await getPendingItems();
        const expiredItems = await getExpiredItems();
        const stillPending = pendingItems.some((i) => i.id === item.id);
        const stillExpired = expiredItems.some((i) => i.id === item.id);
        if (stillPending || stillExpired) {
          retryingIds.add(item.id);
        } else {
          failed++;
        }
      }

      // Progreso tras cada item para que la UI avance "X de Y" en vivo.
      emitProgress({ processed: synced + failed, total, current: null });

      pending = (await getPendingItems()).filter((i) => !retryingIds.has(i.id));
      expired = (await getExpiredItems()).filter((i) => !retryingIds.has(i.id));
      allItems = [...pending, ...expired];
    }
  } finally {
    syncing = false;
    emitProgress({ processed: synced, total: synced + failed, current: null });
    emitCompletion({ synced, failed, errors });
  }

  return { synced, failed, errors };
}

export async function retryFailed(queryClient?: QueryClient): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  // Reintentar tanto items fallidos como expirados que sean reintentables
  const failed = await getFailedItems();
  const expired = await getExpiredItems();
  
  for (const item of [...failed, ...expired]) {
    // Solo reintentamos fallos transitorios (red/5xx/408/429) y items expirados reintentables.
    // Los errores permanentes (validación/conflicto) no se resuelven reintentando.
    if (item.retryable === false) continue;
    await updateQueueItem(item.id, { status: 'pending', retryCount: 0 });
  }
  return syncNow(queryClient);
}

export async function getSyncStatus() {
  return getQueueStats();
}
