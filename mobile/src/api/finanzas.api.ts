import client from './client';
import type {
  DashboardResponse,
  MovimientoFinanciero,
  BalanceResponse,
  CapitalResponse,
  CreateInyeccionDto,
  CreateRetiroDto,
  InyeccionCapital,
  RetiroCapitalResponse,
  CapitalRetirableResponse,
  GananciasDisponiblesResponse,
} from '@/types/finanzas.types';

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await client.get<DashboardResponse>('/finanzas/dashboard');
  return response.data;
}

export async function getMovimientos(limite = 50): Promise<MovimientoFinanciero[]> {
  const response = await client.get<MovimientoFinanciero[]>('/finanzas/movimientos', {
    params: { limite },
  });
  return response.data;
}

export async function getBalance(): Promise<BalanceResponse> {
  const response = await client.get<BalanceResponse>('/finanzas/balance');
  return response.data;
}

export async function getCapital(): Promise<CapitalResponse> {
  const response = await client.get<CapitalResponse>('/finanzas/capital');
  return response.data;
}

export async function crearInyeccion(data: CreateInyeccionDto): Promise<InyeccionCapital> {
  const response = await client.post<InyeccionCapital>('/finanzas/inyeccion', data);
  return response.data;
}

export async function crearRetiroGanancias(data: CreateRetiroDto): Promise<void> {
  await client.post('/finanzas/retiro', data);
}

export async function retirarCapital(data: CreateRetiroDto): Promise<RetiroCapitalResponse> {
  const response = await client.post<RetiroCapitalResponse>('/finanzas/retiro-capital', data);
  return response.data;
}

export async function getCapitalRetirable(): Promise<CapitalRetirableResponse> {
  const response = await client.get<CapitalRetirableResponse>('/finanzas/capital-retirable');
  return response.data;
}

export async function getGananciasDisponibles(): Promise<GananciasDisponiblesResponse> {
  const response = await client.get<GananciasDisponiblesResponse>('/finanzas/ganancias-disponibles');
  return response.data;
}
