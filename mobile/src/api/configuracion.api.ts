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
  /** Switch maestro de refinanciamiento de préstamos. Default true. */
  permitirRefinanciamiento?: boolean;
  /**
   * Máximo de préstamos simultáneos por cliente contando solo ACTIVO y ATRASADO.
   * 0 = sin límite.
   */
  maxPrestamosActivosPorCliente?: number;
  /** Switch maestro de renovación de préstamos. Default false. */
  permitirRenovacion?: boolean;
  /** Renovación permitida solo con X cuotas pendientes o menos. 0 = sin restricción. */
  maxCuotasRestantesParaRenovacion?: number;
  /** Si false, el interés futuro de cuotas pendientes NO se cobra al renovar. Default true. */
  incluirInteresEnRenovacion?: boolean;
  /** Máximo porcentaje del monto nuevo que puede cubrir el saldo aplicado (1-100). */
  porcentajeMaximoSaldoAplicado?: number;
  /** Máximo de renovaciones encadenadas por préstamo. 0 = sin límite. */
  maxRenovacionesConsecutivas?: number;
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
  permitirRefinanciamiento?: boolean;
  /** Máximo de préstamos activos (ACTIVO/ATRASADO) por cliente. 0 = sin límite. */
  maxPrestamosActivosPorCliente?: number;
  permitirRenovacion?: boolean;
  maxCuotasRestantesParaRenovacion?: number;
  incluirInteresEnRenovacion?: boolean;
  porcentajeMaximoSaldoAplicado?: number;
  maxRenovacionesConsecutivas?: number;
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
