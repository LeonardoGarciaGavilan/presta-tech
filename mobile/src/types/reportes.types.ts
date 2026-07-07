// ─── Cobros por período ──────────────────────────────────────────────────────

export interface CobroItem {
  fecha: string;
  cliente: string;
  cedula: string;
  provincia: string;
  municipio: string;
  capital: number;
  interes: number;
  mora: number;
  total: number;
  metodo: string;
  referencia: string;
  cobrador: string;
}

export interface CobrosResponse {
  desde: string;
  hasta: string;
  pagina: number;
  porPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  totalCobrado: number;
  totalCapital: number;
  totalInteres: number;
  totalMora: number;
  pagos: CobroItem[];
}

// ─── Cartera vencida ─────────────────────────────────────────────────────────

export interface CarteraItem {
  cliente: string;
  cedula: string;
  telefono: string;
  provincia: string;
  municipio: string;
  montoOriginal: number;
  saldoPendiente: number;
  moraAcumulada: number;
  cuotasVencidas: number;
  diasMaxAtraso: number;
  proximaFecha: string | null;
}

export interface CarteraVencidaResponse {
  pagina: number;
  porPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  totalSaldoVencido: number;
  totalMora: number;
  prestamos: CarteraItem[];
}

// ─── Estado general de préstamos ─────────────────────────────────────────────

export interface EstadoGeneralResumen {
  activos: number;
  atrasados: number;
  pagados: number;
  cancelados: number;
  totalCartera: number;
  totalDesembolsado: number;
}

export interface EstadoItem {
  cliente: string;
  cedula: string;
  provincia: string;
  municipio: string;
  montoOriginal: number;
  saldoPendiente: number;
  tasaInteres: number;
  frecuencia: string;
  estado: string;
  cuotasPendientes: number;
  proximaFecha: string | null;
  fechaInicio: string;
}

export interface EstadoGeneralResponse {
  pagina: number;
  porPagina: number;
  totalRegistros: number;
  totalPaginas: number;
  resumen: EstadoGeneralResumen;
  prestamos: EstadoItem[];
}

// ─── Historial por cliente ───────────────────────────────────────────────────

export interface ClienteReporteInfo {
  nombre: string;
  cedula: string;
  telefono: string;
  celular: string;
  email: string;
  provincia: string;
  municipio: string;
  sector: string;
  direccion: string;
  ocupacion: string;
}

export interface CuotaPendienteDetalle {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  vencida: boolean;
}

export interface PagoClienteItem {
  fecha: string;
  capital: number;
  interes: number;
  mora: number;
  total: number;
  metodo: string;
  cobrador: string;
}

export interface PrestamoClienteReporte {
  id: string;
  monto: number;
  saldo: number;
  moraAcumulada: number;
  tasaInteres: number;
  frecuencia: string;
  estado: string;
  fechaInicio: string;
  totalCuotas: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  proximaFecha: string | null;
  proximaMonto: number | null;
  cuotasPendientesDetalle: CuotaPendienteDetalle[];
  pagos: PagoClienteItem[];
}

export interface ClienteReporteResponse {
  cliente: ClienteReporteInfo;
  totalPrestamos: number;
  prestamosActivos: number;
  totalPagado: number;
  totalSaldo: number;
  totalMora: number;
  fechaGenerado: string;
  prestamos: PrestamoClienteReporte[];
}

// ─── Reporte de cajas ────────────────────────────────────────────────────────

export interface CajasResumen {
  totalCobrado: number;
  totalCapital: number;
  totalInteres: number;
  totalMora: number;
  totalEfectivo: number;
  cantidadPagos: number;
  cantidadCajas: number;
  cajasCerradas: number;
  cajasAbiertas: number;
  efectivoSistema: number;
}

export interface PagoPorMetodo {
  cantidad: number;
  monto: number;
}

export interface CajaReporteItem {
  id: string;
  fecha: string;
  cajero: string;
  usuarioId: string;
  estado: string;
  montoInicial: number;
  montoCierre: number | null;
  diferencia: number | null;
  observaciones: string | null;
  fechaCierre: string | null;
  createdAt: string;
}

export interface PagoCajaItem {
  id: string;
  fecha: string;
  cajero: string;
  cliente: string;
  cedula: string;
  capital: number;
  interes: number;
  mora: number;
  total: number;
  metodo: string;
  referencia: string;
}

export interface ResumenPorUsuario {
  usuarioId: string;
  nombre: string;
  cajasAbiertas: number;
  cajasCerradas: number;
  totalCobrado: number;
  totalEfectivo: number;
  cantidadPagos: number;
  diferenciasPositivas: number;
  diferenciasNegativas: number;
}

export interface ResumenPorDia {
  fecha: string;
  cajasAbiertas: number;
  cajasCerradas: number;
  totalCobrado: number;
  cantidadPagos: number;
}

export interface CajasResponse {
  desde: string;
  hasta: string;
  resumen: CajasResumen;
  pagosPorMetodo: Record<string, PagoPorMetodo>;
  cajas: CajaReporteItem[];
  pagos: PagoCajaItem[];
  resumenPorUsuario: ResumenPorUsuario[];
  resumenPorDia: ResumenPorDia[];
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface CobrosFilters {
  desde: string;
  hasta: string;
  provincia?: string;
}

export interface CarteraFilters {
  provincia?: string;
}

export interface EstadoFilters {
  provincia?: string;
}

export interface CajasFilters {
  desde: string;
  hasta: string;
  usuarioId?: string;
}
