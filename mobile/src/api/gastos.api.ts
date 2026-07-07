import client from './client';
import type {
  Gasto,
  CreateGastoDto,
  UpdateGastoDto,
  GastosResumen,
  GastosFilters,
} from '@/types/gastos.types';

export async function getGastos(filters?: GastosFilters): Promise<Gasto[]> {
  const response = await client.get<Gasto[]>('/gastos', { params: filters });
  return response.data;
}

export async function getGastosResumen(): Promise<GastosResumen> {
  const response = await client.get<GastosResumen>('/gastos/resumen');
  return response.data;
}

export async function crearGasto(data: CreateGastoDto): Promise<Gasto> {
  const response = await client.post<Gasto>('/gastos', data);
  return response.data;
}

export async function actualizarGasto(id: string, data: UpdateGastoDto): Promise<Gasto> {
  const response = await client.put<Gasto>(`/gastos/${id}`, data);
  return response.data;
}

export async function eliminarGasto(id: string): Promise<{ mensaje: string }> {
  const response = await client.delete<{ mensaje: string }>(`/gastos/${id}`);
  return response.data;
}
