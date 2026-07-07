import client from './client';

export interface ConfiguracionResponse {
  id?: string;
  tasaInteresBase: number;
  moraPorcentajeMensual: number;
  diasGracia: number;
  permitirAbonoCapital: boolean;
  montoMinimoPrestamo: number;
  montoMaximoPrestamo: number | null;
  montoMaximoPago: number | null;
  empresaId: string;
  existe: boolean;
}

export interface UpsertConfiguracionRequest {
  tasaInteresBase: number;
  moraPorcentajeMensual: number;
  diasGracia: number;
  permitirAbonoCapital: boolean;
  montoMinimoPrestamo?: number;
  montoMaximoPrestamo?: number | null;
  montoMaximoPago?: number | null;
}

export async function obtenerConfiguracion(): Promise<ConfiguracionResponse> {
  const response = await client.get<ConfiguracionResponse>('/configuracion');
  return response.data;
}

export async function guardarConfiguracion(
  data: UpsertConfiguracionRequest,
): Promise<ConfiguracionResponse> {
  const response = await client.put<ConfiguracionResponse>('/configuracion', data);
  return response.data;
}
