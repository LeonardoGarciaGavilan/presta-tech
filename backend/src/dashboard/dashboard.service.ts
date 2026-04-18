import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoPrestamo } from '@prisma/client';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';
import { format, subMonths, startOfMonth, endOfMonth, addDays, startOfDay, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE_RD = 'America/Santo_Domingo';
const NOMBRES_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(empresaId: string) {
    const hoy = getInicioDiaRD();
    const finHoy = getFinDiaRD();
    const inicioMesActual = startOfMonth(new Date());
    const finMesActual = getFinDiaRD();
    const hace6Meses = subMonths(new Date(), 5);
    const inicioHace6Meses = startOfMonth(hace6Meses);

    // Consultas paralelas para KPIs y pagos
    const [
      prestamosPorEstado,
      saldoCuotas,
      montoTotal,
      cuotasVencidas,
      clientesActivos,
      pagosTotales,
      pagosDelMes,
      cobrosGrafico,
      desembolsosGrafico,
    ] = await Promise.all([
      // Préstamos por estado
      this.prisma.prestamo.groupBy({
        by: ['estado'],
        where: { empresaId },
        _count: { id: true },
      }),

      // Saldo pendiente calculado desde cuotas (más preciso)
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

      // Monto total prestado
      this.prisma.prestamo.aggregate({
        where: { empresaId },
        _sum: { monto: true },
      }),

      // Cuotas vencidas
      this.prisma.cuota.count({
        where: {
          pagada: false,
          fechaVencimiento: { lt: hoy },
          prestamo: { empresaId },
        },
      }),

      // Clientes activos
      this.prisma.cliente.count({
        where: { empresaId, activo: true },
      }),

      // Pagos de hoy (suma y conteo)
      this.prisma.pago.aggregate({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: hoy, lte: finHoy },
        },
        _sum: { montoTotal: true },
      }),

      // Pagos del mes (suma y conteo)
      this.prisma.pago.aggregate({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: inicioMesActual, lte: finMesActual },
        },
        _sum: { montoTotal: true },
      }),

      // COBROS: Una sola query con groupBy por año-mes
      this.prisma.$queryRaw`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as mes_key,
          EXTRACT(MONTH FROM "createdAt")::int as mes_num,
          COALESCE(SUM("montoTotal"), 0)::numeric as monto
        FROM "Pago"
        WHERE "prestamoId" IN (SELECT id FROM "Prestamo" WHERE "empresaId" = ${empresaId})
          AND "createdAt" >= ${inicioHace6Meses}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `,

      // DESEMBOLSOS: Una sola query con groupBy por año-mes
      this.prisma.$queryRaw`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as mes_key,
          EXTRACT(MONTH FROM "createdAt")::int as mes_num,
          COALESCE(SUM(monto), 0)::numeric as monto
        FROM "DesembolsoCaja"
        WHERE "empresaId" = ${empresaId}
          AND "createdAt" >= ${inicioHace6Meses}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `,
    ]);

    // Procesar cantidades por estado
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
      if (key) cantidades[key] = item._count.id;
    }

    // Calcular saldo pendiente real desde cuotas
    const saldoPendienteTotal = Math.round(
      ((saldoCuotas._sum.capital ?? 0) +
        (saldoCuotas._sum.interes ?? 0) +
        (saldoCuotas._sum.mora ?? 0)) * 100
    ) / 100;

    // Procesar cobros por mes del resultado raw
    const cobrosPorMes = this.procesarGraficoMensual(cobrosGrafico);

    // Procesar desembolsos por mes del resultado raw
    const desembolsosPorMes = this.procesarGraficoMensual(desembolsosGrafico);

    // Consultas para listas
    const [clientesRecientes, prestamosAtrasados, proximasCuotas] = await Promise.all([
      this.obtenerClientesRecientes(empresaId),
      this.obtenerPrestamosAtrasados(empresaId),
      this.obtenerProximasCuotas(empresaId),
    ]);

    // Estructura de respuesta
    return {
      kpis: {
        cantidades,
        saldoPendienteTotal,
        montoTotalPrestado: montoTotal._sum.monto ?? 0,
        cuotasVencidasHoy: cuotasVencidas,
        clientesActivos,
      },
      pagos: {
        cobradoHoy: Math.round((pagosTotales._sum.montoTotal ?? 0) * 100) / 100,
        cobradoMes: Math.round((pagosDelMes._sum.montoTotal ?? 0) * 100) / 100,
        pagosHoy: 0,
        pagosMes: 0,
      },
      graficos: {
        cobrosPorMes,
        desembolsosPorMes,
      },
      listas: {
        clientesRecientes,
        prestamosAtrasados,
        proximasCuotas,
      },
    };
  }

  private procesarGraficoMensual(datosRaw: unknown): { mes: string; monto: number }[] {
    const datos = datosRaw as { mes_key: string; monto: number }[] || [];
    
    const ahora = new Date();
    const resultado: { mes: string; monto: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const fecha = subMonths(ahora, i);
      const zonedDate = toZonedTime(fecha, TIMEZONE_RD);
      const nombreMes = NOMBRES_MESES[zonedDate.getMonth()];
      const mesKey = `${zonedDate.getFullYear()}-${String(zonedDate.getMonth() + 1).padStart(2, '0')}`;

      const dato = datos.find((d) => d.mes_key === mesKey);

      resultado.push({
        mes: nombreMes,
        monto: Math.round((dato?.monto ? Number(dato.monto) : 0) * 100) / 100,
      });
    }

    return resultado;
  }

  private async obtenerClientesRecientes(empresaId: string) {
    const clientes = await this.prisma.cliente.findMany({
      where: { empresaId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        cedula: true,
        telefono: true,
        celular: true,
        activo: true,
        createdAt: true,
        prestamos: {
          where: { estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] } },
          select: { id: true },
        },
      },
    });

    return clientes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido ?? '',
      cedula: c.cedula,
      telefono: c.telefono ?? c.celular ?? '',
      activo: c.activo,
      createdAt: c.createdAt,
      tienePrestamoActivo: c.prestamos.length > 0,
    }));
  }

  private async obtenerPrestamosAtrasados(empresaId: string) {
    const prestamos = await this.prisma.prestamo.findMany({
      where: {
        empresaId,
        estado: EstadoPrestamo.ATRASADO,
      },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            cedula: true,
          },
        },
        cuotas: {
          where: {
            pagada: false,
            fechaVencimiento: { lt: new Date() },
          },
          orderBy: { fechaVencimiento: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return prestamos.map((p) => {
      const cuotaVencida = p.cuotas[0];
      const saldoCalculado = p.cuotas.reduce(
        (sum, c) => sum + c.capital + c.interes + (c.mora ?? 0),
        0
      );

      return {
        id: p.id,
        monto: p.monto,
        saldoPendiente: Math.round(saldoCalculado * 100) / 100,
        estado: p.estado,
        cuotasVencidas: p.cuotas.length,
        cliente: {
          id: p.cliente.id,
          nombre: p.cliente.nombre,
          apellido: p.cliente.apellido ?? '',
          cedula: p.cliente.cedula,
        },
        proximaCuota: cuotaVencida
          ? {
              numero: cuotaVencida.numero,
              monto: cuotaVencida.monto,
              fechaVencimiento: cuotaVencida.fechaVencimiento,
              mora: cuotaVencida.mora,
            }
          : null,
      };
    });
  }

  private async obtenerProximasCuotas(empresaId: string) {
    const hoy = startOfDay(new Date());
    const enSieteDias = addDays(hoy, 7);

    const cuotas = await this.prisma.cuota.findMany({
      where: {
        pagada: false,
        fechaVencimiento: {
          gte: hoy,
          lte: enSieteDias,
        },
        prestamo: {
          empresaId,
          estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] },
        },
      },
      include: {
        prestamo: {
          select: {
            id: true,
            saldoPendiente: true,
            cliente: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                telefono: true,
              },
            },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
      take: 10,
    });

    return cuotas.map((c) => ({
      id: c.id,
      numero: c.numero,
      monto: c.monto,
      capital: c.capital,
      interes: c.interes,
      mora: c.mora,
      fechaVencimiento: c.fechaVencimiento,
      diasRestantes: Math.ceil(
        (new Date(c.fechaVencimiento).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      ),
      prestamo: {
        id: c.prestamo.id,
        saldoPendiente: c.prestamo.saldoPendiente,
        cliente: {
          id: c.prestamo.cliente.id,
          nombre: c.prestamo.cliente.nombre,
          apellido: c.prestamo.cliente.apellido ?? '',
          telefono: c.prestamo.cliente.telefono ?? '',
        },
      },
    }));
  }
}