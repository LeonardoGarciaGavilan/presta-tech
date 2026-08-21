import client from './client';
import type { Pago, PagoConPrestamo, PagoResponse, PagosResumen, CreatePagoDto, SaldarPrestamoDto } from '@/types/prestamo.types';

const ENDPOINT = '/pagos';

export type { PagoConPrestamo } from '@/types/prestamo.types';

export async function registrarPago(
  dto: CreatePagoDto,
  idempotencyKey?: string,
) {
  const response = await client.post(
    ENDPOINT,
    idempotencyKey ? { ...dto, idempotencyKey } : dto,
  );
  return response.data;
}

export async function obtenerPagos(prestamoId: string): Promise<Pago[]> {
  const response = await client.get(`${ENDPOINT}/prestamo/${prestamoId}`);
  return response.data;
}

export async function obtenerPago(id: string): Promise<PagoResponse> {
  const response = await client.get(`${ENDPOINT}/${id}`);
  return response.data;
}

export async function obtenerResumenPagos(): Promise<PagosResumen> {
  const response = await client.get(`${ENDPOINT}/resumen`);
  return response.data;
}

export async function saldarPrestamo(
  prestamoId: string,
  dto: SaldarPrestamoDto,
  idempotencyKey?: string,
) {
  const response = await client.post(
    `${ENDPOINT}/saldar/${prestamoId}`,
    idempotencyKey ? { ...dto, idempotencyKey } : dto,
  );
  return response.data;
}

export async function obtenerTodosPagos(): Promise<PagoConPrestamo[]> {
  const response = await client.get(ENDPOINT);
  return response.data;
}
