export type EstadoPrestamo =
  | 'SOLICITADO'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ACTIVO'
  | 'ATRASADO'
  | 'PAGADO'
  | 'CANCELADO';

export type FrecuenciaPago =
  | 'DIARIO'
  | 'SEMANAL'
  | 'QUINCENAL'
  | 'MENSUAL';

export type MetodoPago =
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'TARJETA'
  | 'CHEQUE';

export type TipoAlerta =
  | 'SOLICITUD'
  | 'REFINANCIAMIENTO'
  | 'CAMBIO_FRECUENCIA'
  | 'CAMBIO_TASA'
  | 'CAMBIO_CUOTAS'
  | 'CAMBIO_FECHA_PAGO'
  | 'CANCELACION'
  | 'CAMBIO_ESTADO';

export interface Cuota {
  id: string;
  numero: number;
  monto: number;
  capital: number;
  interes: number;
  mora: number;
  fechaVencimiento: string;
  pagada: boolean;
  fechaPago: string | null;
  createdAt: string;
  prestamoId: string;
}

export interface Pago {
  id: string;
  montoTotal: number;
  capital: number;
  interes: number;
  mora: number;
  metodo: MetodoPago;
  referencia: string | null;
  observacion: string | null;
  createdAt: string;
  usuarioId: string;
  prestamoId: string;
  cajaId: string | null;
  usuario?: { id: string; nombre: string };
}

export interface CreatePagoDto {
  prestamoId: string;
  cuotaId?: string;
  montoPagado: number;
  metodo: MetodoPago;
  referencia?: string;
  observacion?: string;
}

export interface SaldarPrestamoDto {
  metodo: string;
  referencia?: string;
  observacion?: string;
}

export interface PagosResumen {
  cobradoHoy: number;
  cobradoMes: number;
  pagosHoy: number;
  pagosMes: number;
}

export interface PagoResponse {
  pago: {
    id: string;
    createdAt: string;
    montoTotal: number;
    capital: number;
    interes: number;
    mora: number;
    abonoCapital: number;
    pagoCompleto: boolean;
    metodo: MetodoPago;
    referencia: string | null;
    observacion: string | null;
  };
  prestamo: {
    id: string;
    monto: number;
    numeroCuotas: number;
    frecuenciaPago: FrecuenciaPago;
    tasaInteres: number;
    saldoPendiente: number;
  };
  cliente: {
    nombre: string;
    apellido: string | null;
    cedula: string;
  };
  cuota: {
    id: string;
    numero: number;
    monto: number;
    capital: number;
    interes: number;
    mora: number;
    fechaVencimiento: string;
    pagoCompleto: boolean;
  } | null;
  usuario: {
    nombre: string;
  };
}

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  descripcion: string;
  clienteNombre: string;
  detalle: Record<string, any> | null;
  leida: boolean;
  usuarioId: string;
  usuarioNombre: string;
  createdAt: string;
  empresaId: string;
  prestamoId: string;
}

export interface ClienteResumen {
  id: string;
  nombre: string;
  apellido: string | null;
  cedula: string;
  telefono: string | null;
  celular: string | null;
}

export interface Prestamo {
  id: string;
  monto: number;
  tasaInteres: number;
  numeroCuotas: number;
  montoTotal: number;
  saldoPendiente: number;
  cuotaMensual: number;
  frecuenciaPago: FrecuenciaPago;
  fechaInicio: string;
  fechaVencimiento: string;
  moraAcumulada: number;
  estado: EstadoPrestamo;
  refinanciado: boolean;
  vecesRefinanciado: number;
  historialRefinanciamiento: any | null;
  motivoRechazo: string | null;
  solicitadoPor: string | null;
  aprobadoPor: string | null;
  fechaAprobacion: string | null;
  fechaDesembolso: string | null;
  modoRapido: boolean;
  createdAt: string;
  empresaId: string;
  clienteId: string;
  garanteId: string | null;
  cliente: ClienteResumen;
  garante?: ClienteResumen | null;
  cuotas: Cuota[];
  pagos: Pago[];
  alertas?: Alerta[];
}

export interface PrestamoResumen {
  cantidad: {
    activos: number;
    atrasados: number;
    pagados: number;
    cancelados: number;
    solicitudes: number;
  };
  saldoPendienteTotal: number;
  montoTotalPrestado: number;
  cuotasVencidasHoy: number;
}

export interface CreatePrestamoRequest {
  clienteId: string;
  monto: number;
  tasaInteres: number;
  numeroCuotas: number;
  frecuenciaPago: FrecuenciaPago;
  fechaInicio?: string;
  garanteId?: string;
  modoRapido?: boolean;
  montoTotal?: number;
}

export interface UpdatePrestamoRequest {
  estado?: EstadoPrestamo;
}

export interface CambiarEstadoDto {
  estado: EstadoPrestamo;
  motivo?: string;
}

export interface RefinanciarPrestamoDto {
  nuevasCuotas: number;
  nuevaTasa: number;
  nuevaFrecuencia?: FrecuenciaPago;
  nuevaFechaPago?: string;
  motivo?: string;
}

export interface CalcularTablaDto {
  monto: number;
  tasaInteres: number;
  numeroCuotas: number;
  frecuenciaPago: FrecuenciaPago;
  fechaInicio?: string;
}

export interface CuotaPreview {
  numero: number;
  monto: number;
  capital: number;
  interes: number;
  fechaVencimiento: string;
  saldoRestante: number;
}

export interface TablaAmortizacion {
  montoTotal: number;
  totalIntereses: number;
  cuotaInicial: number;
  tasaPeriodo: number;
  cuotas: CuotaPreview[];
}

export interface PrestamosFilters {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoPrestamo | '';
}

export interface PaginatedPrestamosResponse {
  data: Prestamo[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}
