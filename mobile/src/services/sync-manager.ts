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
import { db } from '@/db';
import { offlineQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { upsertClientes, deleteCliente } from '@/db/clientes-db';
import { upsertPrestamos, deletePrestamo } from '@/db/prestamos-db';
import { upsertPagos, deletePago } from '@/db/pagos-db';

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
          const allMatching = queryClient.getQueryCache().findAll({
            queryKey: key,
            exact: false,
          });
          for (const query of allMatching) {
            queryClient.setQueryData(query.queryKey, (old: any) => {
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

        const allPending = getPendingItems();
        for (const pending of allPending) {
          const parsed = typeof pending.data === 'string' ? JSON.parse(pending.data) : JSON.parse(JSON.stringify(pending.data));
          replaceTempIdInData(parsed, item.tempId, serverData.id);
          const updatedStr = JSON.stringify(parsed);
          if (updatedStr !== JSON.stringify(pending.data)) {
            db.update(offlineQueue)
              .set({ data: updatedStr })
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
        const data = Array.isArray(response.data) ? response.data : [response.data];
        upsertPagos(data);
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
    await updateQueueItem(item.id, { status: 'pending', retryCount: 0 });
  }
  return syncNow(queryClient);
}

export async function getSyncStatus() {
  return getQueueStats();
}
