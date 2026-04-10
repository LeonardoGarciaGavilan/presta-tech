// src/empleados/empleados.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helper ───────────────────────────────────────────────────────────────

  private async assertEmpleado(id: string, empresaId: string) {
    const emp = await (this.prisma as any).empleado.findFirst({
      where: { id, empresaId },
    });
    if (!emp) throw new NotFoundException(`Empleado ${id} no encontrado`);
    return emp;
  }

  // ─── EMPLEADOS ────────────────────────────────────────────────────────────

  async findAll(empresaId: string, soloActivos = true) {
    return (this.prisma as any).empleado.findMany({
      where: { empresaId, ...(soloActivos && { activo: true }) },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
  }

  async findOne(id: string, empresaId: string) {
    return this.assertEmpleado(id, empresaId);
  }

  async create(dto: any, empresaId: string) {
    return (this.prisma as any).empleado.create({
      data: {
        ...dto,
        empresaId,
        // Prisma exige DateTime ISO completo — "2026-03-14" no es válido solo
        fechaIngreso: dto.fechaIngreso
          ? new Date(`${dto.fechaIngreso}T12:00:00`)
          : new Date(),
      },
    });
  }

  async update(id: string, dto: any, empresaId: string) {
    await this.assertEmpleado(id, empresaId);
    const data = { ...dto };
    if (data.fechaIngreso && typeof data.fechaIngreso === 'string') {
      data.fechaIngreso = new Date(`${data.fechaIngreso}T12:00:00`);
    }
    return (this.prisma as any).empleado.update({
      where: { id },
      data,
    });
  }

  async desactivar(id: string, empresaId: string) {
    await this.assertEmpleado(id, empresaId);
    return (this.prisma as any).empleado.update({
      where: { id },
      data: { activo: false },
    });
  }

  async reactivar(id: string, empresaId: string) {
    await this.assertEmpleado(id, empresaId);
    return (this.prisma as any).empleado.update({
      where: { id },
      data: { activo: true },
    });
  }

  // ─── ASISTENCIA ───────────────────────────────────────────────────────────

  async getAsistencia(empresaId: string, fecha: string) {
    // Devuelve lista de empleados activos con su asistencia del día (si existe)
    const empleados = await (this.prisma as any).empleado.findMany({
      where: { empresaId, activo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });

    const registros = await (this.prisma as any).asistenciaEmpleado.findMany({
      where: { empresaId, fecha },
    });

    const mapaRegistros = new Map(registros.map((r: any) => [r.empleadoId, r]));

    return empleados.map((emp: any) => ({
      empleado: emp,
      asistencia: mapaRegistros.get(emp.id) ?? null,
    }));
  }

  async getAsistenciaMes(empresaId: string, empleadoId: string, mes: string) {
    // mes: YYYY-MM
    await this.assertEmpleado(empleadoId, empresaId);
    return (this.prisma as any).asistenciaEmpleado.findMany({
      where: {
        empleadoId,
        empresaId,
        fecha: { startsWith: mes },
      },
      orderBy: { fecha: 'asc' },
    });
  }

  async registrarAsistencia(empresaId: string, dto: any) {
    // dto: { empleadoId, fecha, entrada?, salida?, estado, observacion? }
    await this.assertEmpleado(dto.empleadoId, empresaId);

    // Calcular horas trabajadas si hay entrada y salida
    let horasTrabajadas: number | null = null;
    if (dto.entrada && dto.salida) {
      const [hE, mE] = dto.entrada.split(':').map(Number);
      const [hS, mS] = dto.salida.split(':').map(Number);
      horasTrabajadas = Math.max(0, (hS * 60 + mS - (hE * 60 + mE)) / 60);
    }

    return (this.prisma as any).asistenciaEmpleado.upsert({
      where: { empleadoId_fecha: { empleadoId: dto.empleadoId, fecha: dto.fecha } },
      update: {
        entrada: dto.entrada ?? null,
        salida: dto.salida ?? null,
        horasTrabajadas,
        estado: dto.estado,
        observacion: dto.observacion ?? null,
      },
      create: {
        empleadoId: dto.empleadoId,
        empresaId,
        fecha: dto.fecha,
        entrada: dto.entrada ?? null,
        salida: dto.salida ?? null,
        horasTrabajadas,
        estado: dto.estado,
        observacion: dto.observacion ?? null,
      },
    });
  }

  // ─── DESCUENTOS ───────────────────────────────────────────────────────────

  async getDescuentosPendientes(empleadoId: string, empresaId: string) {
    await this.assertEmpleado(empleadoId, empresaId);
    return (this.prisma as any).descuentoEmpleado.findMany({
      where: { empleadoId, empresaId, aplicado: false },
      orderBy: { fecha: 'desc' },
    });
  }

  async crearDescuento(empresaId: string, dto: any) {
    await this.assertEmpleado(dto.empleadoId, empresaId);
    return (this.prisma as any).descuentoEmpleado.create({
      data: { ...dto, empresaId },
    });
  }

  async eliminarDescuento(id: string, empresaId: string) {
    const desc = await (this.prisma as any).descuentoEmpleado.findFirst({
      where: { id, empresaId },
    });
    if (!desc) throw new NotFoundException('Descuento no encontrado');
    if (desc.aplicado) throw new BadRequestException('No se puede eliminar un descuento ya aplicado');
    return (this.prisma as any).descuentoEmpleado.delete({ where: { id } });
  }

  // ─── PAGOS DE SALARIO ─────────────────────────────────────────────────────

  async getPagos(empresaId: string, empleadoId?: string) {
    return (this.prisma as any).pagoSalario.findMany({
      where: { empresaId, ...(empleadoId && { empleadoId }) },
      include: {
        empleado: { select: { nombre: true, apellido: true, cargo: true } },
      },
      orderBy: { fechaPago: 'desc' },
      take: 200,
    });
  }

  async registrarPago(empresaId: string, dto: any) {
    // dto: { empleadoId, periodo, descripcion?, metodoPago, referencia?, observaciones?, descuentoIds? }
    const empleado = await this.assertEmpleado(dto.empleadoId, empresaId);

    // Calcular descuentos pendientes seleccionados
    let totalDescuentos = 0;
    if (dto.descuentoIds?.length) {
      const descuentos = await (this.prisma as any).descuentoEmpleado.findMany({
        where: { id: { in: dto.descuentoIds }, empleadoId: dto.empleadoId, aplicado: false },
      });
      totalDescuentos = descuentos.reduce((s: number, d: any) => s + d.monto, 0);
    }

    const salarioBruto = empleado.salario;
    const salarioNeto = Math.max(0, salarioBruto - totalDescuentos);

    const pago = await (this.prisma as any).pagoSalario.create({
      data: {
        empleadoId: dto.empleadoId,
        empresaId,
        periodo: dto.periodo,
        descripcion: dto.descripcion ?? null,
        salarioBruto,
        totalDescuentos,
        salarioNeto,
        metodoPago: dto.metodoPago ?? 'EFECTIVO',
        referencia: dto.referencia ?? null,
        observaciones: dto.observaciones ?? null,
      },
    });

    // Marcar descuentos como aplicados
    if (dto.descuentoIds?.length) {
      await (this.prisma as any).descuentoEmpleado.updateMany({
        where: { id: { in: dto.descuentoIds } },
        data: { aplicado: true },
      });
    }

    return pago;
  }

  // ─── RESUMEN / STATS ──────────────────────────────────────────────────────

  async getResumen(empresaId: string) {
    const [empleados, asistenciaHoy, descuentosPendientes, pagosMes] =
      await Promise.all([
        (this.prisma as any).empleado.findMany({
          where: { empresaId, activo: true },
          select: { id: true, salario: true, frecuenciaPago: true },
        }),
        (this.prisma as any).asistenciaEmpleado.findMany({
          where: {
            empresaId,
            fecha: new Date().toISOString().slice(0, 10),
          },
        }),
        (this.prisma as any).descuentoEmpleado.aggregate({
          where: { empresaId, aplicado: false },
          _sum: { monto: true },
          _count: true,
        }),
        (this.prisma as any).pagoSalario.aggregate({
          where: {
            empresaId,
            fechaPago: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { salarioNeto: true },
          _count: true,
        }),
      ]);

    const nominalMensual = empleados.reduce((s: number, e: any) => {
      const factor = e.frecuenciaPago === 'SEMANAL' ? 4
        : e.frecuenciaPago === 'QUINCENAL' ? 2 : 1;
      return s + e.salario * factor;
    }, 0);

    const presentesHoy = asistenciaHoy.filter((a: any) => a.estado === 'PRESENTE' || a.estado === 'TARDANZA').length;
    const ausentesHoy = asistenciaHoy.filter((a: any) => a.estado === 'AUSENTE').length;

    return {
      totalEmpleados: empleados.length,
      nominalMensual,
      presentesHoy,
      ausentesHoy,
      descuentosPendientesMonto: descuentosPendientes._sum.monto ?? 0,
      descuentosPendientesCount: descuentosPendientes._count,
      pagadoEsteMes: pagosMes._sum.salarioNeto ?? 0,
      pagosMesCount: pagosMes._count,
    };
  }
}