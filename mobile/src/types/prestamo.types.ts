export type EstadoPrestamo =
  | 'SOLICITADO'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ACTIVO'
  | 'ATRASADO'
  | 'PAGADO'
  | 'CANCELADO'
  | 'RENOVADO';

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
  | 'RENOVACION'
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
  /** Fecha (YYYY-MM-DD, zona RD) en que se realizó el pago, para la caja del día correcto en sync offline. */
  fecha?: string;
}

export interface SaldarPrestamoDto {
  metodo: string;
  referencia?: string;
  observacion?: string;
  /** Fecha (YYYY-MM-DD, zona RD) en que se saldó, para la caja del día correcto en sync offline. */
  fecha?: string;
}

export interface PagosResumen {
  cobradoHoy: number;
  cobradoMes: number;
  pagosHoy: number;
  pagosMes: number;
}

export interface PagoConPrestamo extends Pago {
  prestamo: {
    id: string;
    monto: number;
    saldoPendiente: number;
    cliente: {
      id: string;
      nombre: string;
      apellido: string | null;
      cedula: string;
    };
  };
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

export type TipoOrigenPrestamo =
  | 'NORMAL'
  | 'REFINANCIAMIENTO'
  | 'RENOVACION';

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
  /** Origen del préstamo: normal, refinanciado o nacido de una renovación. */
  origen?: TipoOrigenPrestamo;
  /** Si origen=RENOVACION, id del préstamo anterior que fue liquidado. */
  renovacionDeId?: string | null;
  /** Cantidad de renovaciones encadenadas que preceden a este préstamo. */
  cadenaRenovaciones?: number;
  /** Snapshot de la liquidación aplicada al renovar (saldo, cuotas viejas). */
  historialRenovacion?: any | null;
  motivoRechazo: string | null;
  /** Motivo guardado al cancelar (solo estados CANCELADO). */
  motivoCancelacion?: string | null;
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
  /** Marcado por hooks offline para que las pantallas distingan datos encolados. */
  esOffline?: boolean;
}

export interface PrestamoResumen {
  cantidad: {
    activos: number;
    atrasados: number;
    pagados: number;
    cancelados: number;
    solicitudes: number;
    renovados: number;
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
  /** Tasa de interés en %. Obligatoria en modo normal (0.1-100). En modo rápido se envía 0 u se omite. */
  nuevaTasa?: number;
  nuevaFrecuencia?: FrecuenciaPago;
  nuevaFechaPago?: string;
  /** Modo rápido: cuota fija plana desde montoTotal sobre el saldo refinanciado (igual que crear/renovar rápido). */
  modoRapido?: boolean;
  /** Total a cobrar en modo rápido. Obligatorio si modoRapido=true; debe superar el saldo refinanciado. */
  montoTotal?: number;
  motivo?: string;
}

/** DTO para renovar un préstamo: liquida el viejo y crea uno nuevo ACTIVO. */
export interface RenovarPrestamoDto {
  /** Monto del préstamo nuevo (debe ser mayor al saldo anterior aplicado). */
  montoNuevo: number;
  /** En modo rápido se envía 0. */
  tasaInteres: number;
  /** En modo rápido = duración. */
  numeroCuotas: number;
  frecuenciaPago?: FrecuenciaPago;
  fechaInicio?: string;
  /** Modo rápido: cuota fija plana desde montoTotal (igual que crear rápido). */
  modoRapido?: boolean;
  /** Total a cobrar en modo rápido. Obligatorio si modoRapido=true. */
  montoTotal?: number;
  motivo?: string;
}

/** Liquidación desglosada del préstamo que se renueva. */
export interface LiquidacionRenovacion {
  capital: number;
  interes: number;
  mora: number;
  total: number;
}

/** Respuesta del backend al renovar: préstamo viejo RENOVADO + nuevo ACTIVO. */
export interface RespuestaRenovacion {
  prestamoAnterior: Prestamo;
  prestamoNuevo: Prestamo;
  liquidacion: LiquidacionRenovacion;
  /** Efectivo físico entregado = montoNuevo - saldoAplicado (> 0). */
  desembolsoNeto: number;
  advertencias?: string[];
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

/** Resultado de una mutación que puede haber sido encolada offline. */
export interface OfflineResult {
  esOffline: true;
  tempId?: string;
  id?: string;
  [key: string]: unknown;
}
