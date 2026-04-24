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

    // ── Validaciones de estado ─────────────────────────────────────────────
    if (prestamo.estado !== EstadoPrestamo.ACTIVO && prestamo.estado !== EstadoPrestamo.ATRASADO) {
      throw new BadRequestException(
        `No se puede pagar un préstamo en estado: ${prestamo.estado}. Solo se permiten préstamos ACTIVOS o ATRASADOS.`,
      );
    }

    // ── Obtener configuración ──────────────────────────────────────────────
    const config = await ConfiguracionUtils.getConfig(this.prisma, empresaId);

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
    let montoPagado     = dto.montoPagado;
    let moraAplicada    = 0;
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

    // ── Transacción — SOLO operaciones de escritura y lectura crítica ──────
    // FUERA: usuario.findUnique, registrarAuditoria (no son críticos para atomicidad)
    const resultadoTx = await this.prisma.$transaction(async (tx) => {

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

      // 4. Crear el pago
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
          cajaId:      caja.id,
        },
      });

      // 5. Marcar cuota como pagada si el pago es completo
      if (pagoCompleto) {
        await tx.cuota.update({
          where: { id: cuotaObjetivo.id },
          data: { pagada: true, fechaPago: new Date(), mora: cuotaObjetivo.mora },
        });
      }

      // 6. Aplicar excedente a cuotas siguientes
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

      // 7. Recalcular saldo real desde cuotas actualizadas
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

      const nuevaMoraAcumulada = Math.max(
        0,
        Math.round(
          cuotasRestantesActualizadas.reduce((s, c) => s + (c.mora || 0), 0) * 100
        ) / 100,
      );

      // 8. Determinar nuevo estado del préstamo
      const cuotasAunPendientes = cuotasRestantesActualizadas.length;

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

