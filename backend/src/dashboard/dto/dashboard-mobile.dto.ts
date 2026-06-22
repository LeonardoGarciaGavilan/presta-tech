export class PortfolioDto {
  activos: number;
  atrasados: number;
  montoTotalPrestado: number;
  saldoPendienteTotal: number;
}

export class TodayDto {
  cobradoHoy: number;
  pagosHoy: number;
  cobradoMes: number;
  cuotasPendientesHoy: number;
  montoEsperadoHoy: number;
  prestamosMoraCritica: number;
}

export class CajaActivaDto {
  id: string;
  montoInicial: number;
  totalIngresos: number;
  createdAt: Date;
}

export class ProximoCobroDto {
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

export class DashboardMobileResponseDto {
  portfolio: PortfolioDto;
  today: TodayDto;
  caja: CajaActivaDto | null;
  proximosCobros: ProximoCobroDto[];
}
