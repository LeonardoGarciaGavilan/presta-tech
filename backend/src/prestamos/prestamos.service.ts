import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrestamoDto } from './dto/create-prestamo.dto';
import { UpdatePrestamoDto } from './dto/update-prestamo.dto';
import { RefinanciarPrestamoDto } from './dto/refinanciar-prestamo.dto';
import { EstadoPrestamo, FrecuenciaPago, MetodoPago } from '@prisma/client';
import { AlertsGateway } from '../alerts/alerts.gateway';
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  differenceInDays,
} from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import { TenantUtils } from '../common/utils/tenant.utils';
import { ConfiguracionUtils } from '../common/utils/configuracion.utils';
import { registrarAuditoria } from '../common/utils/auditoria.utils';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';

export interface CuotaCalculada {
  numero: number;
  fechaVencimiento: Date;
  capital: number;
  interes: number;
  monto: number;
  saldoRestante: number;
}

export interface ResumenAmortizacion {
  cuotaInicial: number;
  montoTotal: number;
  totalIntereses: number;
  cuotas: CuotaCalculada[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

const DIAS_FRECUENCIA: Record<FrecuenciaPago, number> = {
  DIARIO: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

export type TipoAlerta =
  | 'REFINANCIAMIENTO'
  | 'CAMBIO_FRECUENCIA'
  | 'CAMBIO_TASA'
  | 'CAMBIO_CUOTAS'
  | 'CAMBIO_FECHA_PAGO'
  | 'CANCELACION'
  | 'CAMBIO_ESTADO';

@Injectable()
export class PrestamosService {
  private readonly TIMEZONE_RD = 'America/Santo_Domingo';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly alertsGateway?: AlertsGateway,
    @Inject(CACHE_MANAGER) @Optional() private cacheManager?: Cache,
  ) {}

  private getFechaRD(): string {
    const now = new Date();
    const zonedDate = toZonedTime(now, this.TIMEZONE_RD);
    return format(zonedDate, 'yyyy-MM-dd');
  }

  private siguienteFecha(
    fecha: Date,
    frecuencia: FrecuenciaPago,
    numero: number,
  ): Date {
    switch (frecuencia) {
      case FrecuenciaPago.DIARIO:
        return addDays(fecha, numero);
      case FrecuenciaPago.SEMANAL:
        return addWeeks(fecha, numero);
      case FrecuenciaPago.QUINCENAL:
        return addDays(fecha, numero * 15);
      case FrecuenciaPago.MENSUAL:
      default:
        return addMonths(fecha, numero);
    }
  }

  private calcularAmortizacion(
    monto: number,
    tasaMensual: number,
    numeroCuotas: number,
    frecuenciaPago: FrecuenciaPago,
    fechaInicio: Date,
  ): ResumenAmortizacion {
    const diasPeriodo = DIAS_FRECUENCIA[frecuenciaPago];
    const tasaPeriodo = tasaMensual * (diasPeriodo / 30);

    let cuotaFija: number;
    if (tasaPeriodo === 0) {
      cuotaFija = Math.round((monto / numeroCuotas) * 100) / 100;
    } else {
      const factor = Math.pow(1 + tasaPeriodo, numeroCuotas);
      cuotaFija =
        Math.round(((monto * (tasaPeriodo * factor)) / (factor - 1)) * 100) /
        100;
    }

    let saldo = monto;
    let totalIntereses = 0;
    const cuotas: CuotaCalculada[] = [];

    for (let i = 1; i <= numeroCuotas; i++) {
      const interes = Math.round(saldo * tasaPeriodo * 100) / 100;
      const capital =
        i === numeroCuotas
          ? Math.round(saldo * 100) / 100
          : Math.round((cuotaFija - interes) * 100) / 100;
      const montoCuota = Math.round((capital + interes) * 100) / 100;
      const fechaVencimiento = this.siguienteFecha(
        fechaInicio,
        frecuenciaPago,
        i,
      );

      cuotas.push({
        numero: i,
        fechaVencimiento,
        capital,
        interes,
        monto: montoCuota,
        saldoRestante: Math.max(0, Math.round((saldo - capital) * 100) / 100),
      });

      totalIntereses += interes;
      saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100);
    }

    const totalInteresesRedondeado = Math.round(totalIntereses * 100) / 100;

    return {
      cuotaInicial: cuotas[0].monto,
      montoTotal: Math.round((monto + totalInteresesRedondeado) * 100) / 100,
      totalIntereses: totalInteresesRedondeado,
      cuotas,
    };
  }

  private async calcularMora(
    empresaId: string,
    cuota: { id: string; fechaVencimiento: Date; monto: number; mora: number },
  ): Promise<number> {
    if (cuota.mora > 0) return cuota.mora;

    let config: any = null;
    const cacheKey = `config:${empresaId}`;

    if (this.cacheManager) {
      config = await this.cacheManager.get(cacheKey);
    }

    if (!config) {
      config = await this.prisma.configuracion.findUnique({
        where: { empresaId },
      });
      if (config && this.cacheManager) {
        await this.cacheManager.set(cacheKey, config, 300_000);
      }
    }

    if (!config) return 0;

    const hoy = startOfDay(new Date());
    const vencimiento = startOfDay(new Date(cuota.fechaVencimiento));
    const diasAtraso = differenceInDays(hoy, vencimiento);

    if (diasAtraso <= (config.diasGracia ?? 0)) return 0;

    return (
      Math.round(cuota.monto * (config.moraPorcentajeMensual / 100) * 100) / 100
    );
  }

  // ─── FUNCIÓN ÚNICA PARA CALCULAR SALDO PENDIENTE ────────────────────────
  // El saldo real se calcula DESDE las cuotas, no desde el campo almacenado
  private async calcularSaldoPendiente(
    tx: any,
    prestamoId: string,
  ): Promise<number> {
    const cuotas = await tx.cuota.findMany({
      where: { prestamoId, pagada: false },
      select: { capital: true, interes: true, mora: true },
    });

    const saldo = cuotas.reduce(
      (sum, c) => sum + c.capital + c.interes + (c.mora || 0),
      0,
    );

    return Math.round(saldo * 100) / 100;
  }

  // ─── FUNCIÓN ÚNICA PARA CALCULAR MORA ACUMULADA ────────────────────────────
  // La mora real se calcula DESDE las cuotas, no desde el campo almacenado
  private async calcularMoraAcumulada(
    tx: any,
    prestamoId: string,
  ): Promise<number> {
    const cuotas = await tx.cuota.findMany({
      where: { prestamoId, pagada: false },
      select: { mora: true },
    });

    const mora = cuotas.reduce(
      (sum, c) => sum + (c.mora || 0),
      0,
    );

    return Math.round(mora * 100) / 100;
  }

  // ─── FUNCIÓN HELPER PARA CALCULAR DESDE OBJETO ───────────────────────────────
  // Calcula saldo y mora desde el objeto prestamo (que ya tiene cuotas cargadas)
  // Útil para listados y respuestas API
  private calcularDesdeObjeto(prestamo: any): { saldoPendiente: number; moraAcumulada: number } {
    const cuotasPendientes = prestamo.cuotas?.filter((c: any) => !c.pagada) ?? [];
    
    const saldo = cuotasPendientes.reduce(
      (sum: number, c: any) => sum + c.capital + c.interes + (c.mora || 0),
      0,
    );
    
    const mora = cuotasPendientes.reduce(
      (sum: number, c: any) => sum + (c.mora || 0),
      0,
    );
    
    return {
      saldoPendiente: Math.round(saldo * 100) / 100,
      moraAcumulada: Math.round(mora * 100) / 100,
    };
  }

  private async assertPrestamoExists(id: string, empresaId: string) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id, empresaId },
    });
    if (!prestamo) throw new NotFoundException(`Préstamo ${id} no encontrado`);
    return prestamo;
  }

  private async crearAlerta(params: {
    empresaId: string;
    prestamoId: string;
    clienteNombre: string;
    tipo: TipoAlerta;
    descripcion: string;
    detalle?: Record<string, any>;
    usuarioId: string;
    usuarioNombre?: string;
  }) {
    try {
      let nombreFinal = params.usuarioNombre ?? 'Sistema';
      if (
        !params.usuarioNombre &&
        params.usuarioId &&
        params.usuarioId !== 'sistema'
      ) {
        const usr = await this.prisma.usuario.findUnique({
          where: { id: params.usuarioId },
          select: { nombre: true },
        });
        if (usr?.nombre) nombreFinal = usr.nombre;
      }

      const alertaCreada = await (this.prisma as any).alerta.create({
        data: {
          empresaId: params.empresaId,
          prestamoId: params.prestamoId,
          clienteNombre: params.clienteNombre,
          tipo: params.tipo,
          descripcion: params.descripcion,
          detalle: params.detalle ?? {},
          usuarioId: params.usuarioId,
          usuarioNombre: nombreFinal,
          leida: false,
        },
      });

      if (this.alertsGateway) {
        this.alertsGateway.emitirNuevaAlerta(params.empresaId, alertaCreada);

        if (this.cacheManager) {
          await this.cacheManager.del(`alertas:contador:${params.empresaId}`);
        }

        const count = await this.contarAlertasNoLeidas(params.empresaId);
        this.alertsGateway.emitirContador(params.empresaId, count);
      }
    } catch (e) {
      console.error('Error creando alerta:', e);
    }
  }

  private readonly TRANSICIONES: Record<string, string[]> = {
    SOLICITADO: ['EN_REVISION', 'RECHAZADO'],
    EN_REVISION: ['APROBADO', 'RECHAZADO'],
    APROBADO: ['RECHAZADO'],
    RECHAZADO: [],
    ACTIVO: ['CANCELADO'],
    ATRASADO: ['CANCELADO'],
    PAGADO: [],
    CANCELADO: [],
  };

  async create(dto: CreatePrestamoDto, empresaId: string, usuarioId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, empresaId, activo: true },
    });
    if (!cliente)
      throw new NotFoundException('Cliente no encontrado o inactivo');

    // ── Validación de garante ─────────────────────────────────────────────────
    if (dto.garanteId) {
      if (dto.garanteId === dto.clienteId) {
        throw new BadRequestException('El cliente no puede ser su propio garante');
      }

      const garante = await this.prisma.cliente.findFirst({
        where: { id: dto.garanteId, empresaId, activo: true },
      });
      if (!garante) {
        throw new BadRequestException('El garante no es válido o no pertenece a tu empresa');
      }
    }

    // ── Validaciones financieras ───────────────────────────────────────────────
    
    // 1. Obtener configuración de la empresa
    const config = await ConfiguracionUtils.getConfig(this.prisma, empresaId);

    // 2. Validar monto mínimo
    ConfiguracionUtils.validarMontoMinimo(
      dto.monto,
      config.montoMinimoPrestamo,
      'préstamo',
    );

    // 3. Validar monto máximo si está configurado
    ConfiguracionUtils.validarMontoMaximo(
      dto.monto,
      config.montoMaximoPrestamo,
      'préstamo',
    );

    const fechaInicio = dto.fechaInicio
      ? new Date(dto.fechaInicio)
      : new Date();
    const tasaMensual = dto.tasaInteres / 100;
    const amortizacion = this.calcularAmortizacion(
      dto.monto,
      tasaMensual,
      dto.numeroCuotas,
      dto.frecuenciaPago,
      fechaInicio,
    );

    const fechaVencimiento = this.siguienteFecha(
      fechaInicio,
      dto.frecuenciaPago,
      dto.numeroCuotas,
    );

    const prestamo = await this.prisma.prestamo.create({
      data: {
        monto: dto.monto,
        tasaInteres: dto.tasaInteres,
        numeroCuotas: dto.numeroCuotas,
        frecuenciaPago: dto.frecuenciaPago,
        montoTotal: amortizacion.montoTotal,
        // NO escribimos saldoPendiente - se calcula desde cuotas
        cuotaMensual: amortizacion.cuotaInicial,
        fechaInicio,
        fechaVencimiento,
        estado: 'SOLICITADO' as EstadoPrestamo,
        solicitadoPor: usuarioId,
        empresaId,
        clienteId: dto.clienteId,
        garanteId: dto.garanteId || null,
      },
    });

    const clienteNombre = `${cliente.nombre} ${cliente.apellido}`.trim();

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'PRESTAMO',
      accion: 'CREATE',
      descripcion: `Creación de préstamo RD$${dto.monto.toLocaleString()} a ${clienteNombre}, ${dto.numeroCuotas} cuotas`,
      monto: dto.monto,
      referenciaId: prestamo.id,
      referenciaTipo: 'Prestamo',
      datosNuevos: { monto: dto.monto, numeroCuotas: dto.numeroCuotas, tasaInteres: dto.tasaInteres, frecuenciaPago: dto.frecuenciaPago },
    });

    // Invalidar cache después de crear préstamo
    await this.invalidarCache(empresaId);

    return this.findOne(prestamo.id, empresaId);
  }

  async cambiarEstado(
    id: string,
    empresaId: string,
    adminId: string,
    nuevoEstado: string,
    motivo?: string,
  ) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id, empresaId },
      include: { cliente: { select: { nombre: true, apellido: true } } },
    });
    if (!prestamo) throw new NotFoundException(`Préstamo ${id} no encontrado`);

    const estadoActual = prestamo.estado as string;
    const permitidos = this.TRANSICIONES[estadoActual] ?? [];

    if (!permitidos.includes(nuevoEstado)) {
      throw new BadRequestException(
        `No se puede cambiar de ${estadoActual} a ${nuevoEstado}. Transiciones permitidas: ${permitidos.join(', ') || 'ninguna'}`,
      );
    }

    const data: any = { estado: nuevoEstado as EstadoPrestamo };
    if (nuevoEstado === 'RECHAZADO')
      data.motivoRechazo = motivo ?? 'Sin motivo especificado';
    if (nuevoEstado === 'APROBADO') {
      data.aprobadoPor = adminId;
      data.fechaAprobacion = new Date();
    }

    const updated = await this.prisma.prestamo.update({ where: { id }, data });

    const clienteNombre =
      `${prestamo.cliente?.nombre ?? ''} ${prestamo.cliente?.apellido ?? ''}`.trim();
    await this.crearAlerta({
      empresaId,
      prestamoId: id,
      clienteNombre,
      tipo: 'CAMBIO_ESTADO',
      descripcion: `Préstamo de ${clienteNombre} cambió de ${estadoActual} a ${nuevoEstado}`,
      detalle: {
        estadoAnterior: estadoActual,
        estadoNuevo: nuevoEstado,
        motivo: motivo ?? null,
      },
      usuarioId: adminId,
    });

    // Invalidar cache después de cambiar estado
    await this.invalidarCache(empresaId);

    return updated;
  }

  async desembolsar(id: string, empresaId: string, adminId: string) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id, empresaId },
      include: {
        cuotas: true,
        cliente: { select: { nombre: true, apellido: true } },
      },
    });

    if (!prestamo) throw new NotFoundException(`Préstamo ${id} no encontrado`);

    if (prestamo.estado !== ('APROBADO' as any)) {
      throw new BadRequestException(
        `Solo se pueden desembolsar préstamos APROBADOS. Estado actual: ${prestamo.estado}`,
      );
    }

    if (prestamo.cuotas.length > 0) {
      throw new BadRequestException('Este préstamo ya tiene cuotas generadas');
    }

    const hoyStr = this.getFechaRD();

    const cajaAbierta = await this.prisma.cajaSesion.findFirst({
      where: {
        empresaId,
        usuarioId: adminId,
        fecha: hoyStr,
        estado: 'ABIERTA',
      },
    });

    if (!cajaAbierta) {
      throw new BadRequestException(
        'No tienes una caja abierta hoy. Debes abrir tu caja antes de desembolsar un préstamo.',
      );
    }

    const amortizacion = this.calcularAmortizacion(
      prestamo.monto,
      prestamo.tasaInteres / 100,
      prestamo.numeroCuotas,
      prestamo.frecuenciaPago,
      prestamo.fechaInicio,
    );

    const fechaVencimiento = this.siguienteFecha(
      prestamo.fechaInicio,
      prestamo.frecuenciaPago,
      prestamo.numeroCuotas,
    );

    const clienteNombre =
      `${prestamo.cliente?.nombre ?? ''} ${prestamo.cliente?.apellido ?? ''}`.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      // ─── 1. Obtener caja dentro del transaction ────────────────────────────
      const cajaBloqueada = await tx.cajaSesion.findUnique({
        where: { id: cajaAbierta.id },
      });

      if (!cajaBloqueada || cajaBloqueada.estado !== 'ABIERTA') {
        throw new BadRequestException('Tu caja ya no está disponible. Abre una caja nueva.');
      }

      // ─── 2. Revalidar estado del préstamo dentro del transaction ───────
      const prestamoActual = await TenantUtils.findByIdOrThrow(
        tx,
        'Prestamo',
        id,
        empresaId,
        'Préstamo',
      );

      if (prestamoActual.estado !== EstadoPrestamo.APROBADO) {
        throw new BadRequestException(
          `El préstamo ya no está en estado APROBADO. Estado actual: ${prestamoActual.estado}`,
        );
      }

      // ─── 3. Calcular efectivo disponible usando cajaId ────────────────
      const [pagosEfectivo, desembolsosCaja] = await Promise.all([
        tx.pago.aggregate({
          where: { cajaId: cajaBloqueada.id, metodo: MetodoPago.EFECTIVO },
          _sum: { montoTotal: true },
        }),
        tx.desembolsoCaja.aggregate({
          where: { cajaId: cajaBloqueada.id },
          _sum: { monto: true },
        }),
      ]);

      const efectivoEnCaja = Math.round(
        (
          cajaBloqueada.montoInicial +
          (pagosEfectivo._sum.montoTotal || 0) -
          (desembolsosCaja._sum.monto || 0)
        ) * 100
      ) / 100;

      // ─── 4. Validar que monto ≤ efectivo disponible ───────────────────
      if (prestamo.monto > efectivoEnCaja) {
        throw new BadRequestException(
          `Fondos insuficientes en caja para desembolso. Disponible: RD$${efectivoEnCaja.toLocaleString()}, Solicitado: RD$${prestamo.monto.toLocaleString()}`,
        );
      }

      // ─── 5. Crear cuotas del préstamo ────────────────────────────────────
      await tx.cuota.createMany({
        data: amortizacion.cuotas.map((c) => ({
          prestamoId: id,
          numero: c.numero,
          monto: c.monto,
          capital: c.capital,
          interes: c.interes,
          mora: 0,
          fechaVencimiento: c.fechaVencimiento,
          pagada: false,
        })),
      });

      // ─── 6. Actualizar estado del préstamo ──────────────────────────────
      // NO escribimos saldoPendiente - se calcula desde cuotas
      await tx.prestamo.update({
        where: { id },
        data: {
          estado: EstadoPrestamo.ACTIVO,
          montoTotal: amortizacion.montoTotal,
          cuotaMensual: amortizacion.cuotaInicial,
          fechaVencimiento,
          aprobadoPor: adminId,
          fechaDesembolso: new Date(),
        },
      });

      // ─── 7. Registrar desembolso en caja ────────────────────────────────
      const desembolso = await (tx as any).desembolsoCaja.create({
        data: {
          monto: prestamo.monto,
          concepto: `Desembolso préstamo — ${clienteNombre}`,
          cajaId: cajaBloqueada.id,
          prestamoId: id,
          empresaId,
          usuarioId: adminId,
        },
      });

      // ─── 7b. Actualizar totales de caja ────────────────────────────────
      await tx.cajaSesion.update({
        where: { id: cajaBloqueada.id },
        data: { totalEgresos: { increment: prestamo.monto } },
      });

      // ─── 8. Registrar movimiento financiero ──────────────────────────────
      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'DESEMBOLSO',
          monto: prestamo.monto,
          capital: prestamo.monto,
          interes: 0,
          mora: 0,
          referenciaTipo: 'DESEMBOLSO',
          referenciaId: desembolso.id,
          cajaId: cajaBloqueada.id,
          empresaId,
          usuarioId: adminId,
          descripcion: `Desembolso préstamo — ${clienteNombre}`,
        },
      });

      return this.findOne(id, empresaId);
    });

    await this.crearAlerta({
      empresaId,
      prestamoId: id,
      clienteNombre,
      tipo: 'CAMBIO_ESTADO',
      descripcion: `Préstamo de ${clienteNombre} fue desembolsado y activado`,
      detalle: {
        estadoAnterior: 'APROBADO',
        estadoNuevo: 'ACTIVO',
        monto: prestamo.monto,
      },
      usuarioId: adminId,
    });

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId: adminId,
      tipo: 'PRESTAMO',
      accion: 'DESEMBOLSO',
      descripcion: `Desembolso RD$${prestamo.monto.toLocaleString()} a ${clienteNombre}`,
      monto: prestamo.monto,
      referenciaId: id,
      referenciaTipo: 'Prestamo',
      datosAnteriores: { estado: 'APROBADO' },
      datosNuevos: { estado: 'ACTIVO', monto: prestamo.monto },
    });

    // Invalidar cache después de desembolsar
    await this.invalidarCache(empresaId);

    return result;
  }

  async getSolicitudes(empresaId: string) {
    return this.prisma.prestamo.findMany({
      where: {
        empresaId,
        estado: {
          in: ['SOLICITADO', 'EN_REVISION', 'APROBADO'] as EstadoPrestamo[],
        },
      },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            cedula: true,
            telefono: true,
          },
        },
        _count: { select: { cuotas: true, pagos: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAll(
    empresaId: string,
    pagina = 1,
    porPagina = 20,
    search = '',
    estado = '',
  ): Promise<PaginatedResult<any>> {
    const skip = (pagina - 1) * porPagina;
    const where: any = { empresaId };

    if (estado && estado !== 'TODOS') {
      where.estado = estado as EstadoPrestamo;
    }

    if (search?.trim()) {
      const q = search.trim();
      const qSinGuiones = q.replace(/-/g, '');

      where.cliente = {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { apellido: { contains: q, mode: 'insensitive' } },
          { cedula: { contains: qSinGuiones, mode: 'insensitive' } },
        ],
      };
    }

    const include = {
      cliente: {
        select: { id: true, nombre: true, apellido: true, cedula: true },
      },
      garante: {
        select: { id: true, nombre: true, apellido: true, cedula: true },
      },
      cuotas: {
        where: { pagada: false },
        orderBy: { numero: 'asc' as const },
      },
      _count: { select: { cuotas: true, pagos: true } },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.prestamo.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: porPagina,
      }),
      this.prisma.prestamo.count({ where }),
    ]);

    // Calcular saldo y mora desde cuotas para cada préstamo
    const dataConCalculos = data.map(p => {
      const { saldoPendiente, moraAcumulada } = this.calcularDesdeObjeto(p);
      return { ...p, saldoPendiente, moraAcumulada };
    });

    return {
      data: dataConCalculos,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    };
  }

  async findByCliente(clienteId: string, empresaId: string) {
    const prestamos = await this.prisma.prestamo.findMany({
      where: { clienteId, empresaId },
      include: {
        cuotas: {
          where: { pagada: false },
          orderBy: { numero: 'asc' },
        },
        _count: { select: { cuotas: true, pagos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular saldo y mora desde cuotas para cada préstamo
    return prestamos.map(p => {
      const { saldoPendiente, moraAcumulada } = this.calcularDesdeObjeto(p);
      return { ...p, saldoPendiente, moraAcumulada };
    });
  }

  async findOne(id: string, empresaId: string) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id, empresaId },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            cedula: true,
            telefono: true,
            celular: true,
          },
        },
        garante: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            cedula: true,
            telefono: true,
            celular: true,
          },
        },
        cuotas: { orderBy: { numero: 'asc' } },
        pagos: {
          include: { usuario: { select: { id: true, nombre: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!prestamo) throw new NotFoundException(`Préstamo ${id} no encontrado`);

    // Calcular saldo y mora desde cuotas (fuente de verdad)
    const { saldoPendiente, moraAcumulada } = this.calcularDesdeObjeto(prestamo);

    // Retornar con valores calculados desde cuotas, no desde campos almacenados
    return {
      ...prestamo,
      saldoPendiente,
      moraAcumulada,
    };
  }

  async update(id: string, dto: UpdatePrestamoDto, empresaId: string) {
    await this.assertPrestamoExists(id, empresaId);
    return this.prisma.prestamo.update({ where: { id }, data: dto });
  }

  async cancelar(id: string, empresaId: string, usuarioId?: string) {
    const prestamo = await TenantUtils.findByIdOrThrow(
      this.prisma,
      'prestamo',
      id,
      empresaId,
      'Préstamo',
    );

    if (prestamo.estado === EstadoPrestamo.PAGADO)
      throw new BadRequestException(
        'No se puede cancelar un préstamo ya pagado',
      );
    if (prestamo.estado === EstadoPrestamo.CANCELADO)
      throw new BadRequestException('El préstamo ya está cancelado');

    const updated = await this.prisma.prestamo.update({
      where: { id },
      data: { estado: EstadoPrestamo.CANCELADO },
    });

    const clienteNombre =
      `${prestamo.cliente?.nombre ?? ''} ${prestamo.cliente?.apellido ?? ''}`.trim();
    await this.crearAlerta({
      empresaId,
      prestamoId: id,
      clienteNombre,
      tipo: 'CANCELACION',
      descripcion: `Préstamo de ${clienteNombre} fue cancelado`,
      detalle: { estadoAnterior: prestamo.estado, monto: prestamo.monto },
      usuarioId: usuarioId ?? 'sistema',
    });

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'PRESTAMO',
      accion: 'CANCELADO',
      descripcion: `Préstamo cancelado: RD$${prestamo.monto.toLocaleString()} - Cliente: ${clienteNombre}`,
      monto: prestamo.monto,
      referenciaId: id,
      referenciaTipo: 'Prestamo',
      datosAnteriores: { estado: prestamo.estado },
      datosNuevos: { estado: 'CANCELADO' },
    });

    // Invalidar cache después de cancelar
    await this.invalidarCache(empresaId);

    return updated;
  }

  calcularTabla(
    monto: number,
    tasaInteres: number,
    numeroCuotas: number,
    frecuenciaPago: FrecuenciaPago,
  ): ResumenAmortizacion {
    return this.calcularAmortizacion(
      monto,
      tasaInteres / 100,
      numeroCuotas,
      frecuenciaPago,
      new Date(),
    );
  }

  async actualizarMoras(empresaId: string) {
    const hoy = startOfDay(new Date());
    const cacheKey = `config:${empresaId}`;

    // 1. Obtener configuración (con cache)
    let config: any = null;
    try {
      if (this.cacheManager) {
        config = await this.cacheManager.get(cacheKey);
      }
    } catch (e) {
      console.warn('Cache config error:', e?.message);
    }
    
    if (!config) {
      config = await this.prisma.configuracion.findUnique({
        where: { empresaId },
      });
      if (config && this.cacheManager) {
        try {
          await this.cacheManager.set(cacheKey, config, 300_000);
        } catch (e) {
          console.warn('Cache set error:', e?.message);
        }
      }
    }

    const diasGracia = config?.diasGracia ?? 0;

    // 2. Obtener cuotas vencidas sin mora
    const cuotasVencidas = await this.prisma.cuota.findMany({
      where: {
        pagada: false,
        mora: 0,
        fechaVencimiento: { lt: hoy },
        prestamo: { empresaId, estado: EstadoPrestamo.ACTIVO },
      },
    });

    // 3. Dividir en batches de 100 y ejecutar con transacción por batch
    const BATCH_SIZE = 100;
    const batches: any[][] = [];
    for (let i = 0; i < cuotasVencidas.length; i += BATCH_SIZE) {
      batches.push(cuotasVencidas.slice(i, i + BATCH_SIZE));
    }

    let actualizadas = 0;
    for (const batch of batches) {
      // Cada batch en su propia transacción
      await this.prisma.$transaction(async (tx) => {
        const updates = batch.map((cuota) => {
          // Validación defensiva: si ya tiene mora, no recalcular
          if (cuota.mora > 0) return null;
          
          const diasAtraso = differenceInDays(
            hoy,
            startOfDay(new Date(cuota.fechaVencimiento)),
          );
          if (diasAtraso <= diasGracia) return null;
          
          // Usar configuración con valores por defecto
          const moraPorcentaje = config?.moraPorcentajeMensual ?? 0;
          const mora = Math.round(
            cuota.monto * (moraPorcentaje / 100) * 100
          ) / 100;
          
          if (mora <= 0) return null;
          
          return tx.cuota.update({
            where: { id: cuota.id },
            data: { mora },
          });
        }).filter(Boolean);

        if (updates.length > 0) {
          await Promise.all(updates);
          actualizadas += updates.length;
        }
      });
    }

    // 4. Obtener préstamos activos/atrasados para recalcular mora
    const prestamosAActualizar = await this.prisma.prestamo.findMany({
      where: {
        empresaId,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] },
      },
      include: {
        cuotas: { where: { pagada: false } },
      },
    });

    // 5. Actualizar mora de préstamos en batches de 100
    const prestamoBatches: any[][] = [];
    for (let i = 0; i < prestamosAActualizar.length; i += BATCH_SIZE) {
      prestamoBatches.push(prestamosAActualizar.slice(i, i + BATCH_SIZE));
    }

    for (const batch of prestamoBatches) {
      await this.prisma.$transaction(async (tx) => {
        const updates = batch.map((prestamo) => {
          const moraRecalculada = Math.round(
            prestamo.cuotas.reduce((sum, c) => sum + (c.mora || 0), 0) * 100
          ) / 100;
          
          return tx.prestamo.update({
            where: { id: prestamo.id },
            data: { moraAcumulada: moraRecalculada },
          });
        });
        
        await Promise.all(updates);
      });
    }

    // 6. Actualizar estados de préstamos (ACTIVO → ATRASADO)
    await this.prisma.prestamo.updateMany({
      where: {
        empresaId,
        estado: EstadoPrestamo.ACTIVO,
        cuotas: { some: { pagada: false, fechaVencimiento: { lt: hoy } } },
      },
      data: { estado: EstadoPrestamo.ATRASADO },
    });

    // 7. Actualizar estados de préstamos (ATRASADO → ACTIVO)
    await this.prisma.prestamo.updateMany({
      where: {
        empresaId,
        estado: EstadoPrestamo.ATRASADO,
        cuotas: {
          every: { OR: [{ pagada: true }, { fechaVencimiento: { gte: hoy } }] },
        },
      },
      data: { estado: EstadoPrestamo.ACTIVO },
    });

    // 8. Invalidar cache de resumen
    await this.invalidarCache(empresaId);

    return { cuotasActualizadas: actualizadas };
  }

  // ─── CACHE: Invalidación centralizada ───────────────────────────────────────
  private async invalidarCache(empresaId: string) {
    const keys = [
      `resumen:${empresaId}`,
      `dashboard:${empresaId}`,
    ];

    if (this.cacheManager) {
      await Promise.all(
        keys.map(k => 
          this.cacheManager!.del(k).catch(() => {})
        )
      );
    }
  }

  // ─── CACHE: Obtener resumen con fallback ──────────────────────────────────
  async getResumen(empresaId: string) {
    const cacheKey = `resumen:${empresaId}`;

    // Intentar cache primero
    try {
      if (this.cacheManager) {
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;
      }
    } catch (e) {
      console.warn('Cache read error:', e?.message);
    }

    // Fallback: calcular desde DB
    const result = await this.calcularResumenDB(empresaId);

    // Guardar en cache (si funciona)
    try {
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, result, 30_000);
      }
    } catch (e) {
      console.warn('Cache set error:', e?.message);
    }

    return result;
  }

  // ─── CACHE: Método interno para calcular resumen desde DB ────────────────
  private async calcularResumenDB(empresaId: string) {
    const [activos, atrasados, pagados, cancelados, solicitados] =
      await Promise.all([
        this.prisma.prestamo.count({
          where: { empresaId, estado: EstadoPrestamo.ACTIVO },
        }),
        this.prisma.prestamo.count({
          where: { empresaId, estado: EstadoPrestamo.ATRASADO },
        }),
        this.prisma.prestamo.count({
          where: { empresaId, estado: EstadoPrestamo.PAGADO },
        }),
        this.prisma.prestamo.count({
          where: { empresaId, estado: EstadoPrestamo.CANCELADO },
        }),
        this.prisma.prestamo.count({
          where: {
            empresaId,
            estado: {
              in: ['SOLICITADO', 'EN_REVISION', 'APROBADO'] as EstadoPrestamo[],
            },
          },
        }),
      ]);

    const saldoTotal = await this.prisma.prestamo.aggregate({
      where: {
        empresaId,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] },
      },
      _sum: { saldoPendiente: true },
    });

    // Calcular saldo REAL desde cuotas
    const prestamosActivos = await this.prisma.prestamo.findMany({
      where: {
        empresaId,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] },
      },
      include: {
        cuotas: { where: { pagada: false } },
      },
    });

    const saldoRealTotal = prestamosActivos.reduce((sum, p) => {
      const { saldoPendiente } = this.calcularDesdeObjeto(p);
      return sum + saldoPendiente;
    }, 0);

    const montoTotalPrestado = await this.prisma.prestamo.aggregate({
      where: {
        empresaId,
        estado: { in: [EstadoPrestamo.ACTIVO, EstadoPrestamo.ATRASADO] },
      },
      _sum: { monto: true },
    });

    const hoy = startOfDay(new Date());
    const cuotasVencidasHoy = await this.prisma.cuota.count({
      where: {
        pagada: false,
        fechaVencimiento: { lt: hoy },
        prestamo: { empresaId },
      },
    });

    return {
      cantidades: { activos, atrasados, pagados, cancelados, solicitados },
      saldoPendienteTotal: saldoRealTotal,
      montoTotalPrestado: montoTotalPrestado._sum.monto ?? 0,
      cuotasVencidasHoy,
    };
  }

  async refinanciar(
    id: string,
    dto: RefinanciarPrestamoDto,
    empresaId: string,
    usuarioId: string,
  ) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id, empresaId },
      include: {
        cuotas: { orderBy: { numero: 'asc' } },
        cliente: { select: { nombre: true, apellido: true } },
      },
    });

    if (!prestamo) throw new NotFoundException(`Préstamo ${id} no encontrado`);

    if (!['ACTIVO', 'ATRASADO'].includes(prestamo.estado)) {
      throw new BadRequestException(
        `Solo se pueden refinanciar préstamos ACTIVOS o ATRASADOS. Estado actual: ${prestamo.estado}`,
      );
    }

    const cuotasPendientes = prestamo.cuotas.filter((c) => !c.pagada);
    if (cuotasPendientes.length === 0)
      throw new BadRequestException(
        'Este préstamo no tiene cuotas pendientes para refinanciar',
      );

    const capitalPendiente = cuotasPendientes.reduce(
      (sum, c) => sum + c.capital,
      0,
    );
    const morasPendientes = cuotasPendientes.reduce(
      (sum, c) => sum + (c.mora || 0),
      0,
    );
    const saldoRefinanciar =
      Math.round((capitalPendiente + morasPendientes) * 100) / 100;

    const frecuenciaFinal: FrecuenciaPago =
      dto.nuevaFrecuencia ?? prestamo.frecuenciaPago;

    let fechaBase: Date;
    if (dto.nuevaFechaPago) {
      fechaBase = addDays(
        startOfDay(new Date(dto.nuevaFechaPago)),
        -DIAS_FRECUENCIA[frecuenciaFinal],
      );
    } else {
      fechaBase = new Date();
    }

    const nuevaAmortizacion = this.calcularAmortizacion(
      saldoRefinanciar,
      dto.nuevaTasa / 100,
      dto.nuevasCuotas,
      frecuenciaFinal,
      fechaBase,
    );

    const nuevaFechaVencimiento = this.siguienteFecha(
      fechaBase,
      frecuenciaFinal,
      dto.nuevasCuotas,
    );
    const historialActual = (prestamo.historialRefinanciamiento as any[]) ?? [];

    const cambios: TipoAlerta[] = ['REFINANCIAMIENTO'];
    if (dto.nuevaFrecuencia && dto.nuevaFrecuencia !== prestamo.frecuenciaPago)
      cambios.push('CAMBIO_FRECUENCIA');
    if (dto.nuevaTasa !== prestamo.tasaInteres) cambios.push('CAMBIO_TASA');
    if (dto.nuevasCuotas !== cuotasPendientes.length)
      cambios.push('CAMBIO_CUOTAS');
    if (dto.nuevaFechaPago) cambios.push('CAMBIO_FECHA_PAGO');

    const nuevoRegistro = {
      fecha: new Date().toISOString(),
      usuarioId,
      motivo: dto.motivo ?? null,
      cuotasOriginales: prestamo.numeroCuotas,
      cuotasPagadasAntes: prestamo.cuotas.filter((c) => c.pagada).length,
      cuotasPendientesAntes: cuotasPendientes.length,
      saldoAntes: prestamo.saldoPendiente,
      tasaAntes: prestamo.tasaInteres,
      frecuenciaAntes: prestamo.frecuenciaPago,
      nuevasCuotas: dto.nuevasCuotas,
      nuevaTasa: dto.nuevaTasa,
      nuevaFrecuencia: frecuenciaFinal,
      nuevaFechaPago: dto.nuevaFechaPago ?? null,
      saldoRefinanciado: saldoRefinanciar,
      nuevaCuotaMensual: nuevaAmortizacion.cuotaInicial,
      nuevoMontoTotal: nuevaAmortizacion.montoTotal,
    };

    const prestamoActualizado = await this.prisma.$transaction(async (tx) => {
      await tx.cuota.deleteMany({ where: { prestamoId: id, pagada: false } });

      const ultimoNumeroPagado = prestamo.cuotas
        .filter((c) => c.pagada)
        .reduce((max, c) => Math.max(max, c.numero), 0);

      await tx.cuota.createMany({
        data: nuevaAmortizacion.cuotas.map((c) => ({
          prestamoId: id,
          numero: ultimoNumeroPagado + c.numero,
          monto: c.monto,
          capital: c.capital,
          interes: c.interes,
          mora: 0,
          fechaVencimiento: c.fechaVencimiento,
          pagada: false,
        })),
      });

      // NO escribimos saldoPendiente - se calcula desde cuotas
      return tx.prestamo.update({
        where: { id },
        data: {
          tasaInteres: dto.nuevaTasa,
          frecuenciaPago: frecuenciaFinal,
          numeroCuotas: ultimoNumeroPagado + dto.nuevasCuotas,
          cuotaMensual: nuevaAmortizacion.cuotaInicial,
          fechaVencimiento: nuevaFechaVencimiento,
          estado: EstadoPrestamo.ACTIVO,
          moraAcumulada: 0,
          refinanciado: true,
          vecesRefinanciado: (prestamo.vecesRefinanciado ?? 0) + 1,
          historialRefinanciamiento: [...historialActual, nuevoRegistro],
        },
      });
    });

    const clienteNombre =
      `${prestamo.cliente?.nombre ?? ''} ${prestamo.cliente?.apellido ?? ''}`.trim();
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP',
      }).format(n);
    const FREQ_LABEL: Record<string, string> = {
      DIARIO: 'Diario',
      SEMANAL: 'Semanal',
      QUINCENAL: 'Quincenal',
      MENSUAL: 'Mensual',
    };

    let usuarioNombre = 'Sistema';
    if (usuarioId && usuarioId !== 'sistema') {
      const usr = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true },
      });
      if (usr?.nombre) usuarioNombre = usr.nombre;
    }

    for (const tipo of cambios) {
      let descripcion = '';
      let detalle: Record<string, any> = { prestamoId: id, clienteNombre };
      switch (tipo) {
        case 'REFINANCIAMIENTO':
          descripcion = `Préstamo de ${clienteNombre} fue refinanciado. Saldo: ${fmt(saldoRefinanciar)} → ${dto.nuevasCuotas} cuotas de ${fmt(nuevaAmortizacion.cuotaInicial)}`;
          detalle = {
            ...detalle,
            saldoRefinanciado: saldoRefinanciar,
            nuevasCuotas: dto.nuevasCuotas,
            nuevaCuota: nuevaAmortizacion.cuotaInicial,
            motivo: dto.motivo ?? null,
          };
          break;
        case 'CAMBIO_FRECUENCIA':
          descripcion = `Frecuencia de pago cambiada: ${FREQ_LABEL[prestamo.frecuenciaPago]} → ${FREQ_LABEL[frecuenciaFinal]}`;
          detalle = {
            ...detalle,
            frecuenciaAnterior: prestamo.frecuenciaPago,
            frecuenciaNueva: frecuenciaFinal,
          };
          break;
        case 'CAMBIO_TASA':
          descripcion = `Tasa de interés modificada: ${prestamo.tasaInteres}% → ${dto.nuevaTasa}%`;
          detalle = {
            ...detalle,
            tasaAnterior: prestamo.tasaInteres,
            tasaNueva: dto.nuevaTasa,
          };
          break;
        case 'CAMBIO_CUOTAS':
          descripcion = `Número de cuotas modificado: ${cuotasPendientes.length} pendientes → ${dto.nuevasCuotas} nuevas`;
          detalle = {
            ...detalle,
            cuotasAntes: cuotasPendientes.length,
            cuotasNuevas: dto.nuevasCuotas,
          };
          break;
        case 'CAMBIO_FECHA_PAGO':
          descripcion = `Fecha de próxima cuota cambiada a ${dto.nuevaFechaPago}`;
          detalle = { ...detalle, nuevaFecha: dto.nuevaFechaPago };
          break;
      }
      await this.crearAlerta({
        empresaId,
        prestamoId: id,
        clienteNombre,
        tipo,
        descripcion,
        detalle,
        usuarioId,
        usuarioNombre,
      });
    }

    // Invalidar cache después de refinanciar
    await this.invalidarCache(empresaId);

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'PRESTAMO',
      accion: 'REFINANCIAR',
      descripcion: `Préstamo refinanciado. Cliente: ${clienteNombre}. Nuevo saldo: RD$${fmt(saldoRefinanciar)}. Nuevas cuotas: ${dto.nuevasCuotas}`,
      monto: saldoRefinanciar,
      referenciaId: id,
      referenciaTipo: 'Prestamo',
      datosAnteriores: {
        estado: prestamo.estado,
        tasaInteres: prestamo.tasaInteres,
        numeroCuotas: prestamo.cuotas.length,
        frecuenciaPago: prestamo.frecuenciaPago,
      },
      datosNuevos: {
        estado: prestamoActualizado.estado,
        tasaInteres: dto.nuevaTasa,
        nuevasCuotas: dto.nuevasCuotas,
        frecuenciaPago: frecuenciaFinal,
      },
    });

    return this.findOne(prestamoActualizado.id, empresaId);
  }

  // ─── ALERTAS ──────────────────────────────────────────────────────────────

  async getAlertas(empresaId: string, desde?: string, hasta?: string, soloNoLeidas = false) {
    const where: any = { empresaId, ...(soloNoLeidas && { leida: false }) };
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = getInicioDiaRD(desde);
      if (hasta) where.createdAt.lte = getFinDiaRD(hasta);

     // console.log('DEBUG ALERTAS RANGO:', { desde: getInicioDiaRD(desde).toISOString(), hasta: getFinDiaRD(hasta).toISOString() });
    }
    return (this.prisma as any).alerta.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async marcarAlertaLeida(alertaId: string, empresaId: string) {
    const result = await (this.prisma as any).alerta.update({
      where: { id: alertaId },
      data: { leida: true },
    });
    if (this.cacheManager)
      await this.cacheManager.del(`alertas:contador:${empresaId}`);
    return result;
  }

  async marcarTodasLeidas(empresaId: string) {
    const result = await (this.prisma as any).alerta.updateMany({
      where: { empresaId, leida: false },
      data: { leida: true },
    });
    if (this.cacheManager)
      await this.cacheManager.del(`alertas:contador:${empresaId}`);
    return result;
  }

  async contarAlertasNoLeidas(empresaId: string): Promise<number> {
    const cacheKey = `alertas:contador:${empresaId}`;

    if (this.cacheManager) {
      const cached = await this.cacheManager.get<number>(cacheKey);
      if (cached !== undefined && cached !== null) return cached;
    }

    const count = await (this.prisma as any).alerta.count({
      where: { empresaId, leida: false },
    });

    if (this.cacheManager) await this.cacheManager.set(cacheKey, count, 30_000);

    return count;
  }
}