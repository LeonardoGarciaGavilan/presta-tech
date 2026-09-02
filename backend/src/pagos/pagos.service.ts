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
import { roundMoney } from '../common/utils/money';
import { startOfDay, differenceInDays } from 'date-fns';
import {
  getFechaRD,
  getInicioDiaRD,
  getFinDiaRD,
} from '../common/utils/fecha.utils';

// Forma de respuesta unificada de registrarPago/saldarPrestamo. El replay
// idempotente (respuestaPagoExistente) devuelve exactamente esta forma, por lo
// que el helper ejecutarTxConIdempotencia puede tipar su resultado sin `any`.
export interface RespuestaPago {
  pago: {
    id: string;
    createdAt: Date;
    montoTotal: number;
    capital: number;
    interes: number;
    mora: number;
    metodo: MetodoPago;
    referencia: string | null;
    observacion: string | null;
    abonoCapital?: number;
    pagoCompleto?: boolean;
  };
  prestamo: {
    id: string;
    monto: number;
    numeroCuotas: number;
    frecuenciaPago: string;
    tasaInteres: number;
    saldoPendiente: number;
  };
  cliente: { nombre: string; apellido: string | null; cedula: string };
  cuota: {
    id: string;
    numero: number;
    monto: number;
    capital: number;
    interes: number;
    mora: number;
    fechaVencimiento: Date;
    pagoCompleto: boolean;
  } | null;
  usuario?: { nombre: string };
}

