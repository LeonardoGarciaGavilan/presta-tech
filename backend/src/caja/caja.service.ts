// src/caja/caja.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantUtils } from '../common/utils/tenant.utils';
import { registrarAuditoria } from '../common/utils/auditoria.utils';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Rango de un día en hora local (fix timezone) ─────────────────────────
  private rangoDia(fecha: string) {
    return { inicioDia: getInicioDiaRD(fecha), finDia: getFinDiaRD(fecha) };
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

  // ─── Helper: Calcular capital total de la empresa ────────────────────────
  private async calcularCapitalTotal(empresaId: string): Promise<number> {
    const capital = await this.prisma.capitalEmpresa.findUnique({
      where: { empresaId },
    });
    const inyecciones = await this.prisma.inyeccionCapital.aggregate({
      where: { empresaId },
      _sum: { monto: true },
    });
    const retiros = await this.prisma.retiroGanancias.aggregate({
      where: { empresaId },
      _sum: { monto: true },
    });

    const capitalBase = capital?.capitalInicial ?? 0;
    const totalInyectado = inyecciones._sum.monto ?? 0;
    const totalRetirado = retiros._sum.monto ?? 0;

    return Math.round((capitalBase + totalInyectado - totalRetirado) * 100) / 100;
  }

  // ─── Helper: Calcular dinero total en cajas abiertas ─────────────────────
  private async calcularDineroEnCajas(empresaId: string): Promise<number> {
    const cajas = await this.prisma.cajaSesion.groupBy({
      by: ['estado'],
      where: { empresaId },
      _sum: { montoInicial: true },
    });

    const abiertas = cajas.find((c) => c.estado === 'ABIERTA');
    return Math.round((abiertas?._sum?.montoInicial ?? 0) * 100) / 100;
  }

  // ─── Helper: Calcular dinero en calle (préstamos activos) ─────────────
  private async calcularDineroEnCalle(empresaId: string): Promise<number> {
    const prestamos = await this.prisma.prestamo.aggregate({
      where: {
        empresaId,
        estado: { in: ['ACTIVO', 'ATRASADO'] },
      },
      _sum: { monto: true },
    });

    const cobros = await this.prisma.pago.aggregate({
      where: {
        prestamo: { empresaId },
      },
      _sum: { capital: true },
    });

    const totalPrestado = prestamos._sum.monto ?? 0;
    const totalCobrado = cobros._sum.capital ?? 0;

    return Math.max(0, Math.round((totalPrestado - totalCobrado) * 100) / 100);
  }

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
          ? 'Ya tienes una cajaabierta para este día'
          : 'Ya cerraste tu caja hoy, no puedes abrir otra',
      );
    }

    // Validar capital disponible antes de abrir caja (no dineroEnCalle ya que eso NO puede reasignarse)
    if (montoInicial > 0) {
      // Capital disponible = CapitalTotal - dineroEnCalle (lo prestado no puede sacarse)
      const capitalTotal = await this.calcularCapitalTotal(empresaId);
      const dineroEnCalleVal = await this.calcularDineroEnCalle(empresaId);
      const capitalDisponible = Math.max(0, capitalTotal - dineroEnCalleVal);
      
      // Dinero ya en cajas abiertas
      const dineroEnCajasVal = await this.calcularDineroEnCajas(empresaId);
      const disponible = capitalDisponible - dineroEnCajasVal;

      if (montoInicial > disponible) {
        throw new BadRequestException(
          `No hay capital disponible suficiente para abrir esta caja. Disponible: RD$${disponible.toLocaleString()}, Solicitado: RD$${montoInicial.toLocaleString()}`
        );
      }
    }

    // Usar transacción para atomicidad
    const caja = await this.prisma.$transaction(async (tx) => {
      // Verificar dentro de transacción que no existe caja (evita race condition)
      const cajaDuplicada = await tx.cajaSesion.findFirst({
        where: { empresaId, usuarioId, fecha },
      });
      if (cajaDuplicada) {
        throw new BadRequestException(
          cajaDuplicada.estado === 'ABIERTA'
            ? 'Ya tienes una cajaabierta para este día'
            : 'Ya cerraste tu caja hoy, no puedes abrir otra',
        );
      }

      const nuevaCaja = await tx.cajaSesion.create({
        data: { fecha, montoInicial, estado: 'ABIERTA', empresaId, usuarioId },
        include: { usuario: { select: { id: true, nombre: true } } },
      });

      // Registrar apertura en ledger (solo si hay monto inicial)
      if (montoInicial > 0) {
        await tx.movimientoFinanciero.create({
          data: {
            tipo: 'APERTURA_CAJA',
            monto: montoInicial,
            capital: montoInicial,
            interes: 0,
            mora: 0,
            descripcion: `Apertura de caja con RD$${montoInicial.toLocaleString()}`,
            referenciaTipo: 'CAJA',
            referenciaId: nuevaCaja.id,
            cajaId: nuevaCaja.id,
            empresaId,
            usuarioId,
          },
        });
      }

      return nuevaCaja;
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

    // Usar transacción para atomicidad
    const cajaCerrada = await this.prisma.$transaction(async (tx) => {
      const cajaActualizada = await tx.cajaSesion.update({
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

      // Registrar cierre en ledger
      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'CIERRE_CAJA',
          monto: efectivoSistema,
          capital: efectivoSistema,
          interes: 0,
          mora: 0,
          descripcion: `Cierre caja: Sistema RD$${efectivoSistema.toLocaleString()}, Real RD$${efectivoReal.toLocaleString()}, Diferencia RD$${diferencia.toLocaleString()}`,
          referenciaTipo: 'CAJA',
          referenciaId: cajaId,
          cajaId: cajaId,
          empresaId,
          usuarioId,
        },
      });

      return cajaActualizada;
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