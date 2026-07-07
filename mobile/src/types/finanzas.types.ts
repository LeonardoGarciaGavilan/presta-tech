export interface CapitalInfo {
  total: number;
  original: number;
  reducidoPorPerdidas: number;
  inicial: number;
  totalInyecciones: number;
  tieneRegistro: boolean;
  retirable: number;
}

export interface GananciasInfo {
  netas: number;
  brutas: number;
  gastos: number;
  totalInteresCobrado: number;
  totalRetiros: number;
}

export interface DineroInfo {
  enCaja: number;
  enCajaBase: number;
  enCalle: number;
  total: number;
}

export interface ResumenFinanciero {
  totalCobrado: number;
  totalInteres: number;
  totalMora: number;
  totalGastos: number;
  totalDesembolsos: number;
  balanceNeto: number;
}

export interface Metricas {
  rentabilidad: number | null;
  eficienciaCobranza: number | null;
  dineroOcioso: number;
  crecimientoMensual: number;
}

export interface AlertaFinanciera {
  tipo: 'INFO' | 'WARNING' | 'CRITICAL';
  mensaje: string;
  codigo: string;
  valor: number;
  umbral: number;
}

export interface DashboardResponse {
  capital: CapitalInfo;
  ganancias: GananciasInfo;
  dinero: DineroInfo;
  resumen: ResumenFinanciero;
  metricas: Metricas;
  alertas: AlertaFinanciera[];
  timestamp: string;
}

export type MovimientoTipo =
  | 'INYECCION_CAPITAL'
  | 'PAGO_RECIBIDO'
  | 'DESEMBOLSO'
  | 'GASTO'
  | 'RETIRO_GANANCIAS'
  | 'CIERRE_CAJA'
  | 'CORRECCION'
  | 'APERTURA_CAJA'
  | 'GASTO_CAPITAL'
  | 'AJUSTE_CAJA'
  | 'RETIRO_CAPITAL';

export interface MovimientoFinanciero {
  id: string;
  empresaId: string;
  tipo: MovimientoTipo;
  monto: number;
  capital: number;
  interes: number;
  mora: number;
  fecha: string;
  descripcion: string | null;
  referenciaTipo: string | null;
  referenciaId: string | null;
  cajaId: string | null;
  usuarioId: string | null;
  usuario?: { nombre: string };
}

export interface BalanceResponse {
  capital: number;
  gananciasNetas: number;
  caja: number;
  fondoGeneral: number;
  calle: number;
  retiros: number;
  patrimonio: number;
  activos: number;
  diferencia: number;
  cuadra: boolean;
  advertencia: string | null;
}

export interface CapitalResponse {
  capitalInicial: number;
  capitalTotal: number;
  totalInyecciones: number;
  totalRetirosCapital: number;
  tieneCapitalRegistrado: boolean;
  fechaRegistro: string | null;
  observaciones: string | null;
  inyecciones: InyeccionCapital[];
}

export interface InyeccionCapital {
  id: string;
  empresaId: string;
  monto: number;
  fecha: string;
  concepto: string;
  usuarioId: string;
  usuario: { nombre: string };
}

export interface CreateInyeccionDto {
  monto: number;
  concepto: string;
}

export interface CreateRetiroDto {
  monto: number;
  concepto: string;
}

export interface RetiroCapitalResponse {
  mensaje: string;
  monto: number;
  capitalRetirado: number;
}

export interface CapitalRetirableResponse {
  capitalRetirable: number;
}

export interface GananciasDisponiblesResponse {
  disponibles: number;
}
