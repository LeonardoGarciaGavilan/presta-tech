import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoPrestamo } from '@prisma/client';
import { getInicioDiaRD, getFechaRD } from '../common/utils/fecha.utils';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(empresaId: string) {
    const hoy = getInicioDiaRD();
    const inicioHoy = getInicioDiaRD();
    const fechaRD = getFechaRD();

    const [
      prestamosPorEstado,
      saldoCuotas,
      montoTotal,
      cuotasVencidas,
      clientesActivos,
      pagosHoy,
    ] = await Promise.all([
      this.prisma.prestamo.groupBy({
        by: ['estado'],
        where: { empresaId },
        _count: { id: true },
      }),

      this.prisma.cuota.aggregate({
        where: {
          pagada: false,
          prestamo: {
            empresaId,
            estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] },
          },
        },
        _sum: { capital: true, interes: true, mora: true },
      }),

      this.prisma.prestamo.aggregate({
        where: { empresaId },
        _sum: { monto: true },
      }),

      this.prisma.cuota.count({
        where: {
          pagada: false,
          fechaVencimiento: { lt: hoy },
          prestamo: { empresaId },
        },
      }),

      this.prisma.cliente.count({
        where: { empresaId, activo: true },
      }),

      this.prisma.pago.aggregate({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: inicioHoy },
        },
        _sum: { montoTotal: true },
      }),
    ]);

    const cantidades = {
      activos: 0,
      atrasados: 0,
      pagados: 0,
      cancelados: 0,
      solicitados: 0,
    };

    const estadoMap: Record<string, keyof typeof cantidades> = {
      ACTIVO: 'activos',
      ATRASADO: 'atrasados',
      PAGADO: 'pagados',
      CANCELADO: 'cancelados',
      SOLICITADO: 'solicitados',
      EN_REVISION: 'solicitados',
      APROBADO: 'solicitados',
    };

    for (const item of prestamosPorEstado) {
      const key = estadoMap[item.estado];
      if (key) {
        cantidades[key] = item._count.id;
      }
    }

    const saldoPendienteTotal =
      (saldoCuotas._sum.capital ?? 0) +
      (saldoCuotas._sum.interes ?? 0) +
      (saldoCuotas._sum.mora ?? 0);

    return {
      cantidades,
      saldoPendienteTotal: Math.round(saldoPendienteTotal * 100) / 100,
      montoTotalPrestado: montoTotal._sum.monto ?? 0,
      cuotasVencidasHoy: cuotasVencidas,
      clientesActivos,
      pagosHoy: pagosHoy._sum.montoTotal ?? 0,
    };
  }
}
