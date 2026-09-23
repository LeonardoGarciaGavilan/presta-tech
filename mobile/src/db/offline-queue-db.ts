import { and, eq, inArray, like, lte, ne, or, sql } from 'drizzle-orm';
import { db } from './index';
import { offlineQueue, prestamos } from './schema';
import type { OfflineQueueItem, OfflineMethod } from '@/types/offline.types';
import { OFFLINE_MAX_AGE_MS, isFinancialCriticalOperation } from '@/types/offline.types';
import { deletePago } from '@/db/pagos-db';
import { deletePrestamo, upsertPrestamos } from '@/db/prestamos-db';
import { deleteCliente } from '@/db/clientes-db';
import type { Prestamo } from '@/types/prestamo.types';

function rowToItem(row: typeof offlineQueue.$inferSelect): OfflineQueueItem {
  return {
    id: row.id,
    endpoint: row.endpoint,
    method: row.method as OfflineMethod,
    data: JSON.parse(row.data),
    queryKeys: JSON.parse(row.queryKeys),
    createdAt: row.createdAt,
    retryCount: row.retryCount ?? 0,
    status: row.status as OfflineQueueItem['status'],
    tempId: row.tempId ?? undefined,
    tempDisplay: row.tempDisplay ? JSON.parse(row.tempDisplay) : undefined,
    lastError: row.lastError ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
    retryable: row.retryable ?? true,
    snapshot: row.snapshot ? JSON.parse(row.snapshot) : undefined,
  };
}

function itemToRow(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'idempotencyKey' | 'retryable'> & { id: string; createdAt: number; retryCount: number; status: string; idempotencyKey?: string; retryable?: boolean }) {
  return {
    id: item.id,
    endpoint: item.endpoint,
    method: item.method,
    data: stableStringify(item.data),
    queryKeys: JSON.stringify(item.queryKeys),
    createdAt: item.createdAt,
    retryCount: item.retryCount,
    status: item.status,
    tempId: item.tempId ?? null,
    tempDisplay: item.tempDisplay ? JSON.stringify(item.tempDisplay) : null,
    lastError: item.lastError ?? null,
    idempotencyKey: item.idempotencyKey ?? null,
    retryable: item.retryable ?? true,
    snapshot: item.snapshot !== undefined ? JSON.stringify(item.snapshot) : null,
  };
}

