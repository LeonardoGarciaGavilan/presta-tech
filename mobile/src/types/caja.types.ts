export type EstadoCaja = 'ABIERTA' | 'CERRADA';
export type TipoMovimiento =
  | 'APERTURA_CAJA'
  | 'PAGO_RECIBIDO'
  | 'DESEMBOLSO'
  | 'GASTO'
  | 'RETIRO_GANANCIAS'
  | 'CIERRE_CAJA'
  | 'INYECCION_CAPITAL'
  | 'AJUSTE_CAJA'
  | 'CORRECCION';

export interface CajaSesion {
  id: string;
  fecha: string;
  montoInicial: number;
  estado: EstadoCaja;
  montoCierre: number | null;
  diferencia: number | null;
  observaciones: string | null;
  fechaCierre: string | null;
  createdAt: string;
  empresaId: string;
  usuarioId: string;
  totalIngresos: number;
  totalEgresos: number;
  usuario?: { id: string; nombre: string };
  resumen?: CajaResumen;
  ingresosCalc?: number;
  egresosCalc?: number;
  esperadoCalc?: number;
}

export interface MovimientoTimeline {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  monto: number;
  descripcion: string;
  prestamoId?: string;
}

export interface Reconstruccion {
  inicial: number;
  ingresos: number;
  egresos: number;
  esperado: number;
  real: number | null;
  diferencia: number;
}

export interface Validaciones {
  secuenciaValida: boolean;
  diferenciaJustificada: boolean;
  alertas: string[];
}

export interface AuditoriaResponse {
  caja: CajaSesion;
  timeline: MovimientoTimeline[];
  reconstruccion: Reconstruccion;
  validaciones: Validaciones;
}

export interface CajaResumen {
  totalCobrado: number;
  totalEfectivo: number;
  totalCapital: number;
  totalInteres: number;
  totalMora: number;
  totalDesembolsado: number;
  cantidadDesembolsos: number;
  efectivoSistema: number;
  cantidadPagos: number;
  cantidadCajas: number;
  cajasAbiertas: number;
}

export interface CajaActivaResponse {
  id: string;
  fecha: string;
  montoInicial: number;
  estado: EstadoCaja;
  montoCierre: number | null;
  diferencia: number | null;
  observaciones: string | null;
  fechaCierre: string | null;
  createdAt: string;
  empresaId: string;
  usuarioId: string;
  totalIngresos: number;
  totalEgresos: number;
  usuario: { id: string; nombre: string };
  resumen: {
    totalCobrado: number;
    totalEfectivo: number;
    totalCapital: number;
    totalInteres: number;
    totalMora: number;
    totalDesembolsado: number;
    cantidadDesembolsos: number;
    efectivoSistema: number;
    efectivoEnCaja: number;
    cantidadPagos: number;
    pagosPorMetodo: Record<string, { cantidad: number; monto: number }>;
    pagos: Array<{
      id: string;
      montoTotal: number;
      capital: number;
      interes: number;
      mora: number;
      metodo: string;
      createdAt: string;
      usuario: { nombre: string };
      prestamo: { cliente: { nombre: string; apellido: string | null } };
    }>;
    desembolsos: Array<{
      id: string;
      monto: number;
      concepto: string;
      createdAt: string;
      prestamo: { cliente: { nombre: string; apellido: string | null } };
    }>;
  };
}

export interface AbrirCajaDto {
  montoInicial: number;
  fecha?: string;
}

export interface CerrarCajaDto {
  montoCierre: number;
  observaciones?: string;
}
