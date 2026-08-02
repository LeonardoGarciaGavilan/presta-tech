import client from './client';

export interface QueueItemSummary {
  endpoint: string;
  method: string;
  createdAt: number;
  monto?: number;
}

export interface ReportQueueClearPayload {
  items: QueueItemSummary[];
}

/**
 * Reporta al servidor la limpieza local de operaciones fallidas de la cola
 * offline. El servidor solo deja constancia en auditoría; no borra nada.
 * Si falla (p. ej. sin conexión) no es bloqueante.
 */
export async function reportQueueClear(
  items: QueueItemSummary[],
): Promise<{ ok: boolean }> {
  const response = await client.post<{ ok: boolean }>('/sync/cola/limpiar', {
    items,
  });
  return response.data;
}
