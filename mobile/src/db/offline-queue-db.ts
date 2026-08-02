import { and, eq, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from './index';
import { offlineQueue } from './schema';
import type { OfflineQueueItem, OfflineMethod } from '@/types/offline.types';
import { OFFLINE_MAX_AGE_MS } from '@/types/offline.types';
import { deletePago } from '@/db/pagos-db';
import { deletePrestamo } from '@/db/prestamos-db';
import { deleteCliente } from '@/db/clientes-db';

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
  };
}

function itemToRow(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'idempotencyKey'> & { id: string; createdAt: number; retryCount: number; status: string; idempotencyKey?: string }) {
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
  };
}

function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
  item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'idempotencyKey'>,
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
    idempotencyKey: generateIdempotencyKey(),
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

export function getQueueStats(): {
  pending: number;
  failed: number;
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
    total,
    oldestAt: oldest?.createdAt ?? null,
  };
}

export function markStaleAsFailed(): number {
  const cutoff = Date.now() - OFFLINE_MAX_AGE_MS;
  const result = db
    .update(offlineQueue)
    .set({
      status: 'failed',
      lastError: 'Expirado por antigüedad (más de 7 días sin sincronizar)',
    })
    .where(
      and(
        lte(offlineQueue.createdAt, cutoff),
        ne(offlineQueue.status, 'failed'),
      ),
    )
    .run();
  return result.changes;
}

export function recoverSyncingItems(): number {
  const result = db
    .update(offlineQueue)
    .set({ status: 'pending' })
    .where(eq(offlineQueue.status, 'syncing'))
    .run();
  return result.changes;
}

export function findDuplicate(
  endpoint: string,
  method: string,
  data: unknown,
): OfflineQueueItem | null {
  const items = db
    .select()
    .from(offlineQueue)
    .where(eq(offlineQueue.endpoint, endpoint))
    .all();

  const serialized = stableStringify(data);
  const found = items.find(
    (item: typeof offlineQueue.$inferSelect) =>
      item.method === method &&
      item.data === serialized &&
      item.status !== 'failed',
  );

  return found ? rowToItem(found) : null;
}

/**
 * Elimina SOLO los items fallidos indicados (nunca operaciones pendientes).
 * Limpia además los registros temporales asociados (pagos/préstamos/clientes
 * sintéticos) para no dejar datos "fantasma" en la BD local.
 * Devuelve la cantidad de items realmente eliminados.
 */
export function clearFailedItems(ids: string[]): number {
  if (ids.length === 0) return 0;

  const idSet = new Set(ids);
  const failed = getFailedItems().filter((i) => idSet.has(i.id));

  for (const item of failed) {
    if (!item.tempId) continue;
    const endpoint = item.endpoint.replace(/\/\d+(\/|$)/, '/:id$1');
    if (endpoint === '/clientes' && item.method === 'POST') {
      deleteCliente(item.tempId);
    } else if (endpoint === '/prestamos' && item.method === 'POST') {
      deletePrestamo(item.tempId);
    } else if (endpoint === '/pagos' && item.method === 'POST') {
      deletePago(item.tempId);
    }
  }

  const finalIds = failed.map((i) => i.id);
  if (finalIds.length > 0) {
    db.delete(offlineQueue).where(inArray(offlineQueue.id, finalIds)).run();
  }

  return finalIds.length;
}
