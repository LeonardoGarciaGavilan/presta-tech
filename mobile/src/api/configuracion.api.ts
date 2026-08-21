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
  /** Renovar solo cuando faltan X cuotas o menos. 0 = sin restricción. */
  cuotasRestantesParaRenovar?: number;
  /** Máximo de refinanciamientos por préstamo. 0 = sin límite. */
  maxRefinanciamientosPorPrestamo?: number;
  /**
   * Máximo de préstamos simultáneos por cliente contando solo ACTIVO y ATRASADO.
   * 0 = sin límite.
   */
  maxPrestamosActivosPorCliente?: number;
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
  cuotasRestantesParaRenovar?: number;
  maxRefinanciamientosPorPrestamo?: number;
  /** Máximo de préstamos activos (ACTIVO/ATRASADO) por cliente. 0 = sin límite. */
  maxPrestamosActivosPorCliente?: number;
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
