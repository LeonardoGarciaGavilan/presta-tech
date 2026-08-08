import client from './client';
import type { Cliente } from '@/types/cliente.types';
import type { Prestamo } from '@/types/prestamo.types';
import type { Ruta, RutaCliente } from '@/types/rutas.types';
import type { ConfiguracionResponse } from '@/api/configuracion.api';

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
 * Respuesta de `GET /sync/cambios`: snapshot o delta de los datos del tenant.
 * `serverTime` se guarda como cursor para la siguiente descarga incremental.
 */
export interface CambiosSyncResponse {
  serverTime: string;
  clientes: Cliente[];
  prestamos: Prestamo[];
  rutas: Ruta[];
  rutaClientes: RutaCliente[];
  configuracion: ConfiguracionResponse | null;
}

/**
 * Descarga los datos para modo offline.
 *
 * - Con `desde`: solo registros modificados después de esa fecha (incremental).
 * - Sin `desde`: snapshot completo (lo usa el botón "Forzar recarga").
 */
export async function getCambios(desde?: string): Promise<CambiosSyncResponse> {
  const response = await client.get<CambiosSyncResponse>('/sync/cambios', {
    params: desde ? { desde } : {},
  });
  return response.data;
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
