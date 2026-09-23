export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed' | 'expired';

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
  /**
   * C3: estado pre-mutación de las entidades afectadas (p. ej.
   * `{ prestamo: Prestamo }` antes de un pago offline). Se persiste en la cola
   * para revertir la mutación local si la operación falla de forma permanente.
   */
  snapshot?: unknown;
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

/**
 * Endpoints que se consideran operaciones financieras críticas.
 * Estas operaciones NO deben hacer rollback automático al expirar.
 */
export const FINANCIAL_CRITICAL_ENDPOINTS: ReadonlySet<string> = new Set([
  '/pagos',
  '/pagos/saldar',
  '/caja/abrir',
  '/caja/cerrar',
  '/prestamos/desembolsar',
  '/prestamos/refinanciar',
]);

/**
 * Determina si una operación de la cola offline es una operación financiera crítica.
 * Las operaciones financieras críticas no deben hacer rollback automático al expirar.
 */
export function isFinancialCriticalOperation(item: { endpoint: string; method: string }): boolean {
  const { endpoint, method } = item;
  
  // POST /pagos - pago normal
  if (endpoint === '/pagos' && method === 'POST') return true;
  
  // POST /pagos/saldar/:id - saldar préstamo
  if (endpoint.startsWith('/pagos/saldar/') && method === 'POST') return true;
  
  // POST /caja/abrir - abrir caja
  if (endpoint === '/caja/abrir' && method === 'POST') return true;
  
  // PATCH /caja/:id/cerrar - cerrar caja
  if (endpoint.match(/^\/caja\/[^/]+\/cerrar$/) && method === 'PATCH') return true;
  
// PATCH /prestamos/:id/desembolsar - desembolsar préstamo
  if (endpoint.match(/^\/prestamos\/[^/]+\/desembolsar$/) && method === 'PATCH') return true;

  // PATCH /prestamos/:id/refinanciar - refinanciar préstamo
  if (endpoint.match(/^\/prestamos\/[^/]+\/refinanciar$/) && method === 'PATCH') return true;

  return false;
}
