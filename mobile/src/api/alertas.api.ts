import client from './client';
import type { Alerta } from '@/types/prestamo.types';

export interface AlertasFilters {
  desde?: string;
  hasta?: string;
  soloNoLeidas?: boolean;
}

export async function getAlertas(filters?: AlertasFilters): Promise<Alerta[]> {
  const params: Record<string, string> = {};
  if (filters?.desde) params.desde = filters.desde;
  if (filters?.hasta) params.hasta = filters.hasta;
  if (filters?.soloNoLeidas) params.soloNoLeidas = 'true';
  const response = await client.get<Alerta[]>('/prestamos/alertas', { params });
  return response.data;
}

export async function contarAlertas(): Promise<number> {
  const response = await client.get<{ count: number }>('/prestamos/alertas/contador');
  return response.data.count;
}

export async function marcarLeida(alertaId: string): Promise<Alerta> {
  const response = await client.patch<Alerta>(`/prestamos/alertas/${alertaId}/leer`);
  return response.data;
}

export async function marcarTodasLeidas(): Promise<void> {
  await client.patch('/prestamos/alertas/marcar-todas');
}
