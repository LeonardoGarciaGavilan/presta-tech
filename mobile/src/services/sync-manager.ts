import type { QueryClient } from '@tanstack/react-query';
import client from '@/api/client';
import type { OfflineQueueItem, SyncProgress } from '@/types/offline.types';
import {
  OFFLINE_MAX_RETRIES,
  OFFLINE_BACKOFF_BASE_MS,
} from '@/types/offline.types';
import {
  getPendingItems,
  getFailedItems,
  updateQueueItem,
  removeFromQueue,
  findDuplicate,
  getQueueStats,
} from '@/db/offline-queue-db';
import { getNetworkStatus } from '@/hooks/use-network-status';

type ProgressListener = (progress: SyncProgress) => void;
type CompletionListener = (result: {
  synced: number;
  failed: number;
  errors: string[];
}) => void;

const progressListeners = new Set<ProgressListener>();
const completionListeners = new Set<CompletionListener>();

export function onSyncProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

export function onSyncComplete(listener: CompletionListener): () => void {
  completionListeners.add(listener);
  return () => completionListeners.delete(listener);
}

function emitProgress(progress: SyncProgress) {
  progressListeners.forEach((l) => l(progress));
}

function emitCompletion(result: { synced: number; failed: number; errors: string[] }) {
  completionListeners.forEach((l) => l(result));
}

let syncing = false;

export function isSyncing(): boolean {
  return syncing;
}

function getBackoffMs(retryCount: number): number {
  return Math.min(
    OFFLINE_BACKOFF_BASE_MS * Math.pow(2, retryCount),
    30000,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getErrorMessage(error: any): string {
  const status = error?.statusCode;
  if (status === 409) return 'Conflicto con datos existentes';
  if (status === 422) return 'Error de validación del servidor';
  if (status === 401 || status === 403) return 'Sesión expirada';
  if (status && status >= 500) return 'Error temporal del servidor';
  return error?.message || 'Error desconocido';
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

    const response = await client({
      method: item.method,
      url: item.endpoint,
      data: item.method !== 'DELETE' ? item.data : undefined,
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
      const serverData = response.data as any;
      if (serverData?.id && serverData.id !== item.tempId) {
        for (const key of item.queryKeys) {
          queryClient.setQueryData(key, (old: any) => {
            if (!old) return old;
            if (old.id === item.tempId) return { ...old, id: serverData.id };
            if (Array.isArray(old)) {
              return old.map((item: any) =>
                item.id === item.tempId ? { ...item, id: serverData.id } : item,
              );
            }
            return old;
          });
        }
      }
    }

    await removeFromQueue(item.id);
    return true;
  } catch (error: any) {
    if (isRetryableError(error) && item.retryCount < OFFLINE_MAX_RETRIES) {
      const backoffMs = getBackoffMs(item.retryCount);
      await updateQueueItem(item.id, {
        status: 'pending',
        retryCount: item.retryCount + 1,
        lastError: getErrorMessage(error),
      });
      await delay(backoffMs);
      return false;
    }

    await updateQueueItem(item.id, {
      status: 'failed',
      retryCount: item.retryCount + 1,
      lastError: getErrorMessage(error),
    });
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
        failed++;
      }

      pending = await getPendingItems();
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
    await updateQueueItem(item.id, { status: 'pending', retryCount: 0 });
  }
  return syncNow(queryClient);
}

export async function getSyncStatus() {
  return getQueueStats();
}
