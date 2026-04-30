//reporte.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularDesdeObjeto, calcularSaldoDesdeCuotas } from '../common/utils/prestamo.utils';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user.rol !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo el administrador puede generar reportes', 
      );
    }
  }

  // ─── 1. COBROS POR PERÍODO ────────────────────────────────────────────────

  async cobrosPorPeriodo(
    user: any,
    desde: string,
    hasta: string,
    provincia?: string,
    pagina = 1,
    porPagina = 100,
  ) {
    this.assertAdmin(user);

    const desdeDate = getInicioDiaRD(desde);
    const hastaDate = getFinDiaRD(hasta);

    console.log('DEBUG REPORTES RANGO:', { desde: desdeDate.toISOString(), hasta: hastaDate.toISOString() });

    const skip = (pagina - 1) * porPagina;

    // Obtener pagos con paginación
    const pagos = await this.prisma.pago.findMany({
      where: {
        prestamo: {
          empresaId: user.empresaId,
          cliente: provincia ? { provincia } : undefined,
        },
        createdAt: {
          gte: desdeDate,
          lte: hastaDate,
        },
      },
      include: {
        usuario: { select: { nombre: true } },
        prestamo: {
          select: {
            monto: true,
            cliente: {
              select: {
                nombre: true,
                apellido: true,
                cedula: true,
                provincia: true,
                municipio: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: porPagina,
    });

    // Calcular totales usando aggregate (más eficiente)
    const [totales, totalCount] = await Promise.all([
      this.prisma.pago.aggregate({
        where: {
          prestamo: {
            empresaId: user.empresaId,
            cliente: provincia ? { provincia } : undefined,
          },
          createdAt: {
            gte: desdeDate,
            lte: hastaDate,
          },
        },
        _sum: {
          montoTotal: true,
          capital: true,
          interes: true,
          mora: true,
        },
      }),
      this.prisma.pago.count({
        where: {
          prestamo: {
            empresaId: user.empresaId,
            cliente: provincia ? { provincia } : undefined,
          },
          createdAt: {
            gte: desdeDate,
            lte: hastaDate,
          },
        },
      }),
    ]);

    return {
      desde,
      hasta,
      pagina,
      porPagina,
      totalRegistros: totalCount,
      totalPaginas: Math.ceil(totalCount / porPagina),
      totalCobrado: totales._sum.montoTotal ?? 0,
      totalCapital: totales._sum.capital ?? 0,
      totalInteres: totales._sum.interes ?? 0,
      totalMora: totales._sum.mora ?? 0,
      pagos: pagos.map((p) => ({
        fecha: p.createdAt,
        cliente: `${p.prestamo.cliente.nombre} ${p.prestamo.cliente.apellido}`,
        cedula: p.prestamo.cliente.cedula,
        provincia: p.prestamo.cliente.provincia ?? '',
        municipio: p.prestamo.cliente.municipio ?? '',
        capital: p.capital,
        interes: p.interes,
        mora: p.mora,
        total: p.montoTotal,
        metodo: p.metodo,
        referencia: p.referencia ?? '',
        cobrador: p.usuario?.nombre ?? '—',
      })),
    };
  }

  // ─── 2. CARTERA VENCIDA ───────────────────────────────────────────────────

  async carteraVencida(user: any, provincia?: string, pagina = 1, porPagina = 100) {
    this.assertAdmin(user);
    const skip = (pagina - 1) * porPagina;

    const prestamos = await this.prisma.prestamo.findMany({
      where: {
        empresaId: user.empresaId,
        estado: 'ATRASADO',
        cliente: provincia ? { provincia } : undefined,
      },
      include: {
        cliente: {
          select: {
            nombre: true,
            apellido: true,
            cedula: true,
            telefono: true,
            provincia: true,
            municipio: true,
          },
        },
        cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
      },
      orderBy: { moraAcumulada: 'desc' },
      skip,
      take: porPagina,
    });

    // Contar total para paginación
    const totalPrestamos = await this.prisma.prestamo.count({
      where: {
        empresaId: user.empresaId,
        estado: 'ATRASADO',
        cliente: provincia ? { provincia } : undefined,
      },
    });

    const hoy = new Date();

    const resultado = prestamos.map((p) => {
      const { saldoPendiente, moraAcumulada } = calcularDesdeObjeto(p);
      const cuotasVencidas = p.cuotas.filter(
        (c) => new Date(c.fechaVencimiento) < hoy,
      );
      const diasMaxAtraso =
        cuotasVencidas.length > 0
          ? Math.max(
              ...cuotasVencidas.map((c) =>
                Math.floor(
                  (hoy.getTime() - new Date(c.fechaVencimiento).getTime()) /
                    86400000,
                ),
              ),
            )
          : 0;

      return {
        cliente: `${p.cliente.nombre} ${p.cliente.apellido}`,
        cedula: p.cliente.cedula,
        telefono: p.cliente.telefono ?? '—',
        provincia: p.cliente.provincia ?? '',
        municipio: p.cliente.municipio ?? '',
        montoOriginal: p.monto,
        saldoPendiente,
        moraAcumulada,
        cuotasVencidas: cuotasVencidas.length,
        diasMaxAtraso,
        proximaFecha: p.cuotas[0]?.fechaVencimiento ?? null,
      };
    });

    // Calcular totales usando aggregate
    const totales = await this.prisma.prestamo.aggregate({
      where: {
        empresaId: user.empresaId,
        estado: 'ATRASADO',
        cliente: provincia ? { provincia } : undefined,
      },
      _sum: { monto: true },
    });

    // Calcular mora total desde préstamos activos/atrasados
    const prestamosConMora = await this.prisma.prestamo.findMany({
      where: {
        empresaId: user.empresaId,
        estado: 'ATRASADO',
        cliente: provincia ? { provincia } : undefined,
      },
      select: { moraAcumulada: true },
    });

    const totalMora = Math.round(
      prestamosConMora.reduce((s, p) => s + (p.moraAcumulada || 0), 0) * 100,
    ) / 100;

    return {
      pagina,
      porPagina,
      totalRegistros: totalPrestamos,
      totalPaginas: Math.ceil(totalPrestamos / porPagina),
      totalSaldoVencido: totales._sum.monto ?? 0,
      totalMora,
      prestamos: resultado,
    };
  }

  // ─── 3. ESTADO GENERAL DE PRÉSTAMOS ──────────────────────────────────────

  async estadoGeneral(user: any, provincia?: string, pagina = 1, porPagina = 100) {
    this.assertAdmin(user);
    const skip = (pagina - 1) * porPagina;

    const prestamos = await this.prisma.prestamo.findMany({
      where: {
        empresaId: user.empresaId,
        cliente: provincia ? { provincia } : undefined,
      },
      include: {
        cliente: {
          select: {
            nombre: true,
            apellido: true,
            cedula: true,
            provincia: true,
            municipio: true,
          },
        },
        cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: porPagina,
    });

    // Contar total
    const totalPrestamos = await this.prisma.prestamo.count({
      where: {
        empresaId: user.empresaId,
        cliente: provincia ? { provincia } : undefined,
      },
    });

    // Agregados para resumen
    const [conteoEstados, totalesMonto] = await Promise.all([
      this.prisma.prestamo.groupBy({
        by: ['estado'],
        where: {
          empresaId: user.empresaId,
          cliente: provincia ? { provincia } : undefined,
        },
        _count: true,
      }),
      this.prisma.prestamo.aggregate({
        where: {
          empresaId: user.empresaId,
          cliente: provincia ? { provincia } : undefined,
        },
        _sum: { monto: true },
      }),
    ]);

    const estadoCounts = conteoEstados.reduce((acc, e) => {
      acc[e.estado] = e._count;
      return acc;
    }, {} as Record<string, number>);

    // Calcular totalCartera desde préstamos activos/atrasados
    const prestamosActivos = prestamos.filter((p) => ['ACTIVO', 'ATRASADO'].includes(p.estado));
    const totalCartera = Math.round(
      prestamosActivos.reduce((s, p) => {
        const { saldoPendiente } = calcularDesdeObjeto(p);
        return s + saldoPendiente;
      }, 0) * 100,
    ) / 100;

    const resumen = {
      activos: estadoCounts['ACTIVO'] ?? 0,
      atrasados: estadoCounts['ATRASADO'] ?? 0,
      pagados: estadoCounts['PAGADO'] ?? 0,
      cancelados: estadoCounts['CANCELADO'] ?? 0,
      totalCartera,
      totalDesembolsado: totalesMonto._sum.monto ?? 0,
    };

    return {
      pagina,
      porPagina,
      totalRegistros: totalPrestamos,
      totalPaginas: Math.ceil(totalPrestamos / porPagina),
      resumen,
      prestamos: prestamos.map((p) => {
        const { saldoPendiente } = calcularDesdeObjeto(p);
        return {
          cliente: `${p.cliente.nombre} ${p.cliente.apellido}`,
          cedula: p.cliente.cedula,
          provincia: p.cliente.provincia ?? '',
          municipio: p.cliente.municipio ?? '',
          montoOriginal: p.monto,
          saldoPendiente,
          tasaInteres: p.tasaInteres,
          frecuencia: p.frecuenciaPago,
          estado: p.estado,
          cuotasPendientes: p.cuotas.length,
          proximaFecha: p.cuotas[0]?.fechaVencimiento ?? null,
          fechaInicio: p.fechaInicio,
        };
      }),
    };
  }

  // ─── 4. HISTORIAL DE PAGOS POR CLIENTE ───────────────────────────────────
  // ✅ Sin assertAdmin — accesible para ADMIN y USUARIO
  // El guard de empresa (empresaId) garantiza que solo vean sus propios clientes

  async pagosPorCliente(user: any, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId: user.empresaId },
    });
    if (!cliente) throw new ForbiddenException('Cliente no encontrado');

    const prestamos = await this.prisma.prestamo.findMany({
      where: { clienteId, empresaId: user.empresaId },
      include: {
        pagos: {
          include: { usuario: { select: { nombre: true } } },
          orderBy: { createdAt: 'desc' },
        },
        cuotas: { orderBy: { numero: 'asc' } },
        _count: { select: { pagos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPagado = prestamos
      .flatMap((p) => p.pagos)
      .reduce((s, pg) => s + pg.montoTotal, 0);
    
    const prestamosActivosFilter = prestamos.filter((p) => 
      ['ACTIVO', 'ATRASADO'].includes(p.estado)
    );
    const totalSaldo = Math.round(
      prestamosActivosFilter.reduce((s, p) => {
        const { saldoPendiente } = calcularDesdeObjeto(p);
        return s + saldoPendiente;
      }, 0) * 100,
    ) / 100;
    const totalMora = Math.round(
      prestamosActivosFilter.reduce((s, p) => {
        const { moraAcumulada } = calcularDesdeObjeto(p);
        return s + moraAcumulada;
      }, 0) * 100,
    ) / 100;
    const prestamosActivos = prestamosActivosFilter.length;

    return {
      cliente: {
        nombre: `${cliente.nombre} ${cliente.apellido}`,
        cedula: cliente.cedula,
        telefono: cliente.telefono ?? '—',
        celular: cliente.celular ?? '—',
        email: cliente.email ?? '—',
        provincia: cliente.provincia ?? '—',
        municipio: cliente.municipio ?? '—',
        sector: cliente.sector ?? '—',
        direccion: cliente.direccion ?? '—',
        ocupacion: cliente.ocupacion ?? '—',
      },
      totalPrestamos: prestamos.length,
      prestamosActivos,
      totalPagado,
      totalSaldo,
      totalMora,
      fechaGenerado: new Date(),
      prestamos: prestamos.map((p) => {
        const { saldoPendiente, moraAcumulada } = calcularDesdeObjeto(p);
        const hoy = new Date();
        const cuotasPendientes = p.cuotas.filter((c) => !c.pagada);
        const cuotasVencidas = cuotasPendientes.filter(
          (c) => new Date(c.fechaVencimiento) < hoy,
        );
        return {
          id: p.id,
          monto: p.monto,
          saldo: saldoPendiente,
          moraAcumulada,
          tasaInteres: p.tasaInteres,
          frecuencia: p.frecuenciaPago,
          estado: p.estado,
          fechaInicio: p.fechaInicio,
          totalCuotas: p.cuotas.length,
          cuotasPagadas: p.cuotas.filter((c) => c.pagada).length,
          cuotasVencidas: cuotasVencidas.length,
          proximaFecha: cuotasPendientes[0]?.fechaVencimiento ?? null,
          proximaMonto: cuotasPendientes[0]?.monto ?? null,
          cuotasPendientesDetalle: cuotasPendientes.map((c) => ({
            numero: c.numero,
            fechaVencimiento: c.fechaVencimiento,
            monto: c.monto,
            vencida: new Date(c.fechaVencimiento) < hoy,
          })),
          pagos: p.pagos.map((pg) => ({
            fecha: pg.createdAt,
            capital: pg.capital,
            interes: pg.interes,
            mora: pg.mora,
            total: pg.montoTotal,
            metodo: pg.metodo,
            cobrador: pg.usuario?.nombre ?? '—',
          })),
        };
      }),
    };
  }

  // ─── 5. REPORTE DE CAJAS ─────────────────────────────────────────────────

  async reporteCajas(
    user: any,
    desde: string,
    hasta: string,
    usuarioId?: string,
  ) {
    this.assertAdmin(user);

    const desdeDate = getInicioDiaRD(desde);
    const hastaDate = getFinDiaRD(hasta);

    console.log('DEBUG REPORTE CAJAS RANGO:', { desde: desdeDate.toISOString(), hasta: hastaDate.toISOString() });

    const cajas = await this.prisma.cajaSesion.findMany({
      where: {
        empresaId: user.empresaId,
        createdAt: { gte: desdeDate, lte: hastaDate },
        ...(usuarioId && { usuarioId }),
      },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });

    const pagos = await this.prisma.pago.findMany({
      where: {
        prestamo: { empresaId: user.empresaId },
        createdAt: { gte: desdeDate, lte: hastaDate },
        ...(usuarioId && { usuarioId }),
      },
      include: {
        usuario: { select: { id: true, nombre: true } },
        prestamo: {
          select: {
            id: true,
            cliente: { select: { nombre: true, apellido: true, cedula: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCobrado =
      Math.round(pagos.reduce((s, p) => s + p.montoTotal, 0) * 100) / 100;
    const totalCapital =
      Math.round(pagos.reduce((s, p) => s + p.capital, 0) * 100) / 100;
    const totalInteres =
      Math.round(pagos.reduce((s, p) => s + p.interes, 0) * 100) / 100;
    const totalMora =
      Math.round(pagos.reduce((s, p) => s + p.mora, 0) * 100) / 100;
    const totalEfectivo =
      Math.round(
        pagos
          .filter((p) => p.metodo === 'EFECTIVO')
          .reduce((s, p) => s + p.montoTotal, 0) * 100,
      ) / 100;

    const pagosPorMetodo: Record<string, { cantidad: number; monto: number }> =
      {};
    pagos.forEach((p) => {
      if (!pagosPorMetodo[p.metodo])
        pagosPorMetodo[p.metodo] = { cantidad: 0, monto: 0 };
      pagosPorMetodo[p.metodo].cantidad += 1;
      pagosPorMetodo[p.metodo].monto =
        Math.round((pagosPorMetodo[p.metodo].monto + p.montoTotal) * 100) / 100;
    });

    const porUsuario: Record<
      string,
      {
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
    > = {};

    cajas.forEach((c) => {
      const uid = c.usuarioId;
      if (!porUsuario[uid]) {
        porUsuario[uid] = {
          usuarioId: uid,
          nombre: c.usuario?.nombre ?? '—',
          cajasAbiertas: 0,
          cajasCerradas: 0,
          totalCobrado: 0,
          totalEfectivo: 0,
          cantidadPagos: 0,
          diferenciasPositivas: 0,
          diferenciasNegativas: 0,
        };
      }
      if (c.estado === 'ABIERTA') porUsuario[uid].cajasAbiertas++;
      else porUsuario[uid].cajasCerradas++;
      if (c.diferencia != null) {
        if (c.diferencia > 0)
          porUsuario[uid].diferenciasPositivas =
            Math.round(
              (porUsuario[uid].diferenciasPositivas + c.diferencia) * 100,
            ) / 100;
        if (c.diferencia < 0)
          porUsuario[uid].diferenciasNegativas =
            Math.round(
              (porUsuario[uid].diferenciasNegativas + Math.abs(c.diferencia)) *
                100,
            ) / 100;
      }
    });

    pagos.forEach((p) => {
      const uid = p.usuarioId;
      if (!porUsuario[uid]) {
        porUsuario[uid] = {
          usuarioId: uid,
          nombre: p.usuario?.nombre ?? '—',
          cajasAbiertas: 0,
          cajasCerradas: 0,
          totalCobrado: 0,
          totalEfectivo: 0,
          cantidadPagos: 0,
          diferenciasPositivas: 0,
          diferenciasNegativas: 0,
        };
      }
      porUsuario[uid].totalCobrado =
        Math.round((porUsuario[uid].totalCobrado + p.montoTotal) * 100) / 100;
      porUsuario[uid].cantidadPagos += 1;
      if (p.metodo === 'EFECTIVO') {
        porUsuario[uid].totalEfectivo =
          Math.round((porUsuario[uid].totalEfectivo + p.montoTotal) * 100) /
          100;
      }
    });

    const porDia: Record<
      string,
      {
        fecha: string;
        cajasAbiertas: number;
        cajasCerradas: number;
        totalCobrado: number;
        cantidadPagos: number;
      }
    > = {};

    cajas.forEach((c) => {
      if (!porDia[c.fecha]) {
        porDia[c.fecha] = {
          fecha: c.fecha,
          cajasAbiertas: 0,
          cajasCerradas: 0,
          totalCobrado: 0,
          cantidadPagos: 0,
        };
      }
      if (c.estado === 'ABIERTA') porDia[c.fecha].cajasAbiertas++;
      else porDia[c.fecha].cajasCerradas++;
    });

    pagos.forEach((p) => {
      const fecha = p.createdAt.toISOString().slice(0, 10);
      if (!porDia[fecha]) {
        porDia[fecha] = {
          fecha,
          cajasAbiertas: 0,
          cajasCerradas: 0,
          totalCobrado: 0,
          cantidadPagos: 0,
        };
      }
      porDia[fecha].totalCobrado =
        Math.round((porDia[fecha].totalCobrado + p.montoTotal) * 100) / 100;
      porDia[fecha].cantidadPagos += 1;
    });

    const cajasCerradas = cajas.filter((c) => c.estado === 'CERRADA').length;
    const cajasAbiertas = cajas.filter((c) => c.estado === 'ABIERTA').length;
    const efectivoSistema = Math.round(
      (cajas.reduce((s, c) => s + c.montoInicial, 0) + totalEfectivo - 
       cajas.reduce((s, c) => s + (c.efectivoReal ?? 0), 0)) * 100,
    ) / 100;

    return {
      desde,
      hasta,
      resumen: {
        totalCobrado,
        totalCapital,
        totalInteres,
        totalMora,
        totalEfectivo,
        cantidadPagos: pagos.length,
        cantidadCajas: cajas.length,
        cajasCerradas,
        cajasAbiertas,
        efectivoSistema,
      },
      pagosPorMetodo,
      cajas: cajas.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        cajero: c.usuario?.nombre ?? '—',
        usuarioId: c.usuarioId,
        estado: c.estado,
        montoInicial: c.montoInicial,
        montoCierre: c.montoCierre,
        diferencia: c.diferencia,
        observaciones: c.observaciones,
        fechaCierre: c.fechaCierre,
        createdAt: c.createdAt,
      })),
      pagos: pagos.map((p) => ({
        id: p.id,
        fecha: p.createdAt,
        cajero: p.usuario?.nombre ?? '—',
        cliente:
          `${p.prestamo?.cliente?.nombre ?? ''} ${p.prestamo?.cliente?.apellido ?? ''}`.trim(),
        cedula: p.prestamo?.cliente?.cedula ?? '',
        capital: p.capital,
        interes: p.interes,
        mora: p.mora,
        total: p.montoTotal,
        metodo: p.metodo,
        referencia: p.referencia ?? '',
      })),
      resumenPorUsuario: Object.values(porUsuario).sort(
        (a, b) => b.totalCobrado - a.totalCobrado,
      ),
      resumenPorDia: Object.values(porDia).sort((a, b) =>
        b.fecha.localeCompare(a.fecha),
      ),
    };
  }
}