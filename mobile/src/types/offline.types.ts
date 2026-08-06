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
  /**
   * true = el fallo fue transitorio (red/5xx/408/429) y vale la pena reintentar.
   * false = error permanente (validación/conflicto) que no se resuelve solo.
   * Se usa para que `retryFailed` no reintente errores permanentes en bucle.
   */
  retryable?: boolean;
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

export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_MAX_RETRIES = 5;
export const OFFLINE_BACKOFF_BASE_MS = 1000;
