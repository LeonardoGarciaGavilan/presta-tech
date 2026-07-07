import client from './client';
import type { Auditoria, AuditoriaFilters } from '@/types/auditoria.types';

export async function getAuditoria(filters?: AuditoriaFilters): Promise<Auditoria[]> {
  const response = await client.get<Auditoria[]>('/auditoria', { params: filters });
  return response.data;
}
