import {
  Injectable, ForbiddenException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGastoDto, UpdateGastoDto } from './dto/gastos.dto';

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo el administrador puede gestionar gastos');
    }
  }

  /**
   * Convierte "YYYY-MM-DD" al inicio del día en UTC: 2026-03-01T00:00:00.000Z
   * Extrae siempre solo los primeros 10 chars para ignorar cualquier hora/zona
   * que pueda venir en el string (ej: "2026-03-01T12:00:00.000Z" → "2026-03-01").
   */
  private startOfDay(dateStr: string): Date {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  }

  /**
   * Convierte "YYYY-MM-DD" al final del día en UTC: 2026-03-01T23:59:59.999Z
   * Así cualquier gasto guardado ese día (T00:00 a T23:59 UTC) queda dentro.
   */
  private endOfDay(dateStr: string): Date {
    return new Date(`${dateStr.slice(0, 10)}T23:59:59.999Z`);
  }

  // ─── LISTAR con filtros opcionales ───────────────────────────────────────

  async findAll(user: any, desde?: string, hasta?: string, categoria?: string) {
    this.assertAdmin(user);

    return this.prisma.gasto.findMany({
      where: {
        empresaId: user.empresaId,
        ...(categoria && { categoria }),
        ...((desde || hasta) && {
          fecha: {
            // ✅ FIX TIMEZONE: construir los límites en UTC puro con T00/T23.
            // El bug anterior: new Date(hasta).setHours(23,59,59,999) operaba
            // en hora LOCAL del servidor, causando que gastos guardados a
            // mediodía UTC quedaran fuera del rango cuando hasta === desde.
            ...(desde && { gte: this.startOfDay(desde) }),
            ...(hasta && { lte: this.endOfDay(hasta) }),
          },
        }),
      },
      include: {
        usuario: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  // ─── RESUMEN para dashboard ───────────────────────────────────────────────

  async resumen(user: any) {
    this.assertAdmin(user);

    const ahora = new Date();
    // ✅ Usar UTC explícito para que los límites de mes/año sean correctos
    // independientemente de la zona horaria del servidor
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const inicioAno = new Date(Date.UTC(ahora.getUTCFullYear(), 0, 1));

    const [totalMes, totalAno, todos] = await Promise.all([
      this.prisma.gasto.aggregate({
        where: { empresaId: user.empresaId, fecha: { gte: inicioMes } },
        _sum: { monto: true },
      }),
      this.prisma.gasto.aggregate({
        where: { empresaId: user.empresaId, fecha: { gte: inicioAno } },
        _sum: { monto: true },
      }),
      this.prisma.gasto.findMany({
        where: { empresaId: user.empresaId },
        select: { categoria: true, monto: true },
      }),
    ]);

    const porCategoria: Record<string, number> = {};
    todos.forEach((g) => {
      porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.monto;
    });

    return {
      totalMes:  totalMes._sum.monto  || 0,
      totalAno:  totalAno._sum.monto  || 0,
      totalGral: todos.reduce((s, g) => s + g.monto, 0),
      porCategoria,
    };
  }

  // ─── CREAR ────────────────────────────────────────────────────────────────

  async create(dto: CreateGastoDto, user: any) {
    this.assertAdmin(user);

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del gasto debe ser mayor a 0');
    }

    // Validar que haya dinero disponible en cajas
    const cajas = await this.prisma.cajaSesion.aggregate({
      where: { empresaId: user.empresaId, estado: 'ABIERTA' },
      _sum: { montoInicial: true },
    });
    const pagos = await this.prisma.pago.aggregate({
      where: { prestamo: { empresaId: user.empresaId } },
      _sum: { montoTotal: true },
    });
    const desembolsos = await this.prisma.desembolsoCaja.aggregate({
      where: { empresaId: user.empresaId },
      _sum: { monto: true },
    });

    const dineroEnCaja = Math.round(
      ((cajas._sum.montoInicial ?? 0) + (pagos._sum.montoTotal ?? 0) - (desembolsos._sum.monto ?? 0)) * 100
    ) / 100;

    if (dto.monto > dineroEnCaja) {
      throw new BadRequestException(
        `Fondos insuficientes en caja. Disponible: RD$${dineroEnCaja.toLocaleString()}, Solicitado: RD$${dto.monto.toLocaleString()}`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data: {
          categoria:     dto.categoria,
          descripcion:   dto.descripcion,
          monto:         dto.monto,
          fecha:         new Date(dto.fecha),
          proveedor:     dto.proveedor     || null,
          referencia:    dto.referencia    || null,
          observaciones: dto.observaciones || null,
          empresaId:     user.empresaId,
          usuarioId:     user.userId,
        },
      });

      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'GASTO',
          monto: dto.monto,
          capital: 0,
          interes: 0,
          mora: 0,
          referenciaTipo: 'GASTO',
          referenciaId: gasto.id,
          empresaId: user.empresaId,
          usuarioId: user.userId,
          descripcion: `${dto.categoria}: ${dto.descripcion}`,
        },
      });

      return gasto;
    });
  }

  // ─── ACTUALIZAR ───────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateGastoDto, user: any) {
    this.assertAdmin(user);

    const gasto = await this.prisma.gasto.findFirst({
      where: { id, empresaId: user.empresaId },
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    return this.prisma.gasto.update({
      where: { id },
      data: {
        ...(dto.categoria     && { categoria:    dto.categoria }),
        ...(dto.descripcion   && { descripcion:  dto.descripcion }),
        ...(dto.monto         && { monto:        dto.monto }),
        ...(dto.fecha         && { fecha:        new Date(dto.fecha) }),
        ...(dto.proveedor     !== undefined && { proveedor:     dto.proveedor     || null }),
        ...(dto.referencia    !== undefined && { referencia:    dto.referencia    || null }),
        ...(dto.observaciones !== undefined && { observaciones: dto.observaciones || null }),
      },
      include: { usuario: { select: { nombre: true } } },
    });
  }

  // ─── ELIMINAR ─────────────────────────────────────────────────────────────

  async remove(id: string, user: any) {
    this.assertAdmin(user);

    const gasto = await this.prisma.gasto.findFirst({
      where: { id, empresaId: user.empresaId },
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');

    await this.prisma.gasto.delete({ where: { id } });
    return { mensaje: 'Gasto eliminado correctamente' };
  }
}