// src/caja/caja.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantUtils } from '../common/utils/tenant.utils';
import { registrarAuditoria } from '../common/utils/auditoria.utils';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Rango de un día en hora local (fix timezone) ─────────────────────────
  private rangoDia(fecha: string) {
    const inicioDia = new Date(`${fecha}T00:00:00.000`);
    const finDia    = new Date(`${fecha}T23:59:59.999`);
    return { inicioDia, finDia };
  }

  // ─── Resumen de pagos del día ─────────────────────────────────────────────
  private async resumenPagosDia(empresaId: string, fecha: string, usuarioId?: string) {
    const { inicioDia, finDia } = this.rangoDia(fecha);

    const where = {
      createdAt: { gte: inicioDia, lte: finDia },
      prestamo:  { empresaId },
      ...(usuarioId && { usuarioId }),
    };

    // OPTIMIZACIÓN: Usar aggregate para cálculos en DB
    const [totales, pagos] = await Promise.all([
      this.prisma.pago.aggregate({
        where,
        _sum: {
          montoTotal: true,
          capital: true,
          interes: true,
          mora: true,
        },
      }),
      this.prisma.pago.findMany({
        where,
        include: {
          usuario:  { select: { id: true, nombre: true } },
          prestamo: {
            select: {
              id: true,
              cliente: { select: { nombre: true, apellido: true, cedula: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calcular totales por método usando aggregate también
    const porMetodo = await this.prisma.pago.groupBy({
      by: ['metodo'],
      where,
      _count: true,
      _sum: { montoTotal: true },
    });

    const pagosPorMetodo: Record<string, { cantidad: number; monto: number }> = {};
    porMetodo.forEach((m) => {
      pagosPorMetodo[m.metodo] = {
        cantidad: m._count,
        monto: Math.round((m._sum.montoTotal ?? 0) * 100) / 100,
      };
    });

    return {
      pagos,
      totalCobrado:  Math.round((totales._sum.montoTotal ?? 0)  * 100) / 100,
      totalEfectivo: Math.round((pagosPorMetodo['EFECTIVO']?.monto ?? 0) * 100) / 100,
      totalCapital:  Math.round((totales._sum.capital ?? 0)  * 100) / 100,
      totalInteres:  Math.round((totales._sum.interes ?? 0)  * 100) / 100,
      totalMora:     Math.round((totales._sum.mora ?? 0)     * 100) / 100,
      cantidadPagos: pagos.length,
      pagosPorMetodo,
    };
  }

  // ─── Desembolsos del día ──────────────────────────────────────────────────
  private async desembolsosDia(empresaId: string, fecha: string, cajaId?: string) {
    const { inicioDia, finDia } = this.rangoDia(fecha);

    const where = {
      empresaId,
      createdAt: { gte: inicioDia, lte: finDia },
      ...(cajaId && { cajaId }),
    };

    // OPTIMIZACIÓN: Usar aggregate para cálculos en DB
    const [totales, desembolsos] = await Promise.all([
      (this.prisma as any).desembolsoCaja.aggregate({
        where,
        _sum: { monto: true },
      }),
      (this.prisma as any).desembolsoCaja.findMany({
        where,
        include: {
          usuario:  { select: { id: true, nombre: true } },
          prestamo: {
            select: {
              id: true,
              monto: true,
              cliente: { select: { nombre: true, apellido: true, cedula: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      desembolsos,
      totalDesembolsado: Math.round((totales._sum.monto ?? 0) * 100) / 100,
      cantidadDesembolsos: desembolsos.length,
    };
  }

  // ─── ABRIR CAJA ───────────────────────────────────────────────────────────

  async abrirCaja(
    empresaId: string,
    usuarioId: string,
    montoInicial: number,
    fecha: string,
  ) {
    // No puede abrir si ya tiene una caja ese día (abierta o cerrada)
    const cajaExistente = await this.prisma.cajaSesion.findFirst({
      where: { empresaId, usuarioId, fecha },
    });

    if (cajaExistente) {
      throw new BadRequestException(
        cajaExistente.estado === 'ABIERTA'
          ? 'Ya tienes una caja abierta para este día'
          : 'Ya cerraste tu caja hoy, no puedes abrir otra',
      );
    }

    const caja = await this.prisma.cajaSesion.create({
      data: { fecha, montoInicial, estado: 'ABIERTA', empresaId, usuarioId },
      include: { usuario: { select: { id: true, nombre: true } } },
    });

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'CAJA',
      accion: 'APERTURA',
      descripcion: `Apertura de caja con monto inicial RD$${montoInicial.toLocaleString()}`,
      monto: montoInicial,
      referenciaId: caja.id,
      referenciaTipo: 'CajaSesion',
    });

    return caja;
  }

  // ─── CERRAR CAJA ──────────────────────────────────────────────────────────

  async cerrarCaja(
    cajaId: string,
    empresaId: string,
    usuarioId: string,
    efectivoReal: number,
    observaciones?: string,
    rol?: string,
  ) {
    const isAdmin = rol === 'ADMIN';

    const caja = isAdmin
      ? await this.prisma.cajaSesion.findFirst({
          where: { id: cajaId, empresaId },
        })
      : await this.prisma.cajaSesion.findFirst({
          where: { id: cajaId, empresaId, usuarioId },
        });

    if (!caja) throw new NotFoundException('Caja no encontrada o no tienes permiso');
    if (caja.estado === 'CERRADA') throw new BadRequestException('Esta caja ya fue cerrada');

    const usuarioCajaId = isAdmin ? caja.usuarioId : usuarioId;
    const { totalEfectivo } = await this.resumenPagosDia(empresaId, caja.fecha, usuarioCajaId);
    const { totalDesembolsado } = await this.desembolsosDia(empresaId, caja.fecha, cajaId);

    const efectivoSistema = Math.round(
      (caja.montoInicial + totalEfectivo - totalDesembolsado) * 100,
    ) / 100;
    const diferencia = Math.round((efectivoReal - efectivoSistema) * 100) / 100;

    const cajaCerrada = await this.prisma.cajaSesion.update({
      where: { id: cajaId },
      data: {
        estado:          'CERRADA',
        efectivoSistema,
        efectivoReal,
        diferencia,
        observaciones:   observaciones ?? null,
        fechaCierre:     new Date(),
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    });

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'CAJA',
      accion: 'CIERRE',
      descripcion: `Cierre caja: Efectivo sistema RD$${efectivoSistema.toLocaleString()} vs Real RD$${efectivoReal.toLocaleString()} (${diferencia >= 0 ? '+' : ''}RD$${diferencia.toLocaleString()})`,
      monto: efectivoReal,
      referenciaId: cajaId,
      referenciaTipo: 'CajaSesion',
      datosAnteriores: { montoInicial: caja.montoInicial, estado: 'ABIERTA' },
      datosNuevos: { efectivoSistema, efectivoReal, diferencia, estado: 'CERRADA' },
    });

    return cajaCerrada;
  }

  // ─── MI CAJA DEL DÍA ─────────────────────────────────────────────────────

  async miCajaActiva(empresaId: string, usuarioId: string, fecha: string) {
    const caja = await this.prisma.cajaSesion.findFirst({
      where:   { empresaId, usuarioId, fecha },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!caja) return null;

    const resumenPagos    = await this.resumenPagosDia(empresaId, fecha, usuarioId);
    const resumenDesembol = await this.desembolsosDia(empresaId, fecha, caja.id);

    const efectivoSistema = Math.round(
      (caja.montoInicial + resumenPagos.totalEfectivo - resumenDesembol.totalDesembolsado) * 100,
    ) / 100;

    return {
      ...caja,
      resumen: {
        ...resumenPagos,
        desembolsos:         resumenDesembol.desembolsos,
        totalDesembolsado:   resumenDesembol.totalDesembolsado,
        cantidadDesembolsos: resumenDesembol.cantidadDesembolsos,
        efectivoSistema,
        efectivoEnCaja: efectivoSistema,
      },
    };
  }

  // ─── RESUMEN COMPLETO DEL DÍA (admin) ────────────────────────────────────

  async getResumenDia(empresaId: string, fecha: string) {
    const cajas = await this.prisma.cajaSesion.findMany({
      where:   { empresaId, fecha },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const resumenPagos    = await this.resumenPagosDia(empresaId, fecha);
    const resumenDesembol = await this.desembolsosDia(empresaId, fecha);

    const efectivoSistema = Math.round(
      (cajas.reduce((s, c) => s + c.montoInicial, 0) + resumenPagos.totalEfectivo - resumenDesembol.totalDesembolsado) * 100,
    ) / 100;

    return {
      fecha,
      cajas,
      resumen: {
        totalCobrado:        resumenPagos.totalCobrado,
        totalEfectivo:       resumenPagos.totalEfectivo,
        totalCapital:        resumenPagos.totalCapital,
        totalInteres:        resumenPagos.totalInteres,
        totalMora:           resumenPagos.totalMora,
        totalDesembolsado:   resumenDesembol.totalDesembolsado,
        cantidadDesembolsos: resumenDesembol.cantidadDesembolsos,
        efectivoSistema,
        cantidadPagos:  resumenPagos.cantidadPagos,
        cantidadCajas:  cajas.length,
        cajasAbiertas:  cajas.filter((c) => c.estado === 'ABIERTA').length,
      },
      pagosPorMetodo:    resumenPagos.pagosPorMetodo,
      pagos:             resumenPagos.pagos,
      desembolsos:       resumenDesembol.desembolsos,
    };
  }

  // ─── HISTORIAL ────────────────────────────────────────────────────────────

  async historialCajas(empresaId: string, usuarioId: string, isAdmin: boolean) {
    return this.prisma.cajaSesion.findMany({
      where: {
        empresaId,
        ...(!isAdmin && { usuarioId }),
      },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
}