export function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}${random}`;
}

function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Los pagos NO se deduplican por payload: dos cobros legítimos idénticos
// (mismo préstamo, monto, método y día) se colapsarían en un solo item y se
// perdería dinero. La protección contra envíos duplicados de un mismo pago la
// da la idempotencia del servidor (idempotencyKey + X-Idempotency-Key).
export function isPaymentEndpoint(endpoint: string, method: string): boolean {
  if (method !== 'POST') return false;
  return endpoint === '/pagos' || /^\/pagos\/saldar\/.+/.test(endpoint);
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce(
        (acc: Record<string, unknown>, k) => {
          acc[k] = value[k];
          return acc;
        },
        {},
      );
    }
    return value;
  });
}

export function getQueue(): OfflineQueueItem[] {
  return db
    .select()
    .from(offlineQueue)
    .orderBy(offlineQueue.createdAt)
    .all()
    .map(rowToItem);
}

export function addToQueue(
  item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status'>,
): OfflineQueueItem {
  const existing = findDuplicate(item.endpoint, item.method, item.data);
  if (existing) {
    if (__DEV__) {
      console.log(`[Queue] Duplicate detected for ${item.endpoint}, reusing existing item ${existing.id}`);
    }
    return existing;
  }

  const newItem = {
    ...item,
    id: generateId(),
    idempotencyKey: item.idempotencyKey ?? generateIdempotencyKey(),
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending' as const,
  };

  db.insert(offlineQueue)
    .values(itemToRow(newItem))
    .run();

  return newItem;
}

export function updateQueueItem(id: string, updates: Partial<OfflineQueueItem>): void {
  const setClause: Record<string, any> = {};
  if (updates.status !== undefined) setClause.status = updates.status;
  if (updates.retryCount !== undefined) setClause.retryCount = updates.retryCount;
  if (updates.lastError !== undefined) setClause.lastError = updates.lastError;
  if (updates.retryable !== undefined) setClause.retryable = updates.retryable;

  if (Object.keys(setClause).length > 0) {
    db.update(offlineQueue)
      .set(setClause)
      .where(eq(offlineQueue.id, id))
      .run();
  }
}

export function removeFromQueue(id: string): void {
  db.delete(offlineQueue).where(eq(offlineQueue.id, id)).run();
}

export function getPendingItems(): OfflineQueueItem[] {
  return db
    .select()
    .from(offlineQueue)
    .where(eq(offlineQueue.status, 'pending'))
    .orderBy(offlineQueue.createdAt)
    .all()
    .map(rowToItem);
}

export function getFailedItems(): OfflineQueueItem[] {
  return db
    .select()
    .from(offlineQueue)
    .where(eq(offlineQueue.status, 'failed'))
    .orderBy(offlineQueue.createdAt)
    .all()
    .map(rowToItem);
}

// Items de la cola relativos a pagos de un préstamo concreto (pago normal o
// saldo total) en cualquier estado no-finalizado (pending/syncing/failed).
// Se usa para informar al usuario en el detalle del préstamo.
export function getPagosPendientesDePrestamo(prestamoId: string): OfflineQueueItem[] {
  if (!prestamoId) return [];
  return getQueue().filter((i) => {
    if (i.endpoint === '/pagos' && i.method === 'POST') {
      const data = i.data as Record<string, unknown> | null;
      return data?.prestamoId === prestamoId;
    }
    return i.endpoint === `/pagos/saldar/${prestamoId}`;
  });
}

/**
 * Obtiene los items con estado 'expired' (operaciones financieras críticas
 * que expiraron y requieren revisión manual).
 */
export function getExpiredItems(): OfflineQueueItem[] {
  return db
    .select()
    .from(offlineQueue)
    .where(eq(offlineQueue.status, 'expired'))
    .orderBy(offlineQueue.createdAt)
    .all()
    .map(rowToItem);
}

/**
 * Obtiene estadísticas de la cola incluyendo items expirados.
 */
export function getQueueStats(): {
  pending: number;
  failed: number;
  expired: number;
  total: number;
  oldestAt: number | null;
} {
  const rows = db
    .select({
      status: offlineQueue.status,
      count: sql<number>`count(*)`,
    })
    .from(offlineQueue)
    .groupBy(offlineQueue.status)
    .all();

  const pending = rows.find((r) => r.status === 'pending')?.count ?? 0;
  const failed = rows.find((r) => r.status === 'failed')?.count ?? 0;
  const expired = rows.find((r) => r.status === 'expired')?.count ?? 0;
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  const oldest = db
    .select({ createdAt: offlineQueue.createdAt })
    .from(offlineQueue)
    .orderBy(offlineQueue.createdAt)
    .limit(1)
    .get();

  return {
    pending,
    failed,
    expired,
    total,
    oldestAt: oldest?.createdAt ?? null,
  };
}

// Mensaje de error para operaciones expiradas
const EXPIRED_ERROR_MESSAGE = 'Expirado por antigüedad (más de 7 días sin sincronizar). Requiere revisión manual.';

// Evento para notificar operaciones expiradas
type StaleExpiredListener = (count: number) => void;
const staleExpiredListeners = new Set<StaleExpiredListener>();

export function onStaleExpired(listener: StaleExpiredListener): () => void {
  staleExpiredListeners.add(listener);
  return () => staleExpiredListeners.delete(listener);
}

function emitStaleExpiredEvent(count: number) {
  staleExpiredListeners.forEach((l) => l(count));
}

export function markStaleAsFailed(): number {
  const cutoff = Date.now() - OFFLINE_MAX_AGE_MS;
  
  // Obtener items que van a expirar (no failed, no expired, más viejos que cutoff)
  const itemsToExpire = db
    .select()
    .from(offlineQueue)
    .where(
      and(
        lte(offlineQueue.createdAt, cutoff),
        ne(offlineQueue.status, 'failed'),
        ne(offlineQueue.status, 'expired'),
      ),
    )
    .all();

  let expiredCount = 0;
  let failedCount = 0;

  for (const row of itemsToExpire) {
    const item = rowToItem(row);
    const isCritical = isFinancialCriticalOperation(item);

    if (isCritical) {
      // Operación financiera crítica: marcar como expired, NO hacer rollback
      db.update(offlineQueue)
        .set({
          status: 'expired',
          lastError: EXPIRED_ERROR_MESSAGE,
          retryable: true,
        })
        .where(eq(offlineQueue.id, row.id))
        .run();
      expiredCount++;
    } else {
      // Operación no crítica: comportamiento actual (failed + rollback)
      db.update(offlineQueue)
        .set({
          status: 'failed',
          lastError: 'Expirado por antigüedad (más de 7 días sin sincronizar)',
          retryable: false,
        })
        .where(eq(offlineQueue.id, row.id))
        .run();
      
      // Hacer rollback para operaciones no críticas
      const item = rowToItem(row);
      restoreSnapshot(item);
      limpiarSinteticos(item);
      failedCount++;
    }
  }

  // Emitir evento si hay operaciones expiradas (para notificación)
  if (expiredCount > 0) {
    emitStaleExpiredEvent(expiredCount);
  }

  return expiredCount + failedCount;
}

export function recoverSyncingItems(): number {
  const result = db
    .update(offlineQueue)
    .set({ status: 'pending' })
    .where(eq(offlineQueue.status, 'syncing'))
    .run();
  return result.changes;
}

/**
 * C3: revierte la mutación local aplicada al encolar la operación (p. ej. el
 * saldo/cuotas de un préstamo tras un pago offline) usando el snapshot que se
 * guardó ANTES de mutar. Idempotente: restaurar dos veces el mismo snapshot
 * deja el mismo resultado. No-op si el item no tiene snapshot.
 */
export function restoreSnapshot(item: OfflineQueueItem): void {
  const snapshot = item.snapshot as { prestamo?: Prestamo } | null | undefined;
  if (!snapshot?.prestamo) return;
  upsertPrestamos([snapshot.prestamo]);
}

// Elimina las entidades sintéticas `*_temp_*` creadas localmente al encolar una
// creación offline (cliente/préstamo/pago). Si la operación jamás se aplicará
// en el servidor (fallo permanente o expiración por antigüedad), no deben
// quedar filas "fantasma" con ids temporales.
function limpiarSinteticos(item: OfflineQueueItem): void {
  if (!item.tempId) return;
  const endpoint = item.endpoint.replace(/\/\d+(\/|$)/, '/:id$1');
  if (endpoint === '/clientes' && item.method === 'POST') {
    deleteCliente(item.tempId);
  } else if (endpoint === '/prestamos' && item.method === 'POST') {
    deletePrestamo(item.tempId);
  } else if (
    (endpoint === '/pagos' || /^\/pagos\/saldar\//.test(endpoint)) &&
    item.method === 'POST'
  ) {
    deletePago(item.tempId);
  }
}

export function findDuplicate(
  endpoint: string,
  method: string,
  data: unknown,
): OfflineQueueItem | null {
  // Los pagos nunca se consideran duplicados (ver isPaymentEndpoint).
  if (isPaymentEndpoint(endpoint, method)) return null;

  // Filtra por endpoint Y método en SQL para no barrer toda la cola por cada
  // insert/consulta de duplicado.
  const items = db
    .select()
    .from(offlineQueue)
    .where(
      and(
        eq(offlineQueue.endpoint, endpoint),
        eq(offlineQueue.method, method),
      ),
    )
    .all();

  const serialized = stableStringify(data);
  const found = items.find(
    (item: typeof offlineQueue.$inferSelect) =>
      item.data === serialized &&
      item.status !== 'failed',
  );

  return found ? rowToItem(found) : null;
}

/**
 * Devuelve los items (de cualquier estado) cuyo payload (`data`), endpoint o
 * queryKeys hagan referencia a un `tempId`. Tras un sync exitoso se usan para
 * reemplazar `tempId → id real` SOLO en los items afectados, evitando parsear
 * toda la cola por cada item procesado (O(n²)).
 *
 * Nota: los tempId contienen `_`, que en SQL LIKE es comodín de 1 carácter.
 * El sobre-match es inofensivo: el reemplazo real se hace por coincidencia
 * exacta en JS y descarta los items sin cambios.
 */
export function getQueueItemsReferencingTempId(tempId: string): OfflineQueueItem[] {
  if (!tempId) return [];
  const pattern = `%${tempId}%`;
  return db
    .select()
    .from(offlineQueue)
    .where(
      or(
        like(offlineQueue.data, pattern),
        like(offlineQueue.endpoint, pattern),
        like(offlineQueue.queryKeys, pattern),
      ),
    )
    .all()
    .map(rowToItem);
}

/**
 * Elimina SOLO los items fallidos o expirados indicados (nunca operaciones pendientes).
 * Limpia además los registros temporales asociados (pagos/préstamos/clientes
 * sintéticos) y revierte la mutación local (C3) para no dejar datos "fantasma"
 * ni saldos desincronizados de la realidad.
 * Devuelve la cantidad de items realmente eliminados.
 */
export function clearFailedItems(ids: string[]): number {
  if (ids.length === 0) return 0;

  const idSet = new Set(ids);
  const failed = getFailedItems().filter((i) => idSet.has(i.id));
  const expired = getExpiredItems().filter((i) => idSet.has(i.id));

  // Procesar items fallidos (comportamiento actual)
  for (const item of failed) {
    restoreSnapshot(item);
    limpiarSinteticos(item);
  }

  // Procesar items expirados (operaciones financieras críticas)
  for (const item of expired) {
    discardExpiredItem(item);
  }

  const finalIds = [...failed.map((i) => i.id), ...expired.map((i) => i.id)];
  if (finalIds.length > 0) {
    db.delete(offlineQueue).where(inArray(offlineQueue.id, finalIds)).run();
  }

  return finalIds.length;
}

/**
 * Descarta una operación expirada (operación financiera crítica).
 * Revierte el estado local optimista sin intentar revertir en el backend.
 */
export function discardExpiredItem(item: OfflineQueueItem): void {
  const endpoint = item.endpoint.replace(/\/\d+(\/|$)/, '/:id$1');

  // Para desembolso: revertir estado optimista ACTIVO -> APROBADO
  if (endpoint === '/prestamos/:id/desembolsar' && item.method === 'PATCH') {
    const prestamoId = item.endpoint.match(/^\/prestamos\/([^/]+)\/desembolsar$/)?.[1];
    if (prestamoId) {
      // Revertir estado local del préstamo de ACTIVO a APROBADO
      db.update(prestamos)
        .set({ estado: 'APROBADO' })
        .where(eq(prestamos.id, prestamoId))
        .run();

      // Invalidar cache de React Query del préstamo para reflejar APROBADO
      // La invalidación real ocurre cuando la UI se refresca o se hace pull-to-refresh
    }
    // No llamar restoreSnapshot (el desembolso no guarda snapshot)
    // No llamar limpiarSinteticos (no hay entidades sintéticas para desembolso)
    return;
  }

  // Para refinanciar: restaurar snapshot del préstamo previo al refinanciamiento
  if (endpoint === '/prestamos/:id/refinanciar' && item.method === 'PATCH') {
    restoreSnapshot(item);
    // No hay entidades sintéticas que limpiar para refinanciar
    return;
  }

  // Para pagos y saldar: restaurar snapshot y limpiar sintéticos
  restoreSnapshot(item);
  limpiarSinteticos(item);
}