// 9. Actualizar préstamo (NO escribimos saldoPendiente — se calcula desde cuotas)
      await tx.prestamo.update({
        where: { id: dto.prestamoId },
        data: { moraAcumulada: nuevaMoraAcumulada, estado: nuevoEstado },
      });

      // 10. Leer datos del cliente y préstamo actualizado (dentro del TX para consistencia)
      const prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: dto.prestamoId },
        include: {
          cliente: { select: { nombre: true, apellido: true, cedula: true } },
        },
      });

      if (!prestamoActualizado) throw new NotFoundException('Préstamo no encontrado');

      // 11. Crear MovimientoFinanciero (registro contable del pago)
      const clienteNombreTx = `${prestamoActualizado.cliente.nombre} ${prestamoActualizado.cliente.apellido}`.trim();
      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'PAGO_RECIBIDO',
          monto: dto.montoPagado,
          capital: capitalAplicado + excedente,
          interes: interesAplicado,
          mora: moraAplicada,
          referenciaTipo: 'PAGO',
          referenciaId: pago.id,
          cajaId: caja.id,
          empresaId,
          usuarioId,
          descripcion: `Pago de ${clienteNombreTx} - Capital: RD$${capitalAplicado.toLocaleString()}, Interés: RD$${interesAplicado.toLocaleString()}, Mora: RD$${moraAplicada.toLocaleString()}`,
        },
      });

      return {
        pagoId:          pago.id,
        pagoCreatedAt:   pago.createdAt,
        pagoMetodo:      pago.metodo,
        pagoReferencia:  pago.referencia,
        pagoObservacion: pago.observacion,
        saldoReal,
        saldoPendiente:  nuevoSaldo,
        cliente: {
          nombre:   prestamoActualizado.cliente.nombre,
          apellido: prestamoActualizado.cliente.apellido,
          cedula:   prestamoActualizado.cliente.cedula,
        },
        prestamo: {
          id:             prestamoActualizado.id,
          monto:          prestamoActualizado.monto,
          numeroCuotas:   prestamoActualizado.numeroCuotas,
          frecuenciaPago: prestamoActualizado.frecuenciaPago,
          tasaInteres:    prestamoActualizado.tasaInteres,
        },
      };
    }); // ── FIN $transaction ──────────────────────────────────────────────

    // ✅ FUERA de la transacción — ya no bloquean el TX ni provocan timeout
    const clienteNombre = `${resultadoTx.cliente.nombre} ${resultadoTx.cliente.apellido}`.trim();

    const [usuario] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true },
      }),
      // Auditoría también fuera del TX
      registrarAuditoria(this.prisma, {
        empresaId,
        usuarioId,
        tipo: 'PAGO',
        accion: 'PAGO',
        descripcion: `Pago RD$${dto.montoPagado.toLocaleString()} (Capital: RD$${capitalAplicado.toLocaleString()}, Interés: RD$${interesAplicado.toLocaleString()}, Mora: RD$${moraAplicada.toLocaleString()}) - Cliente: ${clienteNombre}`,
        monto: dto.montoPagado,
        referenciaId: dto.prestamoId,
        datosAnteriores: { saldoAntes: resultadoTx.saldoReal },
        datosNuevos: {
          capital:       capitalAplicado,
          interes:       interesAplicado,
          mora:          moraAplicada,
          saldoDespues:  resultadoTx.saldoPendiente,
          cuotaPagada:   pagoCompleto,
          cuotaId:       cuotaObjetivo.id,
        },
      }).catch(() => {}), // Auditoría nunca debe bloquear el retorno del pago
    ]);

    // ✅ Invalidar cache fuera del TX
    await this.invalidarCache(empresaId);

    return {
      pago: {
        id:           resultadoTx.pagoId,
        createdAt:    resultadoTx.pagoCreatedAt,
        montoTotal:   dto.montoPagado,
        capital:      capitalAplicado,
        interes:      interesAplicado,
        mora:         moraAplicada,
        abonoCapital: excedente,
        metodo:       resultadoTx.pagoMetodo,
        referencia:   resultadoTx.pagoReferencia,
        observacion:  resultadoTx.pagoObservacion,
      },
      prestamo: {
        ...resultadoTx.prestamo,
        saldoPendiente: resultadoTx.saldoPendiente,
      },
      cliente:  resultadoTx.cliente,
      cuota: {
        id:               cuotaObjetivo.id,
        numero:           cuotaObjetivo.numero,
        monto:            cuotaObjetivo.monto,
        capital:          cuotaObjetivo.capital,
        interes:          cuotaObjetivo.interes,
        mora:             cuotaObjetivo.mora,
        fechaVencimiento: cuotaObjetivo.fechaVencimiento,
      },
      usuario: { nombre: usuario?.nombre ?? 'Sistema' },
    };
  }

  // ─── SALDAR PRÉSTAMO COMPLETO ─────────────────────────────────────────────

  async saldarPrestamo(
    prestamoId: string,
    empresaId: string,
    usuarioId: string,
    metodo: string,
    referencia?: string,
    observacion?: string,
  ) {
    const metodoPago = metodo as MetodoPago;
    const caja = await this.assertCajaAbierta(empresaId, usuarioId);

    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, empresaId },
      include: {
        cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
        cliente: { select: { nombre: true, apellido: true, cedula: true } },
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

    // Calcular totales exactos
    const totalCapital = Math.round(cuotasPendientes.reduce((s, c) => s + c.capital, 0) * 100) / 100;
    const totalInteres = Math.round(cuotasPendientes.reduce((s, c) => s + c.interes, 0) * 100) / 100;
    const totalMora    = Math.round(cuotasPendientes.reduce((s, c) => s + (c.mora || 0), 0) * 100) / 100;
    const montoTotal   = Math.round((totalCapital + totalInteres + totalMora) * 100) / 100;

    // ── Transacción — SOLO escrituras críticas ─────────────────────────────
    const pagoCreado = await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          prestamoId,
          usuarioId,
          montoTotal,
          capital:     totalCapital,
          interes:     totalInteres,
          mora:        totalMora,
          metodo:      metodoPago,
          referencia:  referencia ?? null,
          observacion: observacion ?? 'Saldo total del préstamo',
          cajaId:      caja.id,
        },
      });

      await tx.cuota.updateMany({
        where: { prestamoId, pagada: false },
        data:  { pagada: true, fechaPago: new Date() },
      });

      // NO escribimos saldoPendiente — se calcula desde cuotas
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: {
          moraAcumulada: 0,
          estado: EstadoPrestamo.PAGADO,
        },
      });

      return pago;
    }); // ── FIN $transaction ──────────────────────────────────────────────

    // ✅ FUERA del TX — ya no provoca timeout
    const clienteNombre = `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}`.trim();

    const [usuario] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true },
      }),
      registrarAuditoria(this.prisma, {
        empresaId,
        usuarioId,
        tipo: 'PAGO',
        accion: 'SALDADO',
        descripcion: `Préstamo saldado RD$${montoTotal.toLocaleString()} (Capital: RD$${totalCapital.toLocaleString()}, Interés: RD$${totalInteres.toLocaleString()}, Mora: RD$${totalMora.toLocaleString()}) - Cliente: ${clienteNombre}`,
        monto: montoTotal,
        referenciaId: prestamoId,
        datosAnteriores: { cuotasPendientes: cuotasPendientes.length },
        datosNuevos: { estado: 'PAGADO', cuotasPagadas: cuotasPendientes.length },
      }).catch(() => {}),
    ]);

    // ✅ Invalidar cache SIEMPRE (antes estaba después de un return — nunca se ejecutaba)
    await this.invalidarCache(empresaId);

    return {
      pago: {
        id:          pagoCreado.id,
        createdAt:   pagoCreado.createdAt,
        montoTotal:  pagoCreado.montoTotal,
        capital:     pagoCreado.capital,
        interes:     pagoCreado.interes,
        mora:        pagoCreado.mora,
        metodo:      pagoCreado.metodo,
        referencia:  pagoCreado.referencia,
        observacion: pagoCreado.observacion,
      },
      prestamo: {
        id:             prestamo.id,
        monto:          prestamo.monto,
        numeroCuotas:   prestamo.numeroCuotas,
        frecuenciaPago: prestamo.frecuenciaPago,
        tasaInteres:    prestamo.tasaInteres,
        saldoPendiente: 0,
      },
      cliente: {
        nombre:   prestamo.cliente.nombre,
        apellido: prestamo.cliente.apellido,
        cedula:   prestamo.cliente.cedula,
      },
      cuota: null,
      usuario: { nombre: usuario?.nombre ?? 'Sistema' },
    };
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
            cuotas: { orderBy: { numero: 'asc' } },
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

    // Encontrar cuota correspondiente al pago (por fechaPago cercana a createdAt)
    const cuotaDelPago = pago.prestamo?.cuotas?.find((c) => {
      if (!c.fechaPago) return false;
      const diffMs = Math.abs(
        new Date(c.fechaPago).getTime() - new Date(pago.createdAt).getTime(),
      );
      return diffMs < 60_000;
    }) ?? null;

    return {
      pago: {
        id:          pago.id,
        createdAt:   pago.createdAt,
        montoTotal:  pago.montoTotal,
        capital:     pago.capital,
        interes:     pago.interes,
        mora:        pago.mora,
        metodo:      pago.metodo,
        referencia:  pago.referencia,
        observacion: pago.observacion,
      },
      prestamo: {
        id:             pago.prestamo.id,
        monto:          pago.prestamo.monto,
        numeroCuotas:   pago.prestamo.numeroCuotas,
        frecuenciaPago: pago.prestamo.frecuenciaPago,
        tasaInteres:    pago.prestamo.tasaInteres,
        saldoPendiente,
      },
      cliente: {
        nombre:   pago.prestamo.cliente.nombre,
        apellido: pago.prestamo.cliente.apellido,
        cedula:   pago.prestamo.cliente.cedula,
      },
      cuota: cuotaDelPago ? {
        id:               cuotaDelPago.id,
        numero:           cuotaDelPago.numero,
        monto:            cuotaDelPago.monto,
        capital:          cuotaDelPago.capital,
        interes:          cuotaDelPago.interes,
        mora:             cuotaDelPago.mora,
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
    const finHoy    = getFinDiaRD();
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

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