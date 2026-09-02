// src/common/quota/quota.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { m } from '../utils/money';

export type QuotaTipo =
  | 'usuarios'
  | 'clientes'
  | 'prestamos'
  | 'prestamosActivos'
  | 'rutas'
  | 'empleados'
  | 'montoPrestamo';

export interface QuotaResult {
  tipo: QuotaTipo;
  uso: number;
  max: number | null;
  porcentaje: number | null;
  advertencia: boolean;
  mensaje?: string;
}

interface LimiteRow {
  maxUsuarios: number | null;
  maxClientes: number | null;
  maxPrestamos: number | null;
  maxPrestamosActivos: number | null;
  maxRutas: number | null;
  maxEmpleados: number | null;
  maxMontoPorPrestamo: number | Prisma.Decimal | null;
}

const UMBRAL_ADVERTENCIA = 0.9;

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  private async getLimite(empresaId: string): Promise<LimiteRow | null> {
    return this.prisma.limiteEmpresa.findUnique({
      where: { empresaId },
      select: {
        maxUsuarios: true,
        maxClientes: true,
        maxPrestamos: true,
        maxPrestamosActivos: true,
        maxRutas: true,
        maxEmpleados: true,
        maxMontoPorPrestamo: true,
      },
    });
  }

  // ─── Uso en vivo de la empresa (todas las cuotas) ─────────────────────────
  async contarUso(empresaId: string) {
    const [usuarios, clientes, prestamos, prestamosActivos, rutas, empleados] =
      await Promise.all([
        this.prisma.usuario.count({ where: { empresaId } }),
        this.prisma.cliente.count({ where: { empresaId, activo: true } }),
        this.prisma.prestamo.count({ where: { empresaId } }),
        this.prisma.prestamo.count({
          where: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
        }),
        this.prisma.ruta.count({ where: { empresaId, activa: true } }),
        this.prisma.empleado.count({ where: { empresaId, activo: true } }),
      ]);

    return {
      usuarios,
      clientes,
      prestamos,
      prestamosActivos,
      rutas,
      empleados,
    };
  }

  private async usoDe(empresaId: string, tipo: QuotaTipo): Promise<number> {
    switch (tipo) {
      case 'usuarios':
        return this.prisma.usuario.count({ where: { empresaId } });
      case 'clientes':
        return this.prisma.cliente.count({
          where: { empresaId, activo: true },
        });
      case 'prestamos':
        return this.prisma.prestamo.count({ where: { empresaId } });
      case 'prestamosActivos':
        return this.prisma.prestamo.count({
          where: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
        });
      case 'rutas':
        return this.prisma.ruta.count({ where: { empresaId, activa: true } });
      case 'empleados':
        return this.prisma.empleado.count({
          where: { empresaId, activo: true },
        });
      default:
        return 0;
    }
  }

  private static maxPara(
    limite: LimiteRow | null,
    tipo: QuotaTipo,
  ): number | null {
    switch (tipo) {
      case 'usuarios':
        return limite?.maxUsuarios ?? null;
      case 'clientes':
        return limite?.maxClientes ?? null;
      case 'prestamos':
        return limite?.maxPrestamos ?? null;
      case 'prestamosActivos':
        return limite?.maxPrestamosActivos ?? null;
      case 'rutas':
        return limite?.maxRutas ?? null;
      case 'empleados':
        return limite?.maxEmpleados ?? null;
      case 'montoPrestamo':
        return QuotaService.montoMaxPara(limite);
      default:
        return null;
    }
  }

  private static montoMaxPara(limite: LimiteRow | null): number | null {
    const v = limite?.maxMontoPorPrestamo;
    return v == null ? null : m(v);
  }

  /**
   * Verifica una cuota ANTES de crear. Bloqueo duro al 100% (lanza ForbiddenException).
   * Aviso suave al >= 90% (se devuelve advertencia sin lanzar).
   *
   * - max == null  → sin límite: nunca bloquea ni avisa.
   * - 'montoPrestamo' usa `opts.monto` (límite por operación, no conteo).
   */
  async verificar(
    empresaId: string,
    tipo: QuotaTipo,
    opts: { monto?: number } = {},
  ): Promise<QuotaResult> {
    const limite = await this.getLimite(empresaId);

    if (tipo === 'montoPrestamo') {
      const max = QuotaService.maxPara(limite, 'montoPrestamo');
      const uso = opts.monto ?? 0;
      if (max == null) {
        return {
          tipo,
          uso,
          max: null,
          porcentaje: null,
          advertencia: false,
        };
      }
      if (uso > max) {
        throw new ForbiddenException({
          message: `El monto supera el límite por préstamo del plan (RD$${max.toLocaleString()}).`,
          code: 'LIMITE_MONTO_PLAN',
        });
      }
      return {
        tipo,
        uso,
        max,
        porcentaje: Math.round((uso / max) * 100),
        advertencia: uso / max >= UMBRAL_ADVERTENCIA,
      };
    }

    const max = QuotaService.maxPara(limite, tipo);
    if (max == null) {
      return { tipo, uso: 0, max: null, porcentaje: null, advertencia: false };
    }

    const uso = await this.usoDe(empresaId, tipo);
    if (uso >= max) {
      throw new ForbiddenException({
        message: `Límite del plan alcanzado: ${tipo} (${uso}/${max}). Contacta al soporte de la plataforma.`,
        code: 'LIMITE_PLAN_ALCANZADO',
      });
    }

    const porcentaje = Math.round((uso / max) * 100);
    const advertencia = uso / max >= UMBRAL_ADVERTENCIA;

    return {
      tipo,
      uso,
      max,
      porcentaje,
      advertencia,
      mensaje: advertencia
        ? `Aviso: estás al ${porcentaje}% de tu límite de ${tipo} (${uso}/${max}).`
        : undefined,
    };
  }

  // ─── Estado completo de cuotas (para UI/aviso 90%) ────────────────────────
  async estadoCuotas(empresaId: string) {
    const [uso, limite] = await Promise.all([
      this.contarUso(empresaId),
      this.getLimite(empresaId),
    ]);

    const campos: Array<{ tipo: QuotaTipo; uso: number }> = [
      { tipo: 'usuarios', uso: uso.usuarios },
      { tipo: 'clientes', uso: uso.clientes },
      { tipo: 'prestamos', uso: uso.prestamos },
      { tipo: 'prestamosActivos', uso: uso.prestamosActivos },
      { tipo: 'rutas', uso: uso.rutas },
      { tipo: 'empleados', uso: uso.empleados },
    ];

    const cuotas = campos.map(({ tipo, uso: n }) => {
      const max = QuotaService.maxPara(limite, tipo);
      const porcentaje =
        max == null || max === 0 ? null : Math.round((n / max) * 100);
      return {
        tipo,
        uso: n,
        max,
        porcentaje,
        advertencia: porcentaje != null && porcentaje >= 90,
      };
    });

    const montoMax = QuotaService.maxPara(limite, 'montoPrestamo');

    return {
      empresaId,
      cuotas,
      montoMaxPorPrestamo: montoMax,
      advertencias: cuotas.filter((c) => c.advertencia),
    };
  }
}
