export interface Portfolio {
  activos: number;
  atrasados: number;
  montoTotalPrestado: number;
  saldoPendienteTotal: number;
}

export interface Today {
  cobradoHoy: number;
  pagosHoy: number;
  cobradoMes: number;
  cuotasPendientesHoy: number;
  montoEsperadoHoy: number;
  prestamosMoraCritica: number;
}

export interface CajaActiva {
  id: string;
  montoInicial: number;
  totalIngresos: number;
  createdAt: string;
}

export interface ProximoCobro {
  cuotaId: string;
  numero: number;
  monto: number;
  mora: number;
  prestamoId: string;
  clienteId: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
}

export interface DashboardMobileData {
  portfolio: Portfolio;
  today: Today;
  caja: CajaActiva | null;
  proximosCobros: ProximoCobro[];
}
