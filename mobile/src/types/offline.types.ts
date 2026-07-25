export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed';

export type OfflineMethod = 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: OfflineMethod;
  data: unknown;
  queryKeys: string[][];
  createdAt: number;
  retryCount: number;
  status: OfflineQueueStatus;
  tempId?: string;
  tempDisplay?: Record<string, unknown>;
  lastError?: string;
  idempotencyKey?: string;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
}

export interface SyncProgress {
  processed: number;
  total: number;
  current: OfflineQueueItem | null;
}

export interface PrefetchConfig {
  clientes: boolean;
  rutas: boolean;
  caja: boolean;
  prestamos: boolean;
  configuracion: boolean;
}

export const OFFLINE_QUEUE_KEY = 'sas_prestamos_offline_queue';
export const OFFLINE_MAX_QUEUE_SIZE = 200;
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_MAX_RETRIES = 5;
export const OFFLINE_BACKOFF_BASE_MS = 1000;
