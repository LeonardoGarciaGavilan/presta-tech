//reportes.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcularDesdeObjeto,
} from '../common/utils/prestamo.utils';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. COBROS POR PERÍODO ────────────────────────────────────────────────

  async cobrosPorPeriodo(
    user: any,
    desde: string,
    hasta: string,
    provincia?: string,
    pagina = 1,
    porPagina = 100,
  ) {
    const desdeDate = getInicioDiaRD(desde);
    const hastaDate = getFinDiaRD(hasta);

    const skip = (pagina - 1) * porPagina;

    const where = {
      prestamo: {
        empresaId: user.empresaId,
        cliente: provincia ? { provincia } : undefined,
      },
      createdAt: {
        gte: desdeDate,
        lte: hastaDate,
      },
    };

    const [pagos, totales, totalCount] = await Promise.all([
      this.prisma.pago.findMany({
        where,
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
      }),
      this.prisma.pago.aggregate({
        where,
        _sum: {
          montoTotal: true,
          capital: true,
          interes: true,
          mora: true,
        },
      }),
      this.prisma.pago.count({ where }),
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

  async carteraVencida(
    user: any,
    provincia?: string,
    pagina = 1,
    porPagina = 100,
  ) {
    const skip = (pagina - 1) * porPagina;

    const where = {
      empresaId: user.empresaId,
      estado: 'ATRASADO' as const,
      cliente: provincia ? { provincia } : undefined,
    };

    const [prestamos, totalPrestamos, totales] = await Promise.all([
      this.prisma.prestamo.findMany({
        where,
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
      }),
      this.prisma.prestamo.count({ where }),
      this.prisma.prestamo.aggregate({
        where,
        _sum: { monto: true, moraAcumulada: true },
      }),
    ]);

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

    return {
      pagina,
      porPagina,
      totalRegistros: totalPrestamos,
      totalPaginas: Math.ceil(totalPrestamos / porPagina),
      totalSaldoVencido: totales._sum.monto ?? 0,
      totalMora: Math.round((totales._sum.moraAcumulada ?? 0) * 100) / 100,
      prestamos: resultado,
    };
  }

  // ─── 3. ESTADO GENERAL DE PRÉSTAMOS ──────────────────────────────────────

  async estadoGeneral(
    user: any,
    provincia?: string,
    pagina = 1,
    porPagina = 100,
  ) {
    const skip = (pagina - 1) * porPagina;

    const where = {
      empresaId: user.empresaId,
      cliente: provincia ? { provincia } : undefined,
    };

    const [prestamos, totalPrestamos, conteoEstados, totalesMonto, totalesCartera] =
      await Promise.all([
        this.prisma.prestamo.findMany({
          where,
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
            cuotas: { where: { pagada: false } },
            _count: { select: { cuotas: { where: { pagada: false } } } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: porPagina,
        }),
        this.prisma.prestamo.count({ where }),
        this.prisma.prestamo.groupBy({
          by: ['estado'],
          where,
          _count: true,
        }),
        this.prisma.prestamo.aggregate({
          where,
          _sum: { monto: true },
        }),
        this.prisma.prestamo.aggregate({
          where: {
            ...where,
            estado: { in: ['ACTIVO', 'ATRASADO'] },
          },
          _sum: { saldoPendiente: true },
        }),
      ]);

    const estadoCounts = conteoEstados.reduce(
      (acc, e) => {
        acc[e.estado] = e._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const resumen = {
      activos: estadoCounts['ACTIVO'] ?? 0,
      atrasados: estadoCounts['ATRASADO'] ?? 0,
      pagados: estadoCounts['PAGADO'] ?? 0,
      renovados: estadoCounts['RENOVADO'] ?? 0,
      cancelados: estadoCounts['CANCELADO'] ?? 0,
      totalCartera: Math.round((totalesCartera._sum.saldoPendiente ?? 0) * 100) / 100,
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
          cuotasPendientes: p._count.cuotas,
          proximaFecha: null,
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
      ['ACTIVO', 'ATRASADO'].includes(p.estado),
    );
    const totalSaldo =
      Math.round(
        prestamosActivosFilter.reduce((s, p) => {
          const { saldoPendiente } = calcularDesdeObjeto(p);
          return s + saldoPendiente;
        }, 0) * 100,
      ) / 100;
    const totalMora =
      Math.round(
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
    pagina = 1,
    porPagina = 100,
  ) {
    const desdeDate = getInicioDiaRD(desde);
    const hastaDate = getFinDiaRD(hasta);
    const skip = (pagina - 1) * porPagina;

    const cajasWhere = {
      empresaId: user.empresaId,
      createdAt: { gte: desdeDate, lte: hastaDate },
      ...(usuarioId && { usuarioId }),
    };

    const pagosWhere = {
      prestamo: { empresaId: user.empresaId },
      createdAt: { gte: desdeDate, lte: hastaDate },
      ...(usuarioId && { usuarioId }),
    };

    const [cajas, pagos, totalCount] = await Promise.all([
      this.prisma.cajaSesion.findMany({
        where: cajasWhere,
        include: {
          usuario: { select: { id: true, nombre: true } },
        },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.pago.findMany({
        where: pagosWhere,
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
        skip,
        take: porPagina,
      }),
      this.prisma.pago.count({ where: pagosWhere }),
    ]);

    const allPagos = await this.prisma.pago.findMany({
      where: pagosWhere,
      select: { montoTotal: true, capital: true, interes: true, mora: true, metodo: true, usuarioId: true },
    });

    const totalCobrado =
      Math.round(allPagos.reduce((s, p) => s + p.montoTotal, 0) * 100) / 100;
    const totalCapital =
      Math.round(allPagos.reduce((s, p) => s + p.capital, 0) * 100) / 100;
    const totalInteres =
      Math.round(allPagos.reduce((s, p) => s + p.interes, 0) * 100) / 100;
    const totalMora =
      Math.round(allPagos.reduce((s, p) => s + p.mora, 0) * 100) / 100;
    const totalEfectivo =
      Math.round(
        allPagos
          .filter((p) => p.metodo === 'EFECTIVO')
          .reduce((s, p) => s + p.montoTotal, 0) * 100,
      ) / 100;

    const pagosPorMetodo: Record<string, { cantidad: number; monto: number }> =
      {};
    allPagos.forEach((p) => {
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

    allPagos.forEach((p) => {
      const uid = p.usuarioId;
      if (!porUsuario[uid]) {
        const cajaUser = cajas.find((c) => c.usuarioId === uid);
        porUsuario[uid] = {
          usuarioId: uid,
          nombre: cajaUser?.usuario?.nombre ?? '—',
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

    allPagos.forEach((p) => {
      const fecha = new Date(
        Date.now() - new Date().getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 10);
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
    const efectivoSistema =
      Math.round(
        (cajas.reduce((s, c) => s + c.montoInicial, 0) +
          totalEfectivo -
          cajas.reduce((s, c) => s + (c.efectivoReal ?? 0), 0)) *
          100,
      ) / 100;

    return {
      desde,
      hasta,
      pagina,
      porPagina,
      totalRegistros: totalCount,
      totalPaginas: Math.ceil(totalCount / porPagina),
      resumen: {
        totalCobrado,
        totalCapital,
        totalInteres,
        totalMora,
        totalEfectivo,
        cantidadPagos: allPagos.length,
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

  // ─── 6. FLUJO DE CAJA ───────────────────────────────────────────────────────

  async flujoDeCaja(
    user: any,
    desde: string,
    hasta: string,
    usuarioId?: string,
  ) {
    const desdeDate = getInicioDiaRD(desde);
    const hastaDate = getFinDiaRD(hasta);

    const whereBase: any = {
      empresaId: user.empresaId,
      fecha: { gte: desdeDate, lte: hastaDate },
    };
    if (usuarioId) whereBase.usuarioId = usuarioId;

    const [movimientos, pagos, gastos, desembolsos, inyecciones, retiros] =
      await Promise.all([
        this.prisma.movimientoFinanciero.findMany({
          where: whereBase,
          select: { tipo: true, monto: true, capital: true, interes: true, mora: true, fecha: true },
          orderBy: { fecha: 'asc' },
        }),
        this.prisma.pago.findMany({
          where: {
            prestamo: { empresaId: user.empresaId },
            createdAt: { gte: desdeDate, lte: hastaDate },
            ...(usuarioId && { usuarioId }),
          },
          select: { montoTotal: true, capital: true, interes: true, mora: true, metodo: true, createdAt: true },
        }),
        this.prisma.gasto.findMany({
          where: { empresaId: user.empresaId, fecha: { gte: desdeDate, lte: hastaDate }, ...(usuarioId && { usuarioId }) },
          select: { monto: true, categoria: true, fecha: true },
        }),
        this.prisma.desembolsoCaja.findMany({
          where: { empresaId: user.empresaId, createdAt: { gte: desdeDate, lte: hastaDate }, ...(usuarioId && { usuarioId }) },
          select: { monto: true, createdAt: true },
        }),
        this.prisma.inyeccionCapital.findMany({
          where: { empresaId: user.empresaId, fecha: { gte: desdeDate, lte: hastaDate }, ...(usuarioId && { usuarioId }) },
          select: { monto: true, fecha: true },
        }),
        this.prisma.retiroGanancias.findMany({
          where: { empresaId: user.empresaId, fecha: { gte: desdeDate, lte: hastaDate }, ...(usuarioId && { usuarioId }) },
          select: { monto: true, fecha: true },
        }),
      ]);

    const toFechaStr = (d: Date | string): string => {
      const date = new Date(d);
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60000);
      return local.toISOString().slice(0, 10);
    };

    const entradasMap: Record<string, number> = {};
    const salidasMap: Record<string, number> = {};

    pagos.forEach((p) => {
      const f = toFechaStr(p.createdAt);
      entradasMap[f] = Math.round(((entradasMap[f] ?? 0) + p.montoTotal) * 100) / 100;
    });

    inyecciones.forEach((i) => {
      const f = toFechaStr(i.fecha);
      entradasMap[f] = Math.round(((entradasMap[f] ?? 0) + i.monto) * 100) / 100;
    });

    desembolsos.forEach((d) => {
      const f = toFechaStr(d.createdAt);
      salidasMap[f] = Math.round(((salidasMap[f] ?? 0) + d.monto) * 100) / 100;
    });

    gastos.forEach((g) => {
      const f = toFechaStr(g.fecha);
      salidasMap[f] = Math.round(((salidasMap[f] ?? 0) + g.monto) * 100) / 100;
    });

    retiros.forEach((r) => {
      const f = toFechaStr(r.fecha);
      salidasMap[f] = Math.round(((salidasMap[f] ?? 0) + r.monto) * 100) / 100;
    });

    const fechasSet = new Set([...Object.keys(entradasMap), ...Object.keys(salidasMap)]);
    const porDia = Array.from(fechasSet)
      .sort()
      .map((fecha) => {
        const entradas = entradasMap[fecha] ?? 0;
        const salidas = salidasMap[fecha] ?? 0;
        return {
          fecha,
          entradas,
          salidas,
          neto: Math.round((entradas - salidas) * 100) / 100,
        };
      });

    const totalEntradas =
      Math.round(Object.values(entradasMap).reduce((s, v) => s + v, 0) * 100) / 100;
    const totalSalidas =
      Math.round(Object.values(salidasMap).reduce((s, v) => s + v, 0) * 100) / 100;

    const porCategoria: Record<string, number> = {};
    gastos.forEach((g) => {
      porCategoria[g.categoria] = Math.round(((porCategoria[g.categoria] ?? 0) + g.monto) * 100) / 100;
    });

    return {
      desde,
      hasta,
      totalEntradas,
      totalSalidas,
      neto: Math.round((totalEntradas - totalSalidas) * 100) / 100,
      desgloseEntradas: {
        pagos: Math.round(pagos.reduce((s, p) => s + p.montoTotal, 0) * 100) / 100,
        inyecciones: Math.round(inyecciones.reduce((s, i) => s + i.monto, 0) * 100) / 100,
      },
      desgloseSalidas: {
        desembolsos: Math.round(desembolsos.reduce((s, d) => s + d.monto, 0) * 100) / 100,
        gastos: Math.round(gastos.reduce((s, g) => s + g.monto, 0) * 100) / 100,
        retiros: Math.round(retiros.reduce((s, r) => s + r.monto, 0) * 100) / 100,
      },
      gastosPorCategoria: porCategoria,
      porDia,
    };
  }

  // ─── 7. DESEMPEÑO POR COBRADOR ──────────────────────────────────────────────

  async desempenoPorCobrador(
    user: any,
    desde?: string,
    hasta?: string,
    usuarioId?: string,
  ) {
    const whereBase: any = {
      prestamo: { empresaId: user.empresaId },
    };
    if (desde) whereBase.createdAt = { ...(whereBase.createdAt ?? {}), gte: getInicioDiaRD(desde) };
    if (hasta) whereBase.createdAt = { ...(whereBase.createdAt ?? {}), lte: getFinDiaRD(hasta) };
    if (usuarioId) whereBase.usuarioId = usuarioId;

    const pagos = await this.prisma.pago.findMany({
      where: whereBase,
      select: {
        montoTotal: true,
        capital: true,
        interes: true,
        mora: true,
        metodo: true,
        createdAt: true,
        usuarioId: true,
        usuario: { select: { id: true, nombre: true } },
      },
    });

    const porUsuario: Record<
      string,
      {
        usuarioId: string;
        nombre: string;
        totalCobrado: number;
        totalCapital: number;
        totalInteres: number;
        totalMora: number;
        cantidadPagos: number;
        pagosPorMetodo: Record<string, { cantidad: number; monto: number }>;
        diasActivos: Set<string>;
      }
    > = {};

    pagos.forEach((p) => {
      const uid = p.usuarioId;
      if (!porUsuario[uid]) {
        porUsuario[uid] = {
          usuarioId: uid,
          nombre: p.usuario?.nombre ?? '—',
          totalCobrado: 0,
          totalCapital: 0,
          totalInteres: 0,
          totalMora: 0,
          cantidadPagos: 0,
          pagosPorMetodo: {},
          diasActivos: new Set(),
        };
      }
      const u = porUsuario[uid];
      u.totalCobrado = Math.round((u.totalCobrado + p.montoTotal) * 100) / 100;
      u.totalCapital = Math.round((u.totalCapital + p.capital) * 100) / 100;
      u.totalInteres = Math.round((u.totalInteres + p.interes) * 100) / 100;
      u.totalMora = Math.round((u.totalMora + p.mora) * 100) / 100;
      u.cantidadPagos += 1;

      const metodo = p.metodo;
      if (!u.pagosPorMetodo[metodo]) u.pagosPorMetodo[metodo] = { cantidad: 0, monto: 0 };
      u.pagosPorMetodo[metodo].cantidad += 1;
      u.pagosPorMetodo[metodo].monto = Math.round((u.pagosPorMetodo[metodo].monto + p.montoTotal) * 100) / 100;

      const d = new Date(p.createdAt);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      u.diasActivos.add(local.toISOString().slice(0, 10));
    });

    const resultado = Object.values(porUsuario)
      .map((u) => ({
        usuarioId: u.usuarioId,
        nombre: u.nombre,
        totalCobrado: u.totalCobrado,
        totalCapital: u.totalCapital,
        totalInteres: u.totalInteres,
        totalMora: u.totalMora,
        cantidadPagos: u.cantidadPagos,
        promedioPorPago: u.cantidadPagos > 0
          ? Math.round((u.totalCobrado / u.cantidadPagos) * 100) / 100
          : 0,
        diasActivos: u.diasActivos.size,
        promedioPorDia: u.diasActivos.size > 0
          ? Math.round((u.totalCobrado / u.diasActivos.size) * 100) / 100
          : 0,
        pagosPorMetodo: u.pagosPorMetodo,
      }))
      .sort((a, b) => b.totalCobrado - a.totalCobrado);

    const totalGeneral = {
      totalCobrado: Math.round(resultado.reduce((s, r) => s + r.totalCobrado, 0) * 100) / 100,
      totalCapital: Math.round(resultado.reduce((s, r) => s + r.totalCapital, 0) * 100) / 100,
      totalInteres: Math.round(resultado.reduce((s, r) => s + r.totalInteres, 0) * 100) / 100,
      totalMora: Math.round(resultado.reduce((s, r) => s + r.totalMora, 0) * 100) / 100,
      cantidadPagos: resultado.reduce((s, r) => s + r.cantidadPagos, 0),
      cobradores: resultado.length,
    };

    return {
      desde: desde ?? null,
      hasta: hasta ?? null,
      ...totalGeneral,
      cobradores: resultado,
    };
  }

  // ─── 8. PROYECCIÓN DE CUOTAS ────────────────────────────────────────────────

  async proyeccionCuotas(
    user: any,
    provincia?: string,
  ) {
    const prestamos = await this.prisma.prestamo.findMany({
      where: {
        empresaId: user.empresaId,
        estado: { in: ['ACTIVO', 'ATRASADO'] },
        cliente: provincia ? { provincia } : undefined,
      },
      include: {
        cliente: { select: { nombre: true, apellido: true, cedula: true, provincia: true } },
        cuotas: {
          where: { pagada: false },
          orderBy: { numero: 'asc' },
          select: {
            numero: true,
            monto: true,
            capital: true,
            interes: true,
            mora: true,
            fechaVencimiento: true,
          },
        },
      },
      orderBy: { fechaInicio: 'asc' },
    });

    const hoy = new Date();

    const porMes: Record<string, { month: string; cantidadCuotas: number; montoCapital: number; montoInteres: number; montoMora: number; montoTotal: number; vencidas: number }> = {};

    const todosDetalles: any[] = [];

    prestamos.forEach((p) => {
      p.cuotas.forEach((c) => {
        const d = new Date(c.fechaVencimiento);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        const monthKey = local.toISOString().slice(0, 7); // YYYY-MM

        if (!porMes[monthKey]) {
          porMes[monthKey] = {
            month: monthKey,
            cantidadCuotas: 0,
            montoCapital: 0,
            montoInteres: 0,
            montoMora: 0,
            montoTotal: 0,
            vencidas: 0,
          };
        }
        const m = porMes[monthKey];
        m.cantidadCuotas += 1;
        m.montoCapital = Math.round((m.montoCapital + c.capital) * 100) / 100;
        m.montoInteres = Math.round((m.montoInteres + c.interes) * 100) / 100;
        m.montoMora = Math.round((m.montoMora + c.mora) * 100) / 100;
        m.montoTotal = Math.round((m.montoTotal + c.monto) * 100) / 100;

        const esVencida = new Date(c.fechaVencimiento) < hoy;
        if (esVencida) m.vencidas += 1;

        todosDetalles.push({
          cliente: `${p.cliente.nombre} ${p.cliente.apellido}`,
          cedula: p.cliente.cedula,
          provincia: p.cliente.provincia ?? '',
          prestamoId: p.id,
          numeroCuota: c.numero,
          monto: c.monto,
          fechaVencimiento: c.fechaVencimiento,
          vencida: esVencida,
        });
      });
    });

    const resumenMeses = Object.values(porMes).sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalPrestamos: prestamos.length,
      totalCuotasPendientes: resumenMeses.reduce((s, m) => s + m.cantidadCuotas, 0),
      totalMontoPendiente: Math.round(resumenMeses.reduce((s, m) => s + m.montoTotal, 0) * 100) / 100,
      totalVencidas: resumenMeses.reduce((s, m) => s + m.vencidas, 0),
      porMes: resumenMeses,
      detalles: todosDetalles,
    };
  }
}
