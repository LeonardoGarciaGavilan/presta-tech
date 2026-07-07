import client from './client';
import type { CajaSesion, CajaActivaResponse, AbrirCajaDto, CerrarCajaDto, AuditoriaResponse } from '@/types/caja.types';

const ENDPOINT = '/caja';

export async function obtenerCajaActiva(fecha?: string): Promise<CajaActivaResponse | null> {
  const params = fecha ? { fecha } : {};
  const response = await client.get(`${ENDPOINT}/activa`, { params });
  return response.data;
}

export async function abrirCaja(dto: AbrirCajaDto): Promise<CajaSesion> {
  const response = await client.post(`${ENDPOINT}/abrir`, dto);
  return response.data;
}

export async function cerrarCaja(id: string, dto: CerrarCajaDto): Promise<{
  cajaId: string;
  esperado: number;
  montoCierre: number;
  diferencia: number;
  estado: string;
}> {
  const response = await client.patch(`${ENDPOINT}/${id}/cerrar`, dto);
  return response.data;
}

export async function obtenerHistorialCajas(): Promise<CajaSesion[]> {
  const response = await client.get(`${ENDPOINT}/historial`);
  return response.data;
}

export async function obtenerResumenCaja(fecha?: string, cajaId?: string) {
  const params: Record<string, string> = {};
  if (fecha) params.fecha = fecha;
  if (cajaId) params.cajaId = cajaId;
  const response = await client.get(`${ENDPOINT}/resumen`, { params });
  return response.data;
}

export async function obtenerAuditoriaCaja(id: string): Promise<AuditoriaResponse> {
  const response = await client.get(`${ENDPOINT}/${id}/auditoria`);
  return response.data;
}

export async function obtenerCajas(estado?: string): Promise<CajaSesion[]> {
  const params = estado ? { estado } : {};
  const response = await client.get(ENDPOINT, { params });
  return response.data;
}
