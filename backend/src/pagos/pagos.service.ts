//pagos.service.ts
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
import { CreatePagoDto } from './dto/create-pago.dto';
import { EstadoPrestamo, MetodoPago } from '@prisma/client';
import { TenantUtils } from '../common/utils/tenant.utils';
import { ConfiguracionUtils } from '../common/utils/configuracion.utils';
import { registrarAuditoria } from '../common/utils/auditoria.utils';
import { getFechaRD, getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';

@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) @Optional() private cacheManager?: Cache,
  ) {}

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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertPrestamo(prestamoId: string, empresaId: string) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, empresaId },
      include: {
        cuotas: {
          where: { pagada: false },
          orderBy: { numero: 'asc' },
        },
      },
    });

    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    if (prestamo.estado === EstadoPrestamo.PAGADO)
      throw new BadRequestException('Este préstamo ya está completamente pagado');
    if (prestamo.estado === EstadoPrestamo.CANCELADO)
      throw new BadRequestException('No se puede pagar un préstamo cancelado');

    return prestamo;
  }

  // ─── FUNCIÓN ÚNICA PARA CALCULAR SALDO PENDIENTE ───────────────────────────
  // El saldo real se calcula DESDE las cuotas, no desde el campo almacenado
  private async calcularSaldoDesdeCuotas(tx: any, prestamoId: string): Promise<number> {
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

  // ─── Validar caja abierta ────────────────────────────────────────────────

  private async assertCajaAbierta(empresaId: string, usuarioId: string) {
    const fecha = getFechaRD();

    const caja = await this.prisma.cajaSesion.findFirst({
      where: { empresaId, usuarioId, fecha, estado: 'ABIERTA' },
    });

    if (!caja) {
      throw new BadRequestException(
        'Debes abrir tu caja antes de registrar pagos. Ve a la sección Caja para abrirla.',
      );
    }

    return caja;
  }

  // ─── REGISTRAR PAGO ───────────────────────────────────────────────────────

  async registrarPago(dto: CreatePagoDto, empresaId: string, usuarioId: string) {
    const caja = await this.assertCajaAbierta(empresaId, usuarioId);
    const prestamo = await this.assertPrestamo(dto.prestamoId, empresaId);
    const cuotasPendientes = prestamo.cuotas;

    if (cuotasPendientes.length === 0) {
      throw new BadRequestException('No hay cuotas pendientes en este préstamo');
    }

    // ── Validaciones financieras ───────────────────────────────────────────────
    
    // 1. Validar que el monto sea mayor a 0 (ya cubierto por DTO IsPositive)
    
    // 2. Validar estado del préstamo - solo permitir ACTIVO o ATRASADO
    if (prestamo.estado !== EstadoPrestamo.ACTIVO && prestamo.estado !== EstadoPrestamo.ATRASADO) {
      throw new BadRequestException(
        `No se puede pagar un préstamo en estado: ${prestamo.estado}. Solo se permiten préstamos ACTIVOS o ATRASADOS.`,
      );
    }

    // 3. Obtener configuración de la empresa
    const config = await ConfiguracionUtils.getConfig(this.prisma, empresaId);

    // 4. Validar contra monto máximo configurado (se hace dentro de tx para usar saldo real)
    // ── Determinar cuota objetivo ──────────────────────────────────────────
    let cuotaObjetivo = cuotasPendientes[0];

    if (dto.cuotaId) {
      const cuotaEspecifica = cuotasPendientes.find((c) => c.id === dto.cuotaId);
      if (!cuotaEspecifica) {
        throw new BadRequestException('La cuota especificada no existe o ya fue pagada');
      }
      cuotaObjetivo = cuotaEspecifica;
    }

    const montoExacto = cuotaObjetivo.monto + cuotaObjetivo.mora;

    // ── Calcular distribución del pago ─────────────────────────────────────
    let montoPagado    = dto.montoPagado;
    let moraAplicada   = 0;
    let interesAplicado = 0;
    let capitalAplicado = 0;
    let excedente       = 0;

    if (cuotaObjetivo.mora > 0) {
      moraAplicada = Math.min(montoPagado, cuotaObjetivo.mora);
      montoPagado -= moraAplicada;
    }
    if (montoPagado > 0) {
      interesAplicado = Math.min(montoPagado, cuotaObjetivo.interes);
      montoPagado -= interesAplicado;
    }
    if (montoPagado > 0) {
      capitalAplicado = Math.min(montoPagado, cuotaObjetivo.capital);
      montoPagado -= capitalAplicado;
    }

    excedente = Math.round(montoPagado * 100) / 100;
    const pagoCompleto = dto.montoPagado >= montoExacto;

    // ── Transacción ────────────────────────────────────────────────────────
    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Calcular saldo REAL desde cuotas (no usar saldoPendiente almacenado)
      const saldoReal = await this.calcularSaldoDesdeCuotas(tx, dto.prestamoId);

      // 2. Validar contra saldo real
      if (dto.montoPagado > saldoReal) {
        throw new BadRequestException(
          `El monto del pago ($${dto.montoPagado.toLocaleString()}) excede el saldo pendiente ($${saldoReal.toLocaleString()}).`,
        );
      }

      // 3. Validar contra monto máximo configurado
      ConfiguracionUtils.validarMontoMaximo(
        dto.montoPagado,
        config.montoMaximoPago,
        'pago',
      );

      const pago = await tx.pago.create({
        data: {
          prestamoId:  dto.prestamoId,
          usuarioId,
          montoTotal:  dto.montoPagado,
          capital:     capitalAplicado + excedente,
          interes:     interesAplicado,
          mora:        moraAplicada,
          metodo:      dto.metodo,
          referencia:  dto.referencia,
          observacion: dto.observacion,
          cajaId:      caja.id, // Asociar pago a la caja abierta
        },
      });

      if (pagoCompleto) {
        await tx.cuota.update({
          where: { id: cuotaObjetivo.id },
          data: { pagada: true, fechaPago: new Date(), mora: cuotaObjetivo.mora },
        });
      }

      if (excedente > 0) {
        const cuotasRestantes = cuotasPendientes.filter((c) => c.id !== cuotaObjetivo.id);
        let abonoRestante = excedente;

        for (const cuota of cuotasRestantes) {
          if (abonoRestante <= 0) break;
          const reduccion    = Math.min(abonoRestante, cuota.capital);
          const nuevoCapital = Math.round((cuota.capital - reduccion) * 100) / 100;
          const nuevoMonto   = Math.round((nuevoCapital + cuota.interes) * 100) / 100;

          if (nuevoCapital <= 0) {
            await tx.cuota.update({
              where: { id: cuota.id },
              data: { capital: 0, monto: cuota.interes, pagada: true, fechaPago: new Date() },
            });
          } else {
            await tx.cuota.update({
              where: { id: cuota.id },
              data: { capital: nuevoCapital, monto: nuevoMonto },
            });
          }
          abonoRestante = Math.round((abonoRestante - reduccion) * 100) / 100;
        }
      }

      // Recalcular saldo sumando las cuotas pendientes reales después de todos los updates
      // Esto evita la desincronización acumulativa de restar montoPagado del saldo anterior
      const cuotasRestantesActualizadas = await tx.cuota.findMany({
        where: { prestamoId: dto.prestamoId, pagada: false },
        select: { capital: true, interes: true, mora: true },
      });

      const nuevoSaldo = Math.max(
        0,
        Math.round(
          cuotasRestantesActualizadas.reduce(
            (s, c) => s + c.capital + c.interes + (c.mora || 0), 0
          ) * 100
        ) / 100,
      );
      
      // Calcular mora acumulada desde las cuotas restantes (no usar prestamo.moraAcumulada)
      const nuevaMoraAcumulada = Math.max(
        0,
        Math.round(
          cuotasRestantesActualizadas.reduce((s, c) => s + (c.mora || 0), 0) * 100
        ) / 100,
      );

      const cuotasAunPendientes = await tx.cuota.count({
        where: { prestamoId: dto.prestamoId, pagada: false },
      });

      let nuevoEstado = prestamo.estado;
      if (cuotasAunPendientes === 0 || nuevoSaldo <= 0) {
        nuevoEstado = EstadoPrestamo.PAGADO;
      } else {
        const hoy = new Date();
        const cuotasVencidas = await tx.cuota.count({
          where: { prestamoId: dto.prestamoId, pagada: false, fechaVencimiento: { lt: hoy } },
        });
        nuevoEstado = cuotasVencidas > 0 ? EstadoPrestamo.ATRASADO : EstadoPrestamo.ACTIVO;
      }

      // NO escribimos saldoPendiente - se calcula desde cuotas
      await tx.prestamo.update({
        where: { id: dto.prestamoId },
        data: { moraAcumulada: nuevaMoraAcumulada, estado: nuevoEstado },
      });

      const prestamoCompleto = await this.prisma.prestamo.findUnique({
        where: { id: dto.prestamoId },
        include: { cliente: { select: { nombre: true, apellido: true } } },
      });
      const clienteNombre = `${prestamoCompleto?.cliente?.nombre ?? ''} ${prestamoCompleto?.cliente?.apellido ?? ''}`.trim();

      await registrarAuditoria(this.prisma, {
        empresaId,
        usuarioId,
        tipo: 'PAGO',
        accion: 'PAGO',
        descripcion: `Pago RD$${dto.montoPagado.toLocaleString()} (Capital: RD$${capitalAplicado.toLocaleString()}, Interés: RD$${interesAplicado.toLocaleString()}, Mora: RD$${moraAplicada.toLocaleString()}) - Cliente: ${clienteNombre}`,
        monto: dto.montoPagado,
        referenciaId: dto.prestamoId,
        datosAnteriores: { saldoAntes: saldoReal },
        datosNuevos: { 
          capital: capitalAplicado, 
          interes: interesAplicado, 
          mora: moraAplicada, 
          saldoDespues: nuevoSaldo, 
          cuotaPagada: pagoCompleto,
          cuotaId: cuotaObjetivo.id 
        },
      });

      // IMPORTANTE: Usar tx para obtener datos ACTUALIZADOS dentro de la transacción
      const prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: dto.prestamoId },
        include: {
          cliente: { select: { nombre: true, apellido: true, cedula: true } },
          cuotas: { select: { capital: true, interes: true, mora: true, pagada: true } },
        },
      });

      if (!prestamoActualizado) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      // Calcular saldo DESPUÉS del pago
      const saldoPendiente = Math.max(0, Math.round(
        prestamoActualizado.cuotas
          .filter(c => !c.pagada)
          .reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0) * 100
      ) / 100);
      
      const usuario = await tx.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true },
      });

      const resultadoPago = {
        pago: {
          id: pago.id,
          createdAt: pago.createdAt,
          montoTotal: pago.montoTotal,
          capital: capitalAplicado,
          interes: interesAplicado,
          mora: moraAplicada,
          abonoCapital: excedente, // Excedente aplicado como abono a capital
          metodo: pago.metodo,
          referencia: pago.referencia,
          observacion: pago.observacion,
        },
        prestamo: {
          id: prestamoActualizado.id,
          monto: prestamoActualizado.monto,
          numeroCuotas: prestamoActualizado.numeroCuotas,
          frecuenciaPago: prestamoActualizado.frecuenciaPago,
          tasaInteres: prestamoActualizado.tasaInteres,
          saldoPendiente,
        },
        cliente: {
          nombre: prestamoActualizado.cliente.nombre,
          apellido: prestamoActualizado.cliente.apellido,
          cedula: prestamoActualizado.cliente.cedula,
        },
        cuota: {
          id: cuotaObjetivo.id,
          numero: cuotaObjetivo.numero,
          monto: cuotaObjetivo.monto,
          capital: cuotaObjetivo.capital,
          interes: cuotaObjetivo.interes,
          mora: cuotaObjetivo.mora,
          fechaVencimiento: cuotaObjetivo.fechaVencimiento,
        },
        usuario: {
          nombre: usuario?.nombre ?? 'Sistema',
        },
      };
      
      return resultadoPago;
    });

    // Invalidar cache después de transacción exitosa
    await this.invalidarCache(empresaId);

    return resultado;
  }

  // ─── SALDAR PRÉSTAMO COMPLETO ─────────────────────────────────────────────
  // Registra un único pago por el saldo total pendiente (capital + moras)
  // y marca todas las cuotas pendientes como pagadas de una sola vez.

  async saldarPrestamo(
    prestamoId: string,
    empresaId: string,
    usuarioId: string,
    metodo: string,
    referencia?: string,
    observacion?: string,
  ) {
    // Validar que el método sea un valor válido del enum MetodoPago
    const metodoPago = metodo as MetodoPago;
    const caja = await this.assertCajaAbierta(empresaId, usuarioId);
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, empresaId },
      include: {
        cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
      },
    });

    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    if (prestamo.estado === EstadoPrestamo.PAGADO)
      throw new BadRequestException('Este préstamo ya está completamente pagado');
    if (prestamo.estado === EstadoPrestamo.CANCELADO)
      throw new BadRequestException('No se puede saldar un préstamo cancelado');

    const cuotasPendientes = prestamo.cuotas;
    if (cuotasPendientes.length === 0)
      throw new BadRequestException('No hay cuotas pendientes en este préstamo');

    // Calcular totales exactos de lo que se debe
    const totalCapital = Math.round(cuotasPendientes.reduce((s, c) => s + c.capital, 0) * 100) / 100;
    const totalInteres = Math.round(cuotasPendientes.reduce((s, c) => s + c.interes, 0) * 100) / 100;
    const totalMora    = Math.round(cuotasPendientes.reduce((s, c) => s + (c.mora || 0), 0) * 100) / 100;
    const montoTotal   = Math.round((totalCapital + totalInteres + totalMora) * 100) / 100;

      const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Registrar el pago único de saldo total
      const pago = await tx.pago.create({
        data: {
          prestamoId:  prestamoId,
          usuarioId:   usuarioId,
          montoTotal,
          capital:     totalCapital,
          interes:     totalInteres,
          mora:        totalMora,
          metodo:      metodoPago,
          referencia:  referencia ?? null,
          observacion: observacion ?? 'Saldo total del préstamo',
          cajaId:     caja.id,
        },
      });

      // 2. Marcar TODAS las cuotas pendientes como pagadas
      await tx.cuota.updateMany({
        where: { prestamoId, pagada: false },
        data:  { pagada: true, fechaPago: new Date() },
      });

      // 3. Liquidar el préstamo
      // NO escribimos saldoPendiente - se calcula desde cuotas
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          moraAcumulada:  0,
          estado: EstadoPrestamo.PAGADO,
        },
      });

      return pago;
    });

    const prestamoCompleto = await this.prisma.prestamo.findUnique({
      where: { id: prestamoId },
      include: { 
        cliente: { select: { nombre: true, apellido: true, cedula: true } },
        cuotas: { select: { capital: true, interes: true, mora: true, pagada: true } },
      },
    });

    if (!prestamoCompleto) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    const clienteNombre = `${prestamoCompleto?.cliente?.nombre ?? ''} ${prestamoCompleto?.cliente?.apellido ?? ''}`.trim();

    await registrarAuditoria(this.prisma, {
      empresaId,
      usuarioId,
      tipo: 'PAGO',
      accion: 'SALDADO',
      descripcion: `Préstamo saldado RD$${montoTotal.toLocaleString()} (Capital: RD$${totalCapital.toLocaleString()}, Interés: RD$${totalInteres.toLocaleString()}, Mora: RD$${totalMora.toLocaleString()}) - Cliente: ${clienteNombre}`,
      monto: montoTotal,
      referenciaId: prestamoId,
      datosAnteriores: { cuotasPendientes: cuotasPendientes.length },
      datosNuevos: { estado: 'PAGADO', cuotasPagadas: cuotasPendientes.length },
    });

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true },
    });

    return {
      pago: {
        id: resultado.id,
        createdAt: resultado.createdAt,
        montoTotal: resultado.montoTotal,
        capital: resultado.capital,
        interes: resultado.interes,
        mora: resultado.mora,
        metodo: resultado.metodo,
        referencia: resultado.referencia,
        observacion: resultado.observacion,
      },
      prestamo: {
        id: prestamoCompleto.id,
        monto: prestamoCompleto.monto,
        numeroCuotas: prestamoCompleto.numeroCuotas,
        frecuenciaPago: prestamoCompleto.frecuenciaPago,
        tasaInteres: prestamoCompleto.tasaInteres,
        saldoPendiente: 0,
      },
      cliente: {
        nombre: prestamoCompleto.cliente.nombre,
        apellido: prestamoCompleto.cliente.apellido,
        cedula: prestamoCompleto.cliente.cedula,
      },
      cuota: null,
      usuario: {
        nombre: usuario?.nombre ?? 'Sistema',
      },
    };

    // Invalidar cache después de transacción exitosa
    await this.invalidarCache(empresaId);

    return resultado;
  }

  // ─── LISTAR PAGOS DE UN PRÉSTAMO ──────────────────────────────────────────

  async findByPrestamo(prestamoId: string, empresaId: string) {
    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, empresaId },
    });
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');

    return this.prisma.pago.findMany({
      where: { prestamoId },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── LISTAR TODOS LOS PAGOS DE LA EMPRESA ────────────────────────────────

  async findAll(empresaId: string) {
    return this.prisma.pago.findMany({
      where: { prestamo: { empresaId } },
      include: {
        usuario: { select: { id: true, nombre: true } },
        prestamo: {
          select: {
            id: true, monto: true, saldoPendiente: true,
            cliente: { select: { id: true, nombre: true, apellido: true, cedula: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── OBTENER UN PAGO (para reimprimir recibo) ─────────────────────────────

  async findOne(id: string, empresaId: string) {
    const pago = await this.prisma.pago.findFirst({
      where: { id, prestamo: { empresaId } },
      include: {
        usuario: { select: { id: true, nombre: true } },
        prestamo: {
          include: {
            cliente: { select: { nombre: true, apellido: true, cedula: true } },
            cuotas: { 
              orderBy: { numero: 'asc' } 
            },
          },
        },
      },
    });

    if (!pago) throw new NotFoundException('Pago no encontrado');

    // Calcular saldo desde cuotas NO pagadas
    const saldoPendiente = Math.max(0, Math.round(
      pago.prestamo.cuotas
        .filter(c => !c.pagada)
        .reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0) * 100
    ) / 100);

    // Encontrar la cuota pagada que corresponde a este pago (por fechaPago cercana a createdAt)
    const cuotaDelPago = pago.prestamo?.cuotas?.find((c) => {
      if (!c.fechaPago) return false;
      const diffMs = Math.abs(
        new Date(c.fechaPago).getTime() - new Date(pago.createdAt).getTime(),
      );
      return diffMs < 60_000;
    }) ?? null;

    return {
      pago: {
        id: pago.id,
        createdAt: pago.createdAt,
        montoTotal: pago.montoTotal,
        capital: pago.capital,
        interes: pago.interes,
        mora: pago.mora,
        metodo: pago.metodo,
        referencia: pago.referencia,
        observacion: pago.observacion,
      },
      prestamo: {
        id: pago.prestamo.id,
        monto: pago.prestamo.monto,
        numeroCuotas: pago.prestamo.numeroCuotas,
        frecuenciaPago: pago.prestamo.frecuenciaPago,
        tasaInteres: pago.prestamo.tasaInteres,
        saldoPendiente,
      },
      cliente: {
        nombre: pago.prestamo.cliente.nombre,
        apellido: pago.prestamo.cliente.apellido,
        cedula: pago.prestamo.cliente.cedula,
      },
      cuota: cuotaDelPago ? {
        id: cuotaDelPago.id,
        numero: cuotaDelPago.numero,
        monto: cuotaDelPago.monto,
        capital: cuotaDelPago.capital,
        interes: cuotaDelPago.interes,
        mora: cuotaDelPago.mora,
        fechaVencimiento: cuotaDelPago.fechaVencimiento,
      } : null,
      usuario: {
        nombre: pago.usuario?.nombre ?? 'Sistema',
      },
    };
  }

  // ─── RESUMEN DE PAGOS ─────────────────────────────────────────────────────

  async getResumen(empresaId: string) {
    const inicioHoy = getInicioDiaRD();
    const finHoy = getFinDiaRD();
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const finMes = getFinDiaRD();

    console.log('DEBUG RANGO HOY:', { inicio: inicioHoy.toISOString(), fin: finHoy.toISOString() });

    const [totalHoy, totalMes, conteoHoy, conteoMes] = await Promise.all([
      this.prisma.pago.aggregate({
        where: { prestamo: { empresaId }, createdAt: { gte: inicioHoy, lte: finHoy } },
        _sum: { montoTotal: true },
      }),
      this.prisma.pago.aggregate({
        where: { prestamo: { empresaId }, createdAt: { gte: inicioMes } },
        _sum: { montoTotal: true },
      }),
      this.prisma.pago.count({ where: { prestamo: { empresaId }, createdAt: { gte: inicioHoy, lte: finHoy } } }),
      this.prisma.pago.count({ where: { prestamo: { empresaId }, createdAt: { gte: inicioMes } } }),
    ]);

    return {
      cobradoHoy: totalHoy._sum.montoTotal ?? 0,
      cobradoMes: totalMes._sum.montoTotal ?? 0,
      pagosHoy:   conteoHoy,
      pagosMes:   conteoMes,
    };
  }
}