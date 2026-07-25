import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  OfflineQueueItem,
  OfflineMethod,
} from '@/types/offline.types';
import {
  OFFLINE_QUEUE_KEY,
  OFFLINE_MAX_QUEUE_SIZE,
  OFFLINE_MAX_AGE_MS,
} from '@/types/offline.types';

let queueLock = false;
const lockWaiters: (() => void)[] = [];

async function acquireLock(): Promise<void> {
  if (!queueLock) {
    queueLock = true;
    return;
  }
  return new Promise((resolve) => {
    lockWaiters.push(resolve);
  });
}

function releaseLock(): void {
  if (lockWaiters.length > 0) {
    const next = lockWaiters.shift()!;
    next();
  } else {
    queueLock = false;
  }
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquireLock();
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function readRawQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const items: OfflineQueueItem[] = JSON.parse(raw);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function writeRawQueue(items: OfflineQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  } catch (error) {
    if (__DEV__) {
      console.warn('[OfflineQueue] Error writing queue:', error);
    }
    throw error;
  }
}

export async function getQueue(): Promise<OfflineQueueItem[]> {
  return withLock(readRawQueue);
}

export async function addToQueue(
  item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'idempotencyKey'>,
): Promise<OfflineQueueItem> {
  return withLock(async () => {
    let queue = await readRawQueue();

    const cutoff = Date.now() - OFFLINE_MAX_AGE_MS;
    const freshQueue = queue.filter((i) => i.createdAt >= cutoff);
    if (freshQueue.length < queue.length) {
      await writeRawQueue(freshQueue);
      queue = freshQueue;
    }

    if (queue.length >= OFFLINE_MAX_QUEUE_SIZE) {
      const failedItems = queue.filter((i) => i.status === 'failed');
      if (failedItems.length > 0) {
        const failedIds = new Set(failedItems.map((i) => i.id));
        queue = queue.filter((i) => !failedIds.has(i.id));
      } else {
        queue = queue.slice(Math.ceil(queue.length * 0.2));
      }
      await writeRawQueue(queue);
    }

    const newItem: OfflineQueueItem = {
      ...item,
      id: generateId(),
      idempotencyKey: generateIdempotencyKey(),
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    queue.push(newItem);
    await writeRawQueue(queue);
    return newItem;
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  return withLock(async () => {
    const queue = await readRawQueue();
    const filtered = queue.filter((item) => item.id !== id);
    await writeRawQueue(filtered);
  });
}

export async function updateQueueItem(
  id: string,
  updates: Partial<OfflineQueueItem>,
): Promise<void> {
  return withLock(async () => {
    const queue = await readRawQueue();
    const index = queue.findIndex((item) => item.id === id);
    if (index === -1) return;

    queue[index] = { ...queue[index], ...updates };
    await writeRawQueue(queue);
  });
}

export async function clearQueue(): Promise<void> {
  return withLock(async () => {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  });
}

export async function getPendingItems(): Promise<OfflineQueueItem[]> {
  return withLock(async () => {
    const queue = await readRawQueue();
    return queue.filter((item) => item.status === 'pending');
  });
}

export async function getFailedItems(): Promise<OfflineQueueItem[]> {
  return withLock(async () => {
    const queue = await readRawQueue();
    return queue.filter((item) => item.status === 'failed');
  });
}

export async function getQueueStats(): Promise<{
  pending: number;
  failed: number;
  total: number;
  oldestAt: number | null;
}> {
  return withLock(async () => {
    const queue = await readRawQueue();
    const pending = queue.filter((i) => i.status === 'pending').length;
    const failed = queue.filter((i) => i.status === 'failed').length;
    const oldestAt = queue.length > 0 ? queue[0].createdAt : null;
    return { pending, failed, total: queue.length, oldestAt };
  });
}

export async function removeStaleItems(): Promise<number> {
  return withLock(async () => {
    const queue = await readRawQueue();
    const cutoff = Date.now() - OFFLINE_MAX_AGE_MS;
    const staleCount = queue.filter((i) => i.createdAt < cutoff).length;
    if (staleCount === 0) return 0;

    const fresh = queue.filter((i) => i.createdAt >= cutoff);
    await writeRawQueue(fresh);
    return staleCount;
  });
}

export async function recoverSyncingItems(): Promise<number> {
  return withLock(async () => {
    const queue = await readRawQueue();
    const stuckSyncing = queue.filter((i) => i.status === 'syncing');
    if (stuckSyncing.length === 0) return 0;

    const recovered = queue.map((item) =>
      item.status === 'syncing' ? { ...item, status: 'pending' as const } : item,
    );
    await writeRawQueue(recovered);
    return stuckSyncing.length;
  });
}

export async function removeByEndpoint(
  endpoint: string,
  method?: OfflineMethod,
): Promise<number> {
  return withLock(async () => {
    const queue = await readRawQueue();
    const before = queue.length;
    const filtered = queue.filter(
      (item) =>
        !(item.endpoint === endpoint && (method ? item.method === method : true)),
    );
    await writeRawQueue(filtered);
    return before - filtered.length;
  });
}

export async function findDuplicate(
  endpoint: string,
  method: OfflineMethod,
  data: unknown,
): Promise<OfflineQueueItem | null> {
  return withLock(async () => {
    const queue = await readRawQueue();
    return (
      queue.find(
        (item) =>
          item.endpoint === endpoint &&
          item.method === method &&
          JSON.stringify(item.data) === JSON.stringify(data) &&
          item.status !== 'failed',
      ) ?? null
    );
  });
}
