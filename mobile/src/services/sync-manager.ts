import type { QueryClient } from '@tanstack/react-query';
import client from '@/api/client';
import type { OfflineQueueItem, SyncProgress } from '@/types/offline.types';
import {
  OFFLINE_MAX_RETRIES,
} from '@/types/offline.types';
import {
  getPendingItems,
  getFailedItems,
  updateQueueItem,
  removeFromQueue,
  findDuplicate,
  getQueueStats,
  getQueueItemsReferencingTempId,
} from '@/db/offline-queue-db';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { db } from '@/db';
import { offlineQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { upsertClientes, deleteCliente } from '@/db/clientes-db';
import { upsertPrestamos, deletePrestamo } from '@/db/prestamos-db';
import { upsertPagos, deletePago } from '@/db/pagos-db';
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
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater: (old: any) => any,
): void {
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
      } else if (endpoint === '/pagos' && item.method === 'POST') {
        const serverPago = ((response.data as any)?.pago ?? response.data) as any;
        const sp = Array.isArray(serverPago) ? serverPago[0] : serverPago;
        const pago: Pago = {
          id: sp.id,
          montoTotal: sp.montoTotal,
          capital: sp.capital + (sp.abonoCapital ?? 0),
          interes: sp.interes,
          mora: sp.mora ?? 0,
          metodo: sp.metodo,
          referencia: sp.referencia ?? null,
          observacion: sp.observacion ?? null,
          prestamoId: (item.data as any)?.prestamoId,
          usuarioId: useAuthStore.getState().user?.id || '',
          cajaId: sp.cajaId ?? null,
          createdAt: sp.createdAt,
        };
        upsertPagos([pago]);
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

    await updateQueueItem(item.id, {
      status: 'failed',
      retryCount: item.retryCount + 1,
      lastError: getErrorMessage(error),
      retryable: isRetryableError(error),
    });
    emitItemEvent({ id: item.id, status: 'failed' });
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
    let pending = await getPendingItems();
    const total = pending.length;
    const retryingIds = new Set<string>();

    while (pending.length > 0) {
      const item = pending[0];
      emitProgress({ processed: synced, total, current: item });

      const success = await processItem(item, queryClient);
      if (success) {
        synced++;
      } else {
        const network2 = getNetworkStatus();
        if (!network2.isOnline) {
          errors.push('Conexión perdida durante sincronización');
          break;
        }
        const stillPending = getPendingItems().some((i) => i.id === item.id);
        if (stillPending) {
          retryingIds.add(item.id);
        } else {
          failed++;
        }
      }

      // Progreso tras cada item para que la UI avance "X de Y" en vivo.
      emitProgress({ processed: synced + failed, total, current: null });

      pending = (await getPendingItems()).filter((i) => !retryingIds.has(i.id));
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
  const failed = await getFailedItems();
  for (const item of failed) {
    // Solo reintentamos fallos transitorios (red/5xx/408/429). Los errores
    // permanentes (validación/conflicto/expirados) no se resuelven reintentando;
    // reintentarlos en bucle solo ensucia la cola.
    if (item.retryable === false) continue;
    await updateQueueItem(item.id, { status: 'pending', retryCount: 0 });
  }
  return syncNow(queryClient);
}

export async function getSyncStatus() {
  return getQueueStats();
}
