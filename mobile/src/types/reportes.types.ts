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
  renovados: number;
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
  efectivoReal: number;
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

// ─── Flujo de caja ──────────────────────────────────────────────────────────

export interface FlujoDia {
  fecha: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export interface FlujoCajaResponse {
  desde: string;
  hasta: string;
  totalEntradas: number;
  totalSalidas: number;
  neto: number;
  desgloseEntradas: { pagos: number; inyecciones: number };
  desgloseSalidas: { desembolsos: number; gastos: number; retiros: number };
  gastosPorCategoria: Record<string, number>;
  porDia: FlujoDia[];
}

export interface FlujoCajaFilters {
  desde: string;
  hasta: string;
  usuarioId?: string;
}

// ─── Desempeño por cobrador ─────────────────────────────────────────────────

export interface CobradorItem {
  usuarioId: string;
  nombre: string;
  totalCobrado: number;
  totalCapital: number;
  totalInteres: number;
  totalMora: number;
  cantidadPagos: number;
  promedioPorPago: number;
  diasActivos: number;
  promedioPorDia: number;
  pagosPorMetodo: Record<string, { cantidad: number; monto: number }>;
}

export interface DesempenoCobradorResponse {
  desde: string | null;
  hasta: string | null;
  totalCobrado: number;
  totalCapital: number;
  totalInteres: number;
  totalMora: number;
  cantidadPagos: number;
  cobradores: CobradorItem[];
}

export interface DesempenoFilters {
  desde?: string;
  hasta?: string;
  usuarioId?: string;
}

// ─── Proyección de cuotas ───────────────────────────────────────────────────

export interface ProyeccionMes {
  month: string;
  cantidadCuotas: number;
  montoCapital: number;
  montoInteres: number;
  montoMora: number;
  montoTotal: number;
  vencidas: number;
}

export interface ProyeccionDetalle {
  cliente: string;
  cedula: string;
  provincia: string;
  prestamoId: string;
  numeroCuota: number;
  monto: number;
  fechaVencimiento: string;
  vencida: boolean;
}

export interface ProyeccionCuotasResponse {
  totalPrestamos: number;
  totalCuotasPendientes: number;
  totalMontoPendiente: number;
  totalVencidas: number;
  porMes: ProyeccionMes[];
  detalles: ProyeccionDetalle[];
}

export interface ProyeccionFilters {
  provincia?: string;
}
