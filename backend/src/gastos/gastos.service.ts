import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { m, roundMoney } from '../common/utils/money';
import { CreateGastoDto, UpdateGastoDto } from './dto/gastos.dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user.rol !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo el administrador puede gestionar gastos',
      );
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
    const inicioMes = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1),
    );
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
      porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + m(g.monto);
    });

    return {
      totalMes: m(totalMes._sum.monto || 0),
      totalAno: m(totalAno._sum.monto || 0),
      totalGral: todos.reduce((s, g) => s + m(g.monto), 0),
      porCategoria,
    };
  }

  // ─── CREAR ────────────────────────────────────────────────────────────────

  async create(dto: CreateGastoDto, user: any) {
    this.assertAdmin(user);

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del gasto debe ser mayor a 0');
    }

    const tipo = dto.tipo || 'OPERATIVO';
    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.create({
        data: {
          categoria: dto.categoria,
          descripcion: dto.descripcion,
          monto: dto.monto,
          fecha: new Date(dto.fecha),
          proveedor: dto.proveedor || null,
          referencia: dto.referencia || null,
          observaciones: dto.observaciones || null,
          empresaId: user.empresaId,
          usuarioId: user.userId,
          tipo,
        },
      });

      await this.crearMovimiento(
        tx,
        {
          tipo,
          monto: dto.monto,
          categoria: dto.categoria,
          descripcion: dto.descripcion,
        },
        gasto.id,
        user,
      );

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

    const montoFinal = dto.monto ?? m(gasto.monto);
    const tipoFinal = dto.tipo || gasto.tipo || 'OPERATIVO';

    await this.prisma.$transaction(async (tx) => {
      await tx.gasto.update({
        where: { id },
        data: {
          ...(dto.categoria && { categoria: dto.categoria }),
          ...(dto.descripcion && { descripcion: dto.descripcion }),
          ...(dto.monto && { monto: dto.monto }),
          ...(dto.fecha && { fecha: new Date(dto.fecha) }),
          ...(dto.proveedor !== undefined && {
            proveedor: dto.proveedor || null,
          }),
          ...(dto.referencia !== undefined && {
            referencia: dto.referencia || null,
          }),
          ...(dto.observaciones !== undefined && {
            observaciones: dto.observaciones || null,
          }),
          ...(dto.tipo && { tipo: dto.tipo }),
        },
      });

      await this.sincronizarMovimiento(
        tx,
        id,
        {
          tipo: tipoFinal,
          monto: montoFinal,
          categoria: dto.categoria ?? gasto.categoria,
          descripcion: dto.descripcion ?? gasto.descripcion,
        },
        user,
      );
    });

    return this.prisma.gasto.findUnique({
      where: { id },
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

    await this.prisma.$transaction(async (tx) => {
      // Revertir el impacto en el ledger al eliminar el gasto
      await tx.movimientoFinanciero.deleteMany({
        where: { referenciaTipo: 'GASTO', referenciaId: id },
      });
      await tx.gasto.delete({ where: { id } });
    });

    return { mensaje: 'Gasto eliminado correctamente' };
  }

  // ─── HELPERS (ledger) ─────────────────────────────────────────────────────

  /** Ganancias netas actuales = (intereses + mora) - gastos operativos. */
  private async calcularGananciasNetas(
    tx: Prisma.TransactionClient,
    empresaId: string,
  ): Promise<number> {
    const [ingresos, gastos] = await Promise.all([
      tx.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'PAGO_RECIBIDO' },
        _sum: { interes: true, mora: true },
      }),
      tx.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'GASTO' },
        _sum: { interes: true },
      }),
    ]);
    return Math.max(
      0,
      roundMoney(
        m(ingresos._sum.interes ?? 0) +
          m(ingresos._sum.mora ?? 0) -
          Math.abs(m(gastos._sum.interes ?? 0)),
      ),
    );
  }

  /** Resuelve (o crea) el movimiento financiero ligado a un gasto. */
  private async resolverMovimiento(
    tx: Prisma.TransactionClient,
    gastoId: string,
  ) {
    return tx.movimientoFinanciero.findFirst({
      where: { referenciaTipo: 'GASTO', referenciaId: gastoId },
    });
  }

  private async crearMovimiento(
    tx: Prisma.TransactionClient,
    datos: {
      tipo: string;
      monto: number;
      categoria: string;
      descripcion: string;
    },
    gastoId: string,
    user: any,
  ) {
    const tipoMovimiento = datos.tipo === 'CAPITAL' ? 'GASTO_CAPITAL' : 'GASTO';
    const gananciasNetas = await this.calcularGananciasNetas(
      tx,
      user.empresaId,
    );

    const excedeGanancias =
      datos.tipo === 'OPERATIVO' && datos.monto > gananciasNetas;

    // OPERATIVO: consume ganancias (interes, negativo). Si excede, el resto
    // consume capital (capital > 0). CAPITAL: descuenta capital directamente.
    const capital =
      datos.tipo === 'CAPITAL'
        ? datos.monto
        : excedeGanancias
          ? roundMoney(datos.monto - gananciasNetas)
          : 0;

    await tx.movimientoFinanciero.create({
      data: {
        tipo: tipoMovimiento,
        monto: datos.monto,
        capital,
        interes: datos.tipo === 'OPERATIVO' ? -datos.monto : 0,
        mora: 0,
        referenciaTipo: 'GASTO',
        referenciaId: gastoId,
        cajaId: null, // Gastos nunca afectan caja operativa
        empresaId: user.empresaId,
        usuarioId: user.userId,
        descripcion: `${datos.categoria}: ${datos.descripcion}${excedeGanancias ? ' (Excede ganancias, reduce capital)' : ''}`,
      },
    });
  }

  private async sincronizarMovimiento(
    tx: Prisma.TransactionClient,
    gastoId: string,
    datos: {
      tipo: string;
      monto: number;
      categoria: string;
      descripcion: string;
    },
    user: any,
  ) {
    const existente = await this.resolverMovimiento(tx, gastoId);
    if (!existente) {
      await this.crearMovimiento(tx, datos, gastoId, user);
      return;
    }

    // Recalcular el movimiento descontando el impacto previo: las ganancias
    // netas se calculan excluyendo este gasto.
    const [ingresos, gastos] = await Promise.all([
      tx.movimientoFinanciero.aggregate({
        where: { empresaId: user.empresaId, tipo: 'PAGO_RECIBIDO' },
        _sum: { interes: true, mora: true },
      }),
      tx.movimientoFinanciero.aggregate({
        where: {
          empresaId: user.empresaId,
          tipo: 'GASTO',
          NOT: { referenciaTipo: 'GASTO', referenciaId: gastoId },
        },
        _sum: { interes: true },
      }),
    ]);
    const gananciasBase = Math.max(
      0,
      roundMoney(
        m(ingresos._sum.interes ?? 0) +
          m(ingresos._sum.mora ?? 0) -
          Math.abs(m(gastos._sum.interes ?? 0)),
      ),
    );

    const tipoMovimiento = datos.tipo === 'CAPITAL' ? 'GASTO_CAPITAL' : 'GASTO';
    const excedeGanancias =
      datos.tipo === 'OPERATIVO' && datos.monto > gananciasBase;
    const capital =
      datos.tipo === 'CAPITAL'
        ? datos.monto
        : excedeGanancias
          ? roundMoney(datos.monto - gananciasBase)
          : 0;

    await tx.movimientoFinanciero.update({
      where: { id: existente.id },
      data: {
        tipo: tipoMovimiento,
        monto: datos.monto,
        capital,
        interes: datos.tipo === 'OPERATIVO' ? -datos.monto : 0,
        descripcion: `${datos.categoria}: ${datos.descripcion}${excedeGanancias ? ' (Excede ganancias, reduce capital)' : ''}`,
      },
    });
  }
}