@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) @Optional() private cacheManager?: Cache,
  ) {}

  // ─── CACHE: Invalidación centralizada ───────────────────────────────────────
  private async invalidarCache(empresaId: string) {
    const keys = [`resumen:${empresaId}`, `dashboard:${empresaId}`];

    if (this.cacheManager) {
      await Promise.all(
        keys.map((k) => this.cacheManager!.del(k).catch(() => {})),
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
      throw new BadRequestException(
        'Este préstamo ya está completamente pagado',
      );
    if (prestamo.estado === EstadoPrestamo.CANCELADO)
      throw new BadRequestException('No se puede pagar un préstamo cancelado');

    return prestamo;
  }

  // ─── Validar caja abierta ────────────────────────────────────────────────

  private async assertCajaAbierta(
    empresaId: string,
    usuarioId: string,
    fecha?: string,
  ) {
    const fechaCaja = fecha ?? getFechaRD();

    const caja = await this.prisma.cajaSesion.findFirst({
      where: { empresaId, usuarioId, fecha: fechaCaja, estado: 'ABIERTA' },
    });

    if (!caja) {
      throw new BadRequestException(
        'Debes abrir tu caja antes de registrar pagos. Ve a la sección Caja para abrirla.',
      );
    }

    return caja;
  }

  // ─── REGISTRAR PAGO ───────────────────────────────────────────────────────

  // Reconstruye la respuesta de un pago ya registrado (replay idempotente),
  // con la misma forma que devuelve registrarPago.
  private async respuestaPagoExistente(pagoId: string): Promise<RespuestaPago> {
    const full = await this.prisma.pago.findFirst({
      where: { id: pagoId },
      include: {
        prestamo: {
          include: {
            cliente: { select: { nombre: true, apellido: true, cedula: true } },
            cuotas: { orderBy: { numero: 'asc' } },
          },
        },
        usuario: { select: { nombre: true } },
      },
    });

    if (!full) throw new NotFoundException('Pago no encontrado');

    const saldoPendiente = Math.max(
      0,
      roundMoney(
        full.prestamo.cuotas
          .filter((c) => !c.pagada)
          .reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0),
      ),
    );

    // C7d: distinguir un replay de SALDO de un replay de pago normal. En el
    // saldo TODAS las cuotas pendientes se marcan pagadas en el mismo instante
    // (updateMany con el mismo `new Date()`); en un pago normal solo una cuota
    // queda con fechaPago cercana al pago. Además, el saldo usa la observación
    // por defecto 'Saldo total del préstamo'. Si es un saldo → `cuota: null`.
    const cuotasDelPago = full.prestamo.cuotas.filter((c) => {
      if (!c.fechaPago) return false;
      const diffMs = Math.abs(
        new Date(c.fechaPago).getTime() - new Date(full.createdAt).getTime(),
      );
      return diffMs < 60_000;
    });
    const esSaldo =
      full.observacion === 'Saldo total del préstamo' ||
      cuotasDelPago.length > 1;
    const cuotaDelPago = esSaldo ? null : (cuotasDelPago[0] ?? null);

    const pagoCompleto = esSaldo
      ? full.prestamo.cuotas.every((c) => c.pagada)
      : !!(cuotaDelPago?.pagada && cuotaDelPago?.fechaPago);

    return {
      pago: {
        id: full.id,
        createdAt: full.createdAt,
        montoTotal: full.montoTotal,
        capital: full.capital,
        interes: full.interes,
        mora: full.mora,
        abonoCapital: Math.max(
          0,
          roundMoney(full.montoTotal - full.capital - full.interes - full.mora),
        ),
        pagoCompleto,
        metodo: full.metodo,
        referencia: full.referencia,
        observacion: full.observacion,
      },
      prestamo: {
        id: full.prestamo.id,
        monto: full.prestamo.monto,
        numeroCuotas: full.prestamo.numeroCuotas,
        frecuenciaPago: full.prestamo.frecuenciaPago,
        tasaInteres: full.prestamo.tasaInteres,
        saldoPendiente,
      },
      cliente: {
        nombre: full.prestamo.cliente.nombre,
        apellido: full.prestamo.cliente.apellido,
        cedula: full.prestamo.cliente.cedula,
      },
      cuota: cuotaDelPago
        ? {
            id: cuotaDelPago.id,
            numero: cuotaDelPago.numero,
            monto: cuotaDelPago.monto,
            capital: cuotaDelPago.capital,
            interes: cuotaDelPago.interes,
            mora: cuotaDelPago.mora,
            fechaVencimiento: cuotaDelPago.fechaVencimiento,
            pagoCompleto,
          }
        : null,
      usuario: { nombre: full.usuario?.nombre ?? 'Sistema' },
    };
  }

  // Detecta el error P2002 de Prisma (violación de constraint único), que en
  // el contexto de pagos corresponde a una colisión de `idempotencyKey`.
  private esConflictoIdempotencia(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string })?.code === 'P2002'
    );
  }

  // Ejecuta una transacción de pago con replay idempotente. Cubre los dos
  // escenarios de doble envío concurrente con la misma idempotencyKey:
  //  1) P2002 (violación del unique de idempotencyKey) si dos inserts
  //     simultáneos pasan el replay check (TOCTOU sin lock de fila).
  //  2) 400 de "estado ya aplicado" (cuota ya pagada / sin cuotas pendientes)
  //     si el tx concurrente con la misma key ganó el lock FOR UPDATE primero:
  //     bajo el lock, el segundo tx relee el estado y lo encuentra aplicado.
  // En ambos casos se devuelve el pago ya registrado en lugar de propagar un
  // error. Si la key no existe tras el error, el error original se re-lanza.
  private async ejecutarTxConIdempotencia<T extends RespuestaPago>(
    fn: () => Promise<T>,
    prestamoId: string,
    idempotencyKey?: string,
  ): Promise<{ conflicto: boolean; resultado: T }> {
    try {
      return { conflicto: false, resultado: await fn() };
    } catch (error) {
      if (!idempotencyKey) throw error;

      const esReplay =
        this.esConflictoIdempotencia(error) ||
        error instanceof BadRequestException;

      if (esReplay) {
        const existente = await this.prisma.pago.findFirst({
          where: { prestamoId, idempotencyKey },
          select: { id: true },
        });
        if (existente) {
          return {
            conflicto: true,
            resultado: (await this.respuestaPagoExistente(existente.id)) as T,
          };
        }
      }
      throw error;
    }
  }

  async registrarPago(
    dto: CreatePagoDto,
    empresaId: string,
    usuarioId: string,
  ) {
    // ── Replay idempotente: si este intento ya se registró, devolver el pago
    // existente en lugar de crear un duplicado (protección del sync offline).
    // El lookup se scopea al tenant (prestamo: { empresaId }) para no chocar
    // con keys de otra empresa (el constraint único es global).
    if (dto.idempotencyKey) {
      const existente = await this.prisma.pago.findFirst({
        where: {
          prestamoId: dto.prestamoId,
          idempotencyKey: dto.idempotencyKey,
          prestamo: { empresaId },
        },
        select: { id: true },
      });
      if (existente) {
        return this.respuestaPagoExistente(existente.id);
      }
    }

    const caja = await this.assertCajaAbierta(empresaId, usuarioId, dto.fecha);
    const prestamo = await this.assertPrestamo(dto.prestamoId, empresaId);
    const cuotasPendientes = prestamo.cuotas;

    if (cuotasPendientes.length === 0) {
      throw new BadRequestException(
        'No hay cuotas pendientes en este préstamo',
      );
    }

    // ── Validaciones de estado ─────────────────────────────────────────────
    if (
      prestamo.estado !== EstadoPrestamo.ACTIVO &&
      prestamo.estado !== EstadoPrestamo.ATRASADO
    ) {
      throw new BadRequestException(
        `No se puede pagar un préstamo en estado: ${prestamo.estado}. Solo se permiten préstamos ACTIVOS o ATRASADOS.`,
      );
    }

    // ── Obtener configuración ──────────────────────────────────────────────
    const config = await ConfiguracionUtils.getConfig(this.prisma, empresaId);

    // ── Transacción ────────────────────────────────────────────────────────
    const txResultado = await this.ejecutarTxConIdempotencia(
      () =>
        this.prisma.$transaction(async (tx) => {
          // 0. Lock de fila del préstamo (C5): serializa pagos concurrentes
          await tx.$queryRaw`SELECT id FROM "Prestamo" WHERE id = ${dto.prestamoId} FOR UPDATE`;

          // 0.5 Revalidar caja bajo el lock (C7b): entre la validación pre-tx y
          // este momento la caja pudo cerrarse (cierre concurrente). El lock
          // del préstamo serializa, pero no protege el cierre de la caja.
          const cajaLocked = await tx.cajaSesion.findFirst({
            where: { id: caja.id, estado: 'ABIERTA' },
            select: { id: true },
          });
          if (!cajaLocked) {
            throw new BadRequestException(
              'Debes abrir tu caja antes de registrar pagos. Ve a la sección Caja para abrirla.',
            );
          }

          // Revalidar estado bajo el lock (la lectura pre-tx puede estar obsoleta)
          const prestamoLocked = await tx.prestamo.findUnique({
            where: { id: dto.prestamoId },
            select: { estado: true },
          });
          if (!prestamoLocked)
            throw new NotFoundException('Préstamo no encontrado');
          if (prestamoLocked.estado === EstadoPrestamo.PAGADO)
            throw new BadRequestException(
              'Este préstamo ya está completamente pagado',
            );
          if (prestamoLocked.estado === EstadoPrestamo.CANCELADO)
            throw new BadRequestException(
              'No se puede pagar un préstamo cancelado',
            );

          // 1. Releer cuotas pendientes bajo el lock (fuente de verdad C5)
          const cuotasPendientes = await tx.cuota.findMany({
            where: { prestamoId: dto.prestamoId, pagada: false },
            orderBy: { numero: 'asc' },
          });

          if (cuotasPendientes.length === 0) {
            throw new BadRequestException(
              'No hay cuotas pendientes en este préstamo',
            );
          }

          // 2. Saldo REAL desde las cuotas recién leídas
          const saldoReal = roundMoney(
            cuotasPendientes.reduce(
              (s, c) => s + c.capital + c.interes + (c.mora || 0),
              0,
            ),
          );

          // 3. Validar contra saldo real
          if (dto.montoPagado > saldoReal + 0.001) {
            throw new BadRequestException(
              `El monto del pago ($${dto.montoPagado.toLocaleString()}) excede el saldo pendiente ($${saldoReal.toLocaleString()}).`,
            );
          }

          // 4. Validar contra monto máximo configurado
          ConfiguracionUtils.validarMontoMaximo(
            dto.montoPagado,
            config.montoMaximoPago,
            'pago',
          );

          // 5. Determinar cuota objetivo desde cuotas recién leídas
          let cuotaObjetivo = cuotasPendientes[0];

          if (dto.cuotaId) {
            const cuotaEspecifica = cuotasPendientes.find(
              (c) => c.id === dto.cuotaId,
            );
            if (!cuotaEspecifica) {
              throw new BadRequestException(
                'La cuota especificada no existe o ya fue pagada',
              );
            }
            cuotaObjetivo = cuotaEspecifica;
          }

          const montoExacto = roundMoney(
            cuotaObjetivo.monto + cuotaObjetivo.mora,
          );

          // 6. Calcular distribución del pago (mora → interés → capital)
          let montoPagado = roundMoney(dto.montoPagado);
          let moraAplicada = 0;
          let interesAplicado = 0;
          let capitalAplicado = 0;
          let excedente = 0;

          if (cuotaObjetivo.mora > 0) {
            moraAplicada = Math.min(montoPagado, cuotaObjetivo.mora);
            montoPagado = roundMoney(montoPagado - moraAplicada);
          }
          if (montoPagado > 0) {
            interesAplicado = Math.min(montoPagado, cuotaObjetivo.interes);
            montoPagado = roundMoney(montoPagado - interesAplicado);
          }
          if (montoPagado > 0) {
            capitalAplicado = Math.min(montoPagado, cuotaObjetivo.capital);
            montoPagado = roundMoney(montoPagado - capitalAplicado);
          }

          // Lo que sobra tras cubrir la cuota objetivo es excedente
          excedente = roundMoney(montoPagado);

          // ¿Cubre el pago el total exacto de la cuota?
          const pagoCompleto = roundMoney(dto.montoPagado) >= montoExacto;

          // 7. Crear el pago
          const pago = await tx.pago.create({
            data: {
              prestamoId: dto.prestamoId,
              usuarioId,
              montoTotal: roundMoney(dto.montoPagado),
              capital: roundMoney(capitalAplicado + excedente),
              interes: interesAplicado,
              mora: moraAplicada,
              metodo: dto.metodo,
              referencia: dto.referencia,
              observacion: dto.observacion,
              cajaId: caja.id,
              idempotencyKey: dto.idempotencyKey ?? null,
            },
          });

          // 8. Actualizar cuota objetivo según si el pago fue completo o parcial
          if (pagoCompleto) {
            // ── Pago completo: marcar la cuota como pagada ─────────────────────
            await tx.cuota.update({
              where: { id: cuotaObjetivo.id },
              data: {
                pagada: true,
                fechaPago: new Date(),
                mora: cuotaObjetivo.mora, // preservar mora registrada
              },
            });
          } else {
            // ── PAGO PARCIAL: reducir los saldos de la cuota ───────────────────
            // BUG FIX: antes esta rama no existía — el pago se registraba
            // pero la cuota no se actualizaba, perdiendo el abono.
            const nuevaMora = Math.max(
              0,
              roundMoney(cuotaObjetivo.mora - moraAplicada),
            );
            const nuevoInteres = Math.max(
              0,
              roundMoney(cuotaObjetivo.interes - interesAplicado),
            );
            const nuevoCapital = Math.max(
              0,
              roundMoney(cuotaObjetivo.capital - capitalAplicado),
            );
            const nuevoMonto = roundMoney(nuevoCapital + nuevoInteres);

            await tx.cuota.update({
              where: { id: cuotaObjetivo.id },
              data: {
                mora: nuevaMora,
                interes: nuevoInteres,
                capital: nuevoCapital,
                monto: nuevoMonto,
              },
            });
          }

          // 9. Aplicar excedente a cuotas siguientes (solo si el pago fue completo)
          // C7c: el excedente cubre mora → interés → capital de cada cuota futura
          // y el `monto` recalculado SIEMPRE incluye la mora restante (antes se
          // saltaba la mora y se marcaba pagada la cuota al agotar su capital,
          // dejando interés+mora "regalados").
          if (excedente > 0) {
            const cuotasRestantes = cuotasPendientes.filter(
              (c) => c.id !== cuotaObjetivo.id,
            );
            let abonoRestante = excedente;

            for (const cuota of cuotasRestantes) {
              if (abonoRestante <= 0) break;

              let restante = abonoRestante;
              let pagoMora = 0;
              let pagoInteres = 0;
              let pagoCapital = 0;

              if (cuota.mora > 0) {
                pagoMora = Math.min(restante, cuota.mora);
                restante = roundMoney(restante - pagoMora);
              }
              if (restante > 0) {
                pagoInteres = Math.min(restante, cuota.interes);
                restante = roundMoney(restante - pagoInteres);
              }
              if (restante > 0) {
                pagoCapital = Math.min(restante, cuota.capital);
                restante = roundMoney(restante - pagoCapital);
              }

              const nuevaMora = Math.max(0, roundMoney(cuota.mora - pagoMora));
              const nuevoInteres = Math.max(
                0,
                roundMoney(cuota.interes - pagoInteres),
              );
              const nuevoCapital = Math.max(
                0,
                roundMoney(cuota.capital - pagoCapital),
              );
              const nuevoMonto = roundMoney(nuevoCapital + nuevoInteres);

              if (nuevoMonto <= 0) {
                await tx.cuota.update({
                  where: { id: cuota.id },
                  data: {
                    capital: 0,
                    interes: 0,
                    mora: 0,
                    monto: 0,
                    pagada: true,
                    fechaPago: new Date(),
                  },
                });
              } else {
                await tx.cuota.update({
                  where: { id: cuota.id },
                  data: {
                    capital: nuevoCapital,
                    interes: nuevoInteres,
                    mora: nuevaMora,
                    monto: nuevoMonto,
                  },
                });
              }
              abonoRestante = roundMoney(
                abonoRestante - pagoMora - pagoInteres - pagoCapital,
              );
            }
          }

          // 10. Recalcular saldo real desde cuotas actualizadas
          const cuotasRestantesActualizadas = await tx.cuota.findMany({
            where: { prestamoId: dto.prestamoId, pagada: false },
            select: { capital: true, interes: true, mora: true },
          });

          const nuevoSaldo = Math.max(
            0,
            roundMoney(
              cuotasRestantesActualizadas.reduce(
                (s, c) => s + c.capital + c.interes + (c.mora || 0),
                0,
              ),
            ),
          );

          const nuevaMoraAcumulada = Math.max(
            0,
            roundMoney(
              cuotasRestantesActualizadas.reduce(
                (s, c) => s + (c.mora || 0),
                0,
              ),
            ),
          );

          // 11. Determinar nuevo estado del préstamo
          const cuotasAunPendientes = cuotasRestantesActualizadas.length;

          let nuevoEstado: EstadoPrestamo = prestamoLocked.estado;
          if (cuotasAunPendientes === 0 || nuevoSaldo <= 0) {
            nuevoEstado = EstadoPrestamo.PAGADO;
          } else {
            const hoy = new Date();
            const cuotasVencidas = await tx.cuota.count({
              where: {
                prestamoId: dto.prestamoId,
                pagada: false,
                fechaVencimiento: { lt: hoy },
              },
            });
            nuevoEstado =
              cuotasVencidas > 0
                ? EstadoPrestamo.ATRASADO
                : EstadoPrestamo.ACTIVO;
          }

          // 12. Actualizar préstamo
          await tx.prestamo.update({
            where: { id: dto.prestamoId },
            data: { moraAcumulada: nuevaMoraAcumulada, estado: nuevoEstado },
          });

          // 13. Leer datos del cliente y préstamo actualizado
          const prestamoActualizado = await tx.prestamo.findUnique({
            where: { id: dto.prestamoId },
            include: {
              cliente: {
                select: { nombre: true, apellido: true, cedula: true },
              },
            },
          });

          if (!prestamoActualizado)
            throw new NotFoundException('Préstamo no encontrado');

          // 14. Crear MovimientoFinanciero
          const clienteNombreTx =
            `${prestamoActualizado.cliente.nombre} ${prestamoActualizado.cliente.apellido}`.trim();
          await tx.movimientoFinanciero.create({
            data: {
              tipo: 'PAGO_RECIBIDO',
              monto: roundMoney(dto.montoPagado),
              capital: roundMoney(capitalAplicado + excedente),
              interes: interesAplicado,
              mora: moraAplicada,
              referenciaTipo: 'PAGO',
              referenciaId: pago.id,
              cajaId: caja.id,
              empresaId,
              usuarioId,
              descripcion: `Pago${pagoCompleto ? '' : ' parcial'} de ${clienteNombreTx} — Capital: RD$${capitalAplicado.toLocaleString()}, Interés: RD$${interesAplicado.toLocaleString()}, Mora: RD$${moraAplicada.toLocaleString()}`,
            },
          });

          // 15. Actualizar totales de caja (solo efectivo)
          if (dto.metodo === 'EFECTIVO' && caja.id) {
            await tx.cajaSesion.update({
              where: { id: caja.id },
              data: { totalIngresos: { increment: dto.montoPagado } },
            });
          }

          return {
            pago: {
              id: pago.id,
              createdAt: pago.createdAt,
              montoTotal: roundMoney(dto.montoPagado),
              capital: roundMoney(capitalAplicado + excedente),
              interes: interesAplicado,
              mora: moraAplicada,
              metodo: pago.metodo,
              referencia: pago.referencia,
              observacion: pago.observacion,
              abonoCapital: excedente,
              pagoCompleto,
            },
            prestamo: {
              id: prestamoActualizado.id,
              monto: prestamoActualizado.monto,
              numeroCuotas: prestamoActualizado.numeroCuotas,
              frecuenciaPago: prestamoActualizado.frecuenciaPago,
              tasaInteres: prestamoActualizado.tasaInteres,
              saldoPendiente: nuevoSaldo,
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
              pagoCompleto,
            },
            // Campos de uso interno (auditoría y distribución del pago)
            saldoReal,
            saldoPendiente: nuevoSaldo,
            pagoCompleto,
            capitalAplicado,
            interesAplicado,
            moraAplicada,
            excedente,
            cuotaObjetivo,
          };
        }),
      dto.prestamoId,
      dto.idempotencyKey,
    ); // ── FIN $transaction ──────────────────────────────────────────────

    // Colisión de idempotencia resuelta: devolvemos el pago ya registrado.
    if (txResultado.conflicto) {
      return txResultado.resultado;
    }
    const resultadoTx = txResultado.resultado;

    // ✅ FUERA de la transacción
    const clienteNombre =
      `${resultadoTx.cliente.nombre} ${resultadoTx.cliente.apellido}`.trim();

    const [usuario] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true },
      }),
      registrarAuditoria(this.prisma, {
        empresaId,
        usuarioId,
        tipo: 'PAGO',
        accion: resultadoTx.pagoCompleto ? 'PAGO' : 'PAGO_PARCIAL',
        descripcion: `Pago${resultadoTx.pagoCompleto ? '' : ' parcial'} RD$${dto.montoPagado.toLocaleString()} (Capital: RD$${resultadoTx.capitalAplicado.toLocaleString()}, Interés: RD$${resultadoTx.interesAplicado.toLocaleString()}, Mora: RD$${resultadoTx.moraAplicada.toLocaleString()}) — Cliente: ${clienteNombre}`,
        monto: dto.montoPagado,
        referenciaId: dto.prestamoId,
        datosAnteriores: { saldoAntes: resultadoTx.saldoReal },
        datosNuevos: {
          capital: resultadoTx.capitalAplicado,
          interes: resultadoTx.interesAplicado,
          mora: resultadoTx.moraAplicada,
          saldoDespues: resultadoTx.saldoPendiente,
          cuotaPagada: resultadoTx.pagoCompleto,
          cuotaId: resultadoTx.cuotaObjetivo.id,
          pagoCompleto: resultadoTx.pagoCompleto,
        },
      }).catch(() => {}),
    ]);

    await this.invalidarCache(empresaId);

    return {
      pago: resultadoTx.pago,
      prestamo: resultadoTx.prestamo,
      cliente: resultadoTx.cliente,
      cuota: resultadoTx.cuota,
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
    idempotencyKey?: string,
    fecha?: string,
  ) {
    const metodoPago = metodo as MetodoPago;

    // ── Replay idempotente: mismo comportamiento que registrarPago
    if (idempotencyKey) {
      const existente = await this.prisma.pago.findFirst({
        where: { prestamoId, idempotencyKey, prestamo: { empresaId } },
        select: { id: true },
      });
      if (existente) {
        return this.respuestaPagoExistente(existente.id);
      }
    }

    const caja = await this.assertCajaAbierta(empresaId, usuarioId, fecha);

    const prestamo = await this.prisma.prestamo.findFirst({
      where: { id: prestamoId, empresaId },
      include: {
        cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
        cliente: { select: { nombre: true, apellido: true, cedula: true } },
      },
    });

    if (!prestamo) throw new NotFoundException('Préstamo no encontrado');
    if (prestamo.estado === EstadoPrestamo.PAGADO)
      throw new BadRequestException(
        'Este préstamo ya está completamente pagado',
      );
    if (prestamo.estado === EstadoPrestamo.CANCELADO)
      throw new BadRequestException('No se puede saldar un préstamo cancelado');

    const cuotasPendientes = prestamo.cuotas;
    if (cuotasPendientes.length === 0)
      throw new BadRequestException(
        'No hay cuotas pendientes en este préstamo',
      );

    const txResultado = await this.ejecutarTxConIdempotencia(
      () =>
        this.prisma.$transaction(async (tx) => {
          // Lock de fila del préstamo (C5): serializa pagos concurrentes
          await tx.$queryRaw`SELECT id FROM "Prestamo" WHERE id = ${prestamoId} FOR UPDATE`;

          // 0.5 Revalidar caja bajo el lock (C7b): la caja pudo cerrarse entre
          // la validación pre-tx y la ejecución de la transacción.
          const cajaLocked = await tx.cajaSesion.findFirst({
            where: { id: caja.id, estado: 'ABIERTA' },
            select: { id: true },
          });
          if (!cajaLocked) {
            throw new BadRequestException(
              'Debes abrir tu caja antes de registrar pagos. Ve a la sección Caja para abrirla.',
            );
          }

          // Releer préstamo + cuotas bajo el lock (fuente de verdad C5)
          const prestamoLocked = await tx.prestamo.findFirst({
            where: { id: prestamoId, empresaId },
            include: {
              cuotas: { where: { pagada: false }, orderBy: { numero: 'asc' } },
              cliente: {
                select: { nombre: true, apellido: true, cedula: true },
              },
            },
          });

          if (!prestamoLocked)
            throw new NotFoundException('Préstamo no encontrado');
          if (prestamoLocked.estado === EstadoPrestamo.PAGADO)
            throw new BadRequestException(
              'Este préstamo ya está completamente pagado',
            );
          if (prestamoLocked.estado === EstadoPrestamo.CANCELADO)
            throw new BadRequestException(
              'No se puede saldar un préstamo cancelado',
            );

          const cuotasSaldadas = prestamoLocked.cuotas;
          if (cuotasSaldadas.length === 0)
            throw new BadRequestException(
              'No hay cuotas pendientes en este préstamo',
            );

          // Calcular totales exactos desde las cuotas (respeta pagos parciales previos)
          const totalCapital = roundMoney(
            cuotasSaldadas.reduce((s, c) => s + c.capital, 0),
          );
          const totalInteres = roundMoney(
            cuotasSaldadas.reduce((s, c) => s + c.interes, 0),
          );
          const totalMora = roundMoney(
            cuotasSaldadas.reduce((s, c) => s + (c.mora || 0), 0),
          );
          const montoTotal = roundMoney(
            totalCapital + totalInteres + totalMora,
          );

          const pago = await tx.pago.create({
            data: {
              prestamoId,
              usuarioId,
              montoTotal,
              capital: totalCapital,
              interes: totalInteres,
              mora: totalMora,
              metodo: metodoPago,
              referencia: referencia ?? null,
              observacion: observacion ?? 'Saldo total del préstamo',
              cajaId: caja.id,
              idempotencyKey: idempotencyKey ?? null,
            },
          });

          await tx.cuota.updateMany({
            where: { prestamoId, pagada: false },
            data: { pagada: true, fechaPago: new Date() },
          });

          await tx.prestamo.update({
            where: { id: prestamoId },
            data: { moraAcumulada: 0, estado: EstadoPrestamo.PAGADO },
          });

          // Movimiento financiero
          const clienteNombreTx =
            `${prestamoLocked.cliente.nombre} ${prestamoLocked.cliente.apellido}`.trim();
          await tx.movimientoFinanciero.create({
            data: {
              tipo: 'PAGO_RECIBIDO',
              monto: montoTotal,
              capital: totalCapital,
              interes: totalInteres,
              mora: totalMora,
              referenciaTipo: 'PAGO',
              referenciaId: pago.id,
              cajaId: caja.id,
              empresaId,
              usuarioId,
              descripcion: `Saldo total de ${clienteNombreTx} — Capital: RD$${totalCapital.toLocaleString()}, Interés: RD$${totalInteres.toLocaleString()}, Mora: RD$${totalMora.toLocaleString()}`,
            },
          });

          if (metodoPago === 'EFECTIVO' && caja.id) {
            await tx.cajaSesion.update({
              where: { id: caja.id },
              data: { totalIngresos: { increment: montoTotal } },
            });
          }

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
              id: prestamoLocked.id,
              monto: prestamoLocked.monto,
              numeroCuotas: prestamoLocked.numeroCuotas,
              frecuenciaPago: prestamoLocked.frecuenciaPago,
              tasaInteres: prestamoLocked.tasaInteres,
              saldoPendiente: 0,
            },
            cliente: {
              nombre: prestamoLocked.cliente.nombre,
              apellido: prestamoLocked.cliente.apellido,
              cedula: prestamoLocked.cliente.cedula,
            },
            cuota: null,
          };
        }),
      prestamoId,
      idempotencyKey,
    );

    // Colisión de idempotencia resuelta: devolvemos el pago ya registrado.
    if (txResultado.conflicto) {
      return txResultado.resultado;
    }
    const pagoCreado = txResultado.resultado;

    const clienteNombre =
      `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}`.trim();

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
        descripcion: `Préstamo saldado RD$${pagoCreado.pago.montoTotal.toLocaleString()} (Capital: RD$${pagoCreado.pago.capital.toLocaleString()}, Interés: RD$${pagoCreado.pago.interes.toLocaleString()}, Mora: RD$${pagoCreado.pago.mora.toLocaleString()}) — Cliente: ${clienteNombre}`,
        monto: pagoCreado.pago.montoTotal,
        referenciaId: prestamoId,
        datosAnteriores: { cuotasPendientes: cuotasPendientes.length },
        datosNuevos: {
          estado: 'PAGADO',
          cuotasPagadas: cuotasPendientes.length,
        },
      }).catch(() => {}),
    ]);

    await this.invalidarCache(empresaId);

    return {
      pago: pagoCreado.pago,
      prestamo: pagoCreado.prestamo,
      cliente: pagoCreado.cliente,
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
    const pagos = await this.prisma.pago.findMany({
      where: { prestamo: { empresaId } },
      include: {
        usuario: { select: { id: true, nombre: true } },
        prestamo: {
          select: {
            id: true,
            monto: true,
            cliente: {
              select: { id: true, nombre: true, apellido: true, cedula: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const prestamoIds = [...new Set(pagos.map((p) => p.prestamo.id))];

    const saldos = prestamoIds.length
      ? await this.prisma.cuota.groupBy({
          by: ['prestamoId'],
          where: { prestamoId: { in: prestamoIds }, pagada: false },
          _sum: { capital: true, interes: true, mora: true },
        })
      : [];

    const saldoPorPrestamo = new Map(
      saldos.map((s) => [
        s.prestamoId,
        roundMoney(
          (s._sum.capital ?? 0) + (s._sum.interes ?? 0) + (s._sum.mora ?? 0),
        ),
      ]),
    );

    return pagos.map((p) => ({
      ...p,
      prestamo: {
        ...p.prestamo,
        saldoPendiente: saldoPorPrestamo.get(p.prestamo.id) ?? 0,
      },
    }));
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

    const saldoPendiente = Math.max(
      0,
      roundMoney(
        pago.prestamo.cuotas
          .filter((c) => !c.pagada)
          .reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0),
      ),
    );

    const cuotaDelPago =
      pago.prestamo?.cuotas?.find((c) => {
        if (!c.fechaPago) return false;
        const diffMs = Math.abs(
          new Date(c.fechaPago).getTime() - new Date(pago.createdAt).getTime(),
        );
        return diffMs < 60_000;
      }) ?? null;

    let moraCalculada = cuotaDelPago?.mora ?? pago.mora;
    if (
      cuotaDelPago &&
      cuotaDelPago.mora === 0 &&
      new Date(cuotaDelPago.fechaVencimiento) < new Date(pago.createdAt)
    ) {
      try {
        const config = await this.prisma.configuracion.findUnique({
          where: { empresaId },
        });
        if (config?.moraPorcentajeMensual) {
          const diasAtraso = differenceInDays(
            startOfDay(new Date(pago.createdAt)),
            startOfDay(new Date(cuotaDelPago.fechaVencimiento)),
          );
          if (diasAtraso > (config.diasGracia ?? 0)) {
            moraCalculada = roundMoney(
              cuotaDelPago.monto * (config.moraPorcentajeMensual / 100),
            );
          }
        }
      } catch {
        /* usar valor almacenado */
      }
    }

    return {
      pago: {
        id: pago.id,
        createdAt: pago.createdAt,
        montoTotal: pago.montoTotal,
        capital: pago.capital,
        interes: pago.interes,
        mora: moraCalculada,
        abonoCapital: Math.max(
          0,
          roundMoney(pago.montoTotal - pago.capital - pago.interes - pago.mora),
        ),
        pagoCompleto: !!(cuotaDelPago?.pagada && cuotaDelPago?.fechaPago),
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
      cuota: cuotaDelPago
        ? {
            id: cuotaDelPago.id,
            numero: cuotaDelPago.numero,
            monto: cuotaDelPago.monto,
            capital: cuotaDelPago.capital,
            interes: cuotaDelPago.interes,
            mora: moraCalculada,
            fechaVencimiento: cuotaDelPago.fechaVencimiento,
          }
        : null,
      usuario: { nombre: pago.usuario?.nombre ?? 'Sistema' },
    };
  }

  // ─── RESUMEN DE PAGOS ─────────────────────────────────────────────────────

  async getResumen(empresaId: string) {
    const inicioHoy = getInicioDiaRD();
    const finHoy = getFinDiaRD();
    const inicioMes = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [totalHoy, totalMes, conteoHoy, conteoMes] = await Promise.all([
      this.prisma.pago.aggregate({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: inicioHoy, lte: finHoy },
        },
        _sum: { montoTotal: true },
      }),
      this.prisma.pago.aggregate({
        where: { prestamo: { empresaId }, createdAt: { gte: inicioMes } },
        _sum: { montoTotal: true },
      }),
      this.prisma.pago.count({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: inicioHoy, lte: finHoy },
        },
      }),
      this.prisma.pago.count({
        where: { prestamo: { empresaId }, createdAt: { gte: inicioMes } },
      }),
    ]);

    return {
      cobradoHoy: totalHoy._sum.montoTotal ?? 0,
      cobradoMes: totalMes._sum.montoTotal ?? 0,
      pagosHoy: conteoHoy,
      pagosMes: conteoMes,
    };
  }
}
