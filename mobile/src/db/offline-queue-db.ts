import { eq, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { offlineQueue } from './schema';
import type { OfflineQueueItem, OfflineMethod } from '@/types/offline.types';
import { OFFLINE_MAX_AGE_MS } from '@/types/offline.types';

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
    data: JSON.stringify(item.data),
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
  const all = db.select().from(offlineQueue).all();
  const pending = all.filter((i: typeof offlineQueue.$inferSelect) => i.status === 'pending').length;
  const failed = all.filter((i: typeof offlineQueue.$inferSelect) => i.status === 'failed').length;
  const oldestAt = all.length > 0 ? all[0].createdAt : null;
  return { pending, failed, total: all.length, oldestAt };
}

export function removeStaleItems(): number {
  const cutoff = Date.now() - OFFLINE_MAX_AGE_MS;
  const result = db
    .delete(offlineQueue)
    .where(lte(offlineQueue.createdAt, cutoff))
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

  const found = items.find(
    (item: typeof offlineQueue.$inferSelect) =>
      item.method === method &&
      item.data === JSON.stringify(data) &&
      item.status !== 'failed',
  );

  return found ? rowToItem(found) : null;
}

export function clearQueue(): void {
  db.delete(offlineQueue).run();
}
