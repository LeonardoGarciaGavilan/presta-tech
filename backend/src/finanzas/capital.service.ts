import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInyeccionDto } from './dto/create-inyeccion.dto';
import { CreateRetiroDto } from './dto/create-retiro.dto';
import { CreateCapitalInicialDto } from './dto/create-capital.dto';
import { calcularSaldoDesdeCuotas } from '../common/utils/prestamo.utils';
import { getFechaRD } from '../common/utils/fecha.utils';
import { m, roundMoney } from '../common/utils/money';
import type { MoneyInput } from '../common/utils/money';

export interface Alerta {
  tipo: 'INFO' | 'WARNING' | 'CRITICAL';
  mensaje: string;
  codigo: string;
  valor: number;
  umbral: number;
}

export interface Metricas {
  rentabilidad: number | null;
  eficienciaCobranza: number | null;
  dineroOcioso: number;
  crecimientoMensual: number;
}

const MINIMO_OPERATIVO = 10000;
const UMBRAL_OCIOSO = 20000;
const UMBRAL_RENTABILIDAD = 10;
const UMBRAL_MORA = 0.2;
const UMBRAL_CAJA_BAJA = 5000;

@Injectable()
export class CapitalService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: any) {
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPERADMIN') {
      throw new ForbiddenException(
        'Solo el administrador puede realizar esta operación',
      );
    }
  }

  private generarAlertas(
    metricas: Metricas,
    resumen: any,
    dinero: any,
  ): Alerta[] {
    const alertas: Alerta[] = [];

    if (metricas.dineroOcioso > UMBRAL_OCIOSO) {
      alertas.push({
        tipo: 'WARNING',
        mensaje: `Tienes RD$${metricas.dineroOcioso.toLocaleString()} sin prestar generando 0% retorno`,
        codigo: 'DINERO_OCIOSO',
        valor: metricas.dineroOcioso,
        umbral: UMBRAL_OCIOSO,
      });
    }

    if (
      metricas.rentabilidad !== null &&
      metricas.rentabilidad < UMBRAL_RENTABILIDAD
    ) {
      alertas.push({
        tipo: 'WARNING',
        mensaje: `La rentabilidad del negocio es baja (${metricas.rentabilidad}%). Considera aumentar el capital prestado.`,
        codigo: 'BAJA_RENTABILIDAD',
        valor: metricas.rentabilidad,
        umbral: UMBRAL_RENTABILIDAD,
      });
    }

    const ratioMora =
      resumen.totalCobrado > 0 ? resumen.totalMora / resumen.totalCobrado : 0;

    if (ratioMora > UMBRAL_MORA) {
      alertas.push({
        tipo: 'CRITICAL',
        mensaje: `Alto nivel de mora en la cartera (${Math.round(ratioMora * 100)}% del total cobrado)`,
        codigo: 'ALTA_MORA',
        valor: Math.round(ratioMora * 10000) / 100,
        umbral: UMBRAL_MORA * 100,
      });
    }

    if (metricas.crecimientoMensual < 0) {
      alertas.push({
        tipo: 'WARNING',
        mensaje: `Las ganancias bajaron RD$${Math.abs(metricas.crecimientoMensual).toLocaleString()} respecto al mes anterior`,
        codigo: 'CRECIMIENTO_NEGATIVO',
        valor: metricas.crecimientoMensual,
        umbral: 0,
      });
    }

    if (dinero.enCaja < UMBRAL_CAJA_BAJA) {
      alertas.push({
        tipo: 'CRITICAL',
        mensaje: `Nivel de caja bajo (RD$${dinero.enCaja.toLocaleString()}). Riesgo operativo.`,
        codigo: 'CAJA_BAJA',
        valor: dinero.enCaja,
        umbral: UMBRAL_CAJA_BAJA,
      });
    }

    return alertas;
  }

  async getCapitalEmpresa(empresaId: string) {
    const capital = await this.prisma.capitalEmpresa.findUnique({
      where: { empresaId },
    });

    const inyecciones = await this.prisma.inyeccionCapital.findMany({
      where: { empresaId },
      orderBy: { fecha: 'desc' },
      include: { usuario: { select: { nombre: true } } },
    });

    // Obtener total de retiros de capital desde MovimientoFinanciero
    const [retirosCapital, gastosCapital] = await Promise.all([
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'RETIRO_CAPITAL' },
        _sum: { capital: true },
      }),
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'GASTO_CAPITAL' },
        _sum: { capital: true },
      }),
    ]);
    const totalRetirosCapital = Math.abs(m(retirosCapital._sum.capital ?? 0));

    // Gastos clasificados como CAPITAL (Gasto.tipo='CAPITAL') se descuentan
    // del capital, no de las ganancias (paridad con el ledger GASTO_CAPITAL).
    const totalGastosCapital = roundMoney(m(gastosCapital._sum.capital ?? 0));

    const capitalInicial = capital?.capitalInicial ?? 0;
    const totalInyecciones = inyecciones.reduce(
      (sum, i) => sum + m(i.monto),
      0,
    );
    const capitalTotal = roundMoney(
      m(capitalInicial) +
        totalInyecciones -
        totalRetirosCapital -
        totalGastosCapital,
    );

    return {
      capitalInicial,
      capitalTotal,
      totalInyecciones,
      totalRetirosCapital,
      totalGastosCapital,
      tieneCapitalRegistrado: !!capital,
      fechaRegistro: capital?.fechaRegistro ?? null,
      observaciones: capital?.observaciones ?? null,
      inyecciones,
    };
  }

  async registrarCapitalInicial(dto: CreateCapitalInicialDto, user: any) {
    this.assertAdmin(user);
    const { empresaId } = user;

    if (dto.capitalInicial <= 0) {
      throw new BadRequestException('El capital inicial debe ser mayor a 0');
    }

    const capitalExistente = await this.prisma.capitalEmpresa.findUnique({
      where: { empresaId },
    });

    if (capitalExistente) {
      throw new BadRequestException(
        'Ya existe un capital registrado para esta empresa. Usa "Inyección de Capital" para agregar más.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const capital = await tx.capitalEmpresa.create({
        data: {
          empresaId,
          capitalInicial: dto.capitalInicial,
          observaciones:
            dto.observaciones ??
            `Capital inicial registrado el ${new Date().toLocaleDateString('es-DO')}`,
        },
      });

      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'INYECCION_CAPITAL',
          monto: dto.capitalInicial,
          capital: dto.capitalInicial,
          interes: 0,
          mora: 0,
          referenciaTipo: 'INYECCION',
          referenciaId: capital.id,
          empresaId,
          usuarioId: user.userId,
          descripcion: `Registro de capital inicial: ${dto.observaciones || 'Capital inicial'}`,
        },
      });

      return capital;
    });
  }

  async inyectarCapital(dto: CreateInyeccionDto, user: any) {
    this.assertAdmin(user);
    const { empresaId } = user;

    if (dto.monto <= 0) {
      throw new BadRequestException(
        'El monto de la inyección debe ser mayor a 0',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const inyeccion = await tx.inyeccionCapital.create({
        data: {
          empresaId,
          monto: dto.monto,
          concepto: dto.concepto,
          usuarioId: user.userId,
        },
      });

      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'INYECCION_CAPITAL',
          monto: dto.monto,
          capital: dto.monto,
          interes: 0,
          mora: 0,
          referenciaTipo: 'INYECCION',
          referenciaId: inyeccion.id,
          empresaId,
          usuarioId: user.userId,
          descripcion: `Inyección de capital: ${dto.concepto}`,
        },
      });

      return inyeccion;
    });
  }

  async calcularGananciasDisponibles(empresaId: string): Promise<number> {
    const [totalIntereses, totalRetiros] = await Promise.all([
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'PAGO_RECIBIDO' },
        _sum: { interes: true, mora: true },
      }),
      this.prisma.retiroGanancias.aggregate({
        where: { empresaId },
        _sum: { monto: true },
      }),
    ]);

    const totalGanado =
      m(totalIntereses._sum.interes ?? 0) + m(totalIntereses._sum.mora ?? 0);
    const totalRetirado = m(totalRetiros._sum.monto ?? 0);

    return roundMoney(totalGanado - totalRetirado);
  }

  async retirarGanancias(dto: CreateRetiroDto, user: any) {
    this.assertAdmin(user);
    const { empresaId } = user;

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del retiro debe ser mayor a 0');
    }

    const gananciasDisponibles =
      await this.calcularGananciasDisponibles(empresaId);

    if (dto.monto > gananciasDisponibles) {
      throw new BadRequestException(
        `No tienes suficientes ganancias acumuladas. Disponible: RD$${gananciasDisponibles.toLocaleString()}`,
      );
    }

    // Validar que haya efectivo en caja para el retiro
    const dineroEnCaja = await this.calcularDineroEnCaja(empresaId);
    if (dto.monto > dineroEnCaja) {
      throw new BadRequestException(
        `No hay suficiente efectivo en caja para retirar. En caja: RD$${dineroEnCaja.toLocaleString()}, Solicitado: RD$${dto.monto.toLocaleString()}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const retiro = await tx.retiroGanancias.create({
        data: {
          empresaId,
          monto: dto.monto,
          concepto: dto.concepto,
          usuarioId: user.userId,
        },
      });

      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'RETIRO_GANANCIAS',
          monto: dto.monto,
          capital: 0,
          interes: dto.monto,
          mora: 0,
          referenciaTipo: 'RETIRO',
          referenciaId: retiro.id,
          empresaId,
          usuarioId: user.userId,
          descripcion: `Retiro de ganancias: ${dto.concepto}`,
        },
      });

      return retiro;
    });
  }

  async getRetiros(user: any) {
    this.assertAdmin(user);

    return this.prisma.retiroGanancias.findMany({
      where: { empresaId: user.empresaId },
      orderBy: { fecha: 'desc' },
      include: { usuario: { select: { nombre: true } } },
    });
  }

  // ─── CALCULAR CAPITAL RETIRABLE ─────────────────────────────────
  // Capital que el usuario puede retirar del patrimonio
  // = Patrimonio - Ganancias - Caja - Calle
  // Sin afectar la liquidez mínima operativa (MINIMO_OPERATIVO = 10,000)
  async calcularCapitalRetirable(empresaId: string): Promise<number> {
    // Obtener componentes del patrimonio
    const capitalData = await this.getCapitalEmpresa(empresaId);
    const capitalTotal = capitalData.capitalTotal;

    // Calcular ganancias netas
    const [ingresos, gastos] = await Promise.all([
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'PAGO_RECIBIDO' },
        _sum: { interes: true, mora: true },
      }),
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'GASTO' },
        _sum: { interes: true },
      }),
    ]);
    const gananciasNetas = Math.max(
      0,
      roundMoney(
        m(ingresos._sum.interes ?? 0) +
          m(ingresos._sum.mora ?? 0) -
          Math.abs(m(gastos._sum.interes ?? 0)),
      ),
    );

    const dineroEnCaja = await this.calcularDineroEnCaja(empresaId);
    const dineroEnCalle = await this.calcularCalle(empresaId);

    // Calcular patrimonio total
    const retiros = await this.prisma.retiroGanancias.aggregate({
      where: { empresaId },
      _sum: { monto: true },
    });
    const totalRetiros = m(retiros._sum.monto ?? 0);
    const patrimonioTotal = roundMoney(
      capitalTotal + gananciasNetas - totalRetiros,
    );

    // Capital retirable = Patrimonio - Ganancias - Caja - Calle
    return Math.max(
      0,
      roundMoney(
        patrimonioTotal -
          gananciasNetas -
          dineroEnCaja -
          dineroEnCalle -
          MINIMO_OPERATIVO,
      ),
    );
  }

  // ─── RETIRAR CAPITAL ───────────────────────────────────────────
  async retirarCapital(dto: CreateRetiroDto, user: any) {
    this.assertAdmin(user);
    const { empresaId } = user;

    // Validar monto
    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del retiro debe ser mayor a 0');
    }

    // Validar que NO haya cajas abiertas
    const cajaAbierta = await this.prisma.cajaSesion.findFirst({
      where: { empresaId, estado: 'ABIERTA' },
    });
    if (cajaAbierta) {
      throw new BadRequestException(
        'No puedes retirar capital mientras existan cajas operativas abiertas. Cierra todas las cajas primero.',
      );
    }

    // Validar capital retirable disponible (capitalRetirable ya descuenta la
    // liquidez mínima operativa, por lo que no hay validación adicional).
    const capitalRetirable = await this.calcularCapitalRetirable(empresaId);
    if (dto.monto > capitalRetirable) {
      throw new BadRequestException(
        `No hay suficiente capital disponible para retirar. Disponible: RD$${capitalRetirable.toLocaleString()}`,
      );
    }

    // Crear movimiento financiero (no hay tabla RetiroCapital, solo MovimientoFinanciero)
    return this.prisma.$transaction(async (tx) => {
      await tx.movimientoFinanciero.create({
        data: {
          tipo: 'RETIRO_CAPITAL',
          monto: dto.monto,
          capital: -dto.monto,
          interes: 0,
          mora: 0,
          referenciaTipo: 'RETIRO',
          referenciaId: null,
          empresaId,
          usuarioId: user.userId,
          descripcion: `Retiro de capital: ${dto.concepto}`,
        },
      });

      return {
        mensaje: 'Retiro de capital realizado correctamente',
        monto: dto.monto,
        capitalRetirado: dto.monto,
      };
    });
  }

  async getDashboard(empresaId: string) {
    const ahora = new Date();
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(
      ahora.getFullYear(),
      ahora.getMonth() - 1,
      1,
    );

    const [
      capitalData,
      totalesPagos,
      totalesDesembolsos,
      totalesGastos,
      totalRetirosGananciasData,
      totalRetirosCapitalData,
      cajasAbiertas,
      interesEsperado,
      saldoVivoCuotas,
      movimientosMensuales,
    ] = await Promise.all([
      this.getCapitalEmpresa(empresaId),
      this.prisma.pago.aggregate({
        where: {
          prestamo: { empresaId },
        },
        _sum: {
          montoTotal: true,
          capital: true,
          interes: true,
          mora: true,
        },
      }),
      this.prisma.desembolsoCaja.aggregate({
        where: {
          empresaId,
        },
        _sum: {
          monto: true,
        },
      }),
      this.prisma.gasto.aggregate({
        where: { empresaId, tipo: 'OPERATIVO' },
        _sum: { monto: true },
      }),
      this.prisma.retiroGanancias.aggregate({
        where: { empresaId },
        _sum: { monto: true },
      }),
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'RETIRO_CAPITAL' },
        _sum: { capital: true },
      }),
      this.prisma.cajaSesion.aggregate({
        where: { empresaId, estado: 'ABIERTA' },
        _sum: { montoInicial: true, totalIngresos: true, totalEgresos: true },
      }),
      this.prisma.cuota.aggregate({
        where: {
          pagada: false,
          prestamo: {
            empresaId,
            estado: { in: ['ACTIVO', 'ATRASADO'] },
          },
          fechaVencimiento: { lte: ahora },
        },
        _sum: { interes: true },
      }),
      this.prisma.cuota.aggregate({
        where: {
          pagada: false,
          prestamo: {
            empresaId,
            estado: { in: ['ACTIVO', 'ATRASADO'] },
          },
        },
        _sum: { capital: true, interes: true, mora: true },
      }),
      this.prisma.movimientoFinanciero.findMany({
        where: {
          empresaId,
          tipo: 'PAGO_RECIBIDO',
          fecha: { gte: inicioMesAnterior },
        },
        select: {
          fecha: true,
          interes: true,
          mora: true,
        },
      }),
    ]);

    const gananciasBrutas = roundMoney(
      m(totalesPagos._sum.interes ?? 0) + m(totalesPagos._sum.mora ?? 0),
    );

    const gastosTotales = roundMoney(m(totalesGastos._sum.monto ?? 0));
    const totalDesembolsado = roundMoney(m(totalesDesembolsos._sum.monto ?? 0));
    const totalRetiradoGanancias = roundMoney(
      m(totalRetirosGananciasData._sum.monto ?? 0),
    );
    const totalRetirosCapital = Math.abs(
      m(totalRetirosCapitalData._sum.capital ?? 0),
    );
    const totalRetirosCompleto = totalRetiradoGanancias + totalRetirosCapital;

    // Resultado operativo real
    const resultadoOperativo = roundMoney(gananciasBrutas - gastosTotales);

    // Si queda negativo, consume capital
    const excedenteQueConsumeCapital =
      resultadoOperativo < 0 ? Math.abs(resultadoOperativo) : 0;

    // Nunca mostrar ganancias negativas
    const gananciasNetas = resultadoOperativo > 0 ? resultadoOperativo : 0;

    // Capital ajustado
    const capitalAjustado = roundMoney(
      capitalData.capitalTotal - excedenteQueConsumeCapital,
    );

    // Patrimonio real (incluye ambos tipos de retiros)
    const patrimonioTotal = roundMoney(
      capitalAjustado + gananciasNetas - totalRetirosCompleto,
    );

    // D1: Dinero en la calle = saldo vivo desde cuotas no pagadas de
    // préstamos ACTIVO/ATRASADO (capital + interés + mora).
    const saldoVivoCalle = roundMoney(
      m(saldoVivoCuotas._sum.capital ?? 0) +
        m(saldoVivoCuotas._sum.interes ?? 0) +
        m(saldoVivoCuotas._sum.mora ?? 0),
    );
    const dineroEnCalle = Math.max(0, saldoVivoCalle);
    const montoInicialCajas = roundMoney(
      m(cajasAbiertas._sum.montoInicial ?? 0),
    );

    // Caja actual (canónica) = Σ sobre las sesiones ABIERTAS de
    // (montoInicial + ingresos - egresos). Mismo criterio que validarBalance.
    const dineroEnCaja = Math.max(
      0,
      roundMoney(
        m(cajasAbiertas._sum.montoInicial ?? 0) +
          m(cajasAbiertas._sum.totalIngresos ?? 0) -
          m(cajasAbiertas._sum.totalEgresos ?? 0),
      ),
    );

    const metricas = this.calcularMetricas(
      capitalAjustado,
      gananciasNetas,
      dineroEnCaja,
      gananciasBrutas,
      m(interesEsperado._sum.interes ?? 0),
      movimientosMensuales,
      inicioMesActual,
    );

    const resumen = {
      totalCobrado: roundMoney(m(totalesPagos._sum.montoTotal ?? 0)),
      // totalInteres es SOLO interés (sin mora) para que
      // capital + interes + mora sumen totalCobrado de forma coherente.
      totalInteres: roundMoney(m(totalesPagos._sum.interes ?? 0)),
      totalMora: roundMoney(m(totalesPagos._sum.mora ?? 0)),
      totalGastos: gastosTotales,
      totalDesembolsos: totalDesembolsado,
      balanceNeto: roundMoney(gananciasNetas - totalRetirosCompleto),
    };

    const dinero = {
      enCaja: dineroEnCaja,
      enCajaBase: montoInicialCajas,
      enCalle: dineroEnCalle,
      total: patrimonioTotal,
    };

    // Validar balance contable y agregar alerta si no cuadra
    const balance = await this.validarBalance(empresaId);
    const alertas = this.generarAlertas(metricas, resumen, dinero);

    if (!balance.cuadra) {
      alertas.unshift({
        tipo: 'CRITICAL',
        mensaje: `Descuadre contable detectado (RD$${balance.diferencia.toLocaleString()}). Revisar inmediatamente. Patrimonio: RD$${balance.patrimonio.toLocaleString()} vs Activos: RD$${balance.activos.toLocaleString()}`,
        codigo: 'DESCUADRE_CONTABLE',
        valor: balance.diferencia,
        umbral: 0,
      });
    }

    // Alert automática si el capital fue reducido por gastos
    if (excedenteQueConsumeCapital > 0) {
      alertas.unshift({
        tipo: 'WARNING',
        mensaje: `Los gastos excedieron las ganancias. RD$${excedenteQueConsumeCapital.toFixed(2)} fueron descontados del capital.`,
        codigo: 'CAPITAL_REDUCIDO',
        valor: excedenteQueConsumeCapital,
        umbral: 0,
      });
    }

    // Alert si la liquidez operativa es baja
    const capitalRetirable = await this.calcularCapitalRetirable(empresaId);
    if (capitalRetirable < 10000 && capitalRetirable > 0) {
      alertas.unshift({
        tipo: 'WARNING',
        mensaje: `Liquidez operativa baja. El capital disponible para retiro es de RD$${capitalRetirable.toLocaleString()}.`,
        codigo: 'LIQUIDEZ_BAJA',
        valor: capitalRetirable,
        umbral: 10000,
      });
    }

    return {
      capital: {
        total: capitalAjustado,
        original: capitalData.capitalTotal,
        reducidoPorPerdidas: excedenteQueConsumeCapital,
        inicial: capitalData.capitalInicial,
        totalInyecciones: capitalData.totalInyecciones,
        tieneRegistro: capitalData.tieneCapitalRegistrado,
        retirable: await this.calcularCapitalRetirable(empresaId),
      },
      ganancias: {
        netas: gananciasNetas,
        brutas: gananciasBrutas,
        gastos: gastosTotales,
        // totalInteresCobrado = interés únicamente (sin mora), coherente con
        // resumen.totalInteres. No duplica "brutas".
        totalInteresCobrado: resumen.totalInteres,
        totalRetiros: totalRetirosCompleto,
      },
      dinero: {
        ...dinero,
        total: patrimonioTotal,
      },
      resumen,
      metricas,
      alertas,
      timestamp: new Date().toISOString(),
    };
  }

  private calcularMetricas(
    capitalAjustado: number,
    gananciasNetas: number,
    dineroEnCaja: number,
    gananciasBrutas: number,
    interesEsperado: number,
    movimientosMensuales: {
      fecha: Date;
      interes: MoneyInput;
      mora: MoneyInput;
    }[],
    inicioMesActual: Date,
  ): Metricas {
    const rentabilidad =
      capitalAjustado > 0
        ? Math.round((gananciasNetas / capitalAjustado) * 10000) / 100
        : null;

    const eficienciaCobranza =
      interesEsperado > 0
        ? Math.round((gananciasBrutas / interesEsperado) * 10000) / 100
        : null;

    const dineroOcioso = Math.max(0, dineroEnCaja - MINIMO_OPERATIVO);

    const movimientosPorMes = this.agruparPorMes(movimientosMensuales);
    // Claves de mes en zona RD (YYYY-MM) para comparar mes actual vs anterior.
    const ahora = new Date();
    const mesActualKey = getFechaRD(ahora).slice(0, 7);
    const mesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const mesAnteriorKey = getFechaRD(mesAnterior).slice(0, 7);

    const gananciasMesActual = movimientosPorMes[mesActualKey] ?? 0;
    const gananciasMesAnterior = movimientosPorMes[mesAnteriorKey] ?? 0;

    const crecimientoMensual = roundMoney(
      gananciasMesActual - gananciasMesAnterior,
    );

    return {
      rentabilidad,
      eficienciaCobranza,
      dineroOcioso,
      crecimientoMensual,
    };
  }

  private agruparPorMes(
    movimientos: { fecha: Date; interes: MoneyInput; mora: MoneyInput }[],
  ): Record<string, number> {
    // Note: This function calculates gross earnings (interes + mora) by month
    const agrupado: Record<string, number> = {};

    for (const mov of movimientos) {
      // Buckets de mes en zona RD (YYYY-MM) para coherencia con finanzas.service
      const mesKey = getFechaRD(mov.fecha).slice(0, 7);
      if (!agrupado[mesKey]) {
        agrupado[mesKey] = 0;
      }
      agrupado[mesKey] += m(mov.interes) + m(mov.mora);
    }

    for (const key in agrupado) {
      agrupado[key] = roundMoney(agrupado[key]);
    }

    return agrupado;
  }

  async getResumenRutas(empresaId: string) {
    const rutas = await this.prisma.ruta.findMany({
      where: { empresaId, activa: true },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
    });

    const rutaIds = new Set(rutas.map((r) => r.id));

    // Todos los préstamos ACTIVO/ATRASADO de la empresa (no solo los de
    // clientes con ruta): así el total de dinero en calle cuadra con D1.
    const prestamos = await this.prisma.prestamo.findMany({
      where: {
        empresaId,
        estado: { in: ['ACTIVO', 'ATRASADO'] },
      },
      select: {
        id: true,
        clienteId: true,
        cliente: {
          select: {
            id: true,
            rutaClientes: {
              select: { rutaId: true },
            },
          },
        },
        cuotas: {
          where: { pagada: false },
          select: { capital: true, interes: true, mora: true, pagada: true },
        },
      },
    });

    const pagos = await this.prisma.pago.findMany({
      where: {
        prestamo: {
          empresaId,
        },
      },
      select: {
        capital: true,
        interes: true,
        mora: true,
        montoTotal: true,
        prestamo: {
          select: {
            cliente: {
              select: {
                rutaClientes: {
                  select: { rutaId: true },
                },
              },
            },
          },
        },
      },
    });

    // Cada préstamo/pago se asigna a UNA sola ruta (la primera activa del
    // cliente, en el orden de `rutas`). Esto deduplica a los clientes que
    // pertenecen a varias rutas y garantiza que Σ filas == totales == D1.
    const primeraRutaDe = (rutaClientes: { rutaId: string }[]): string | null => {
      const ids = new Set(rutaClientes.map((rc) => rc.rutaId));
      for (const r of rutas) {
        if (ids.has(r.id)) return r.id;
      }
      return null;
    };

    const bucketsPrestamos = new Map<string | null, typeof prestamos>();
    const bucketsPagos = new Map<string | null, typeof pagos>();
    const bucketea = (
      clienteRutas: { rutaId: string }[],
      item: any,
      prestamoLike: boolean,
    ) => {
      const rid = primeraRutaDe(clienteRutas);
      const target = prestamoLike ? bucketsPrestamos : bucketsPagos;
      const arr = target.get(rid);
      if (arr) (arr as any[]).push(item);
      else (target as any).set(rid, [item]);
    };
    for (const p of prestamos) bucketea(p.cliente.rutaClientes, p, true);
    for (const pg of pagos) bucketea(pg.prestamo.cliente.rutaClientes, pg, false);

    const construir = (
      rutaId: string | null,
      nombre: string,
      cobrador: string,
      prestamosArr: typeof prestamos,
      pagosArr: typeof pagos,
    ) => {
      const totalCobrado = pagosArr.reduce(
        (sum, p) => sum + m(p.montoTotal),
        0,
      );
      const totalInteres = pagosArr.reduce(
        (sum, p) => sum + m(p.interes) + m(p.mora),
        0,
      );
      const capitalRecuperado = pagosArr.reduce(
        (sum, p) => sum + m(p.capital),
        0,
      );
      const dineroEnCalle = prestamosArr.reduce(
        (sum, p) => sum + calcularSaldoDesdeCuotas(p.cuotas),
        0,
      );

      return {
        rutaId,
        nombre,
        cobrador,
        clientesActivos: new Set(
          prestamosArr.map((p) => p.clienteId),
        ).size,
        totalCobrado: roundMoney(totalCobrado),
        totalInteres: roundMoney(totalInteres),
        capitalRecuperado: roundMoney(capitalRecuperado),
        dineroEnCalle: roundMoney(dineroEnCalle),
        prestamosActivos: prestamosArr.length,
      };
    };

    const resumenRutas = rutas.map((ruta) =>
      construir(
        ruta.id,
        ruta.nombre,
        ruta.usuario.nombre,
        bucketsPrestamos.get(ruta.id) ?? [],
        bucketsPagos.get(ruta.id) ?? [],
      ),
    );

    // Clientes/préstamos sin ruta activa: rubro aparte para que el total
    // general cuadre con el D1 del dashboard.
    const sinRuta = construir(
      null,
      'Sin ruta asignada',
      '-',
      bucketsPrestamos.get(null) ?? [],
      bucketsPagos.get(null) ?? [],
    );
    if (sinRuta.prestamosActivos > 0 || sinRuta.totalCobrado > 0) {
      resumenRutas.push(sinRuta);
    }

    const totalGeneral = resumenRutas.reduce(
      (acc, r) => ({
        totalCobrado: acc.totalCobrado + r.totalCobrado,
        totalInteres: acc.totalInteres + r.totalInteres,
        capitalRecuperado: acc.capitalRecuperado + r.capitalRecuperado,
        dineroEnCalle: acc.dineroEnCalle + r.dineroEnCalle,
        clientesActivos: acc.clientesActivos + r.clientesActivos,
        prestamosActivos: acc.prestamosActivos + r.prestamosActivos,
      }),
      {
        totalCobrado: 0,
        totalInteres: 0,
        capitalRecuperado: 0,
        dineroEnCalle: 0,
        clientesActivos: 0,
        prestamosActivos: 0,
      },
    );

    return {
      rutas: resumenRutas.sort((a, b) => b.totalCobrado - a.totalCobrado),
      totales: {
        totalCobrado: roundMoney(totalGeneral.totalCobrado),
        totalInteres: roundMoney(totalGeneral.totalInteres),
        capitalRecuperado: roundMoney(totalGeneral.capitalRecuperado),
        dineroEnCalle: roundMoney(totalGeneral.dineroEnCalle),
        clientesActivos: totalGeneral.clientesActivos,
        prestamosActivos: totalGeneral.prestamosActivos,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getResumenFinanciero(empresaId: string) {
    return this.getDashboard(empresaId);
  }

  async getMovimientos(user: any, limite = 50) {
    this.assertAdmin(user);

    const movimientos = await this.prisma.movimientoFinanciero.findMany({
      where: { empresaId: user.empresaId },
      orderBy: { fecha: 'desc' },
      take: limite,
      include: { usuario: { select: { nombre: true } } },
    });

    // Convertir Decimal -> number en la frontera (defensa adicional a
    // convertirDecimales, garantiza tipos numéricos al cliente).
    return movimientos.map((mo) => ({
      ...mo,
      monto: m(mo.monto),
      capital: m(mo.capital),
      interes: m(mo.interes),
      mora: m(mo.mora),
    }));
  }

  // ─── VALIDAR BALANCE CONTABLE ─────────────────────────────────────────
  // Verifica que: Capital + Ganancias = Caja + Calle
  async validarBalance(empresaId: string) {
    // 1. Calcular capital total (ya incluye descuento de GASTO_CAPITAL)
    const capitalData = await this.getCapitalEmpresa(empresaId);
    const capitalTotal = capitalData.capitalTotal;

    // 2. Resultado operativo igual que el dashboard (mismas fuentes):
    //    ganancia bruta = Σ (interés + mora) de pagos; gastos = Σ gastos OPERATIVOS.
    const [pagos, gastosOperativos, retirosGananciasData, retirosCapitalData] =
      await Promise.all([
        this.prisma.pago.aggregate({
          where: { prestamo: { empresaId } },
          _sum: { interes: true, mora: true },
        }),
        this.prisma.gasto.aggregate({
          where: { empresaId, tipo: 'OPERATIVO' },
          _sum: { monto: true },
        }),
        this.prisma.retiroGanancias.aggregate({
          where: { empresaId },
          _sum: { monto: true },
        }),
        this.prisma.movimientoFinanciero.aggregate({
          where: { empresaId, tipo: 'RETIRO_CAPITAL' },
          _sum: { capital: true },
        }),
      ]);

    const gananciasBrutas = roundMoney(
      m(pagos._sum.interes ?? 0) + m(pagos._sum.mora ?? 0),
    );
    const gastosTotales = roundMoney(m(gastosOperativos._sum.monto ?? 0));
    const resultadoOperativo = roundMoney(gananciasBrutas - gastosTotales);

    // Nunca mostrar ganancias negativas (igual que dashboard): si el resultado
    // es negativo, el déficit consume capital (ver patrimonio).
    const gananciasNetas = resultadoOperativo > 0 ? resultadoOperativo : 0;

    // 3. Retiros (ganancias + capital)
    const totalRetirosGanancias = roundMoney(
      m(retirosGananciasData._sum.monto ?? 0),
    );
    const totalRetirosCapital = Math.abs(
      m(retirosCapitalData._sum.capital ?? 0),
    );
    const totalRetiros = totalRetirosGanancias + totalRetirosCapital;

    // 4. PATRIMONIO = CapitalTotal + ResultadoOperativo - Retiros
    // (sin clamp: si el resultado es negativo, el déficit reduce el patrimonio
    //  al consumir capital, igual que el dashboard).
    const patrimonio = roundMoney(
      capitalTotal + resultadoOperativo - totalRetiros,
    );

    // 5. Calcular ACTIVOS: Caja Actual + En Calle
    // Caja actual (canónica) = Σ sobre las sesiones ABIERTAS de
    // (montoInicial + ingresos - egresos). Las sesiones cerradas ya quedaron
    // incorporadas al montoInicial de la sesión siguiente (efectivo físico).
    const cajas = await this.prisma.cajaSesion.findMany({
      where: { empresaId, estado: 'ABIERTA' },
      select: { montoInicial: true, totalIngresos: true, totalEgresos: true },
    });
    const dineroEnCaja = roundMoney(
      cajas.reduce(
        (sum, c) =>
          sum +
          m(c.montoInicial ?? 0) +
          m(c.totalIngresos ?? 0) -
          m(c.totalEgresos ?? 0),
        0,
      ),
    );

    // En Calle (D1): saldo vivo desde cuotas no pagadas de préstamos
    // ACTIVO/ATRASADO (capital + interés + mora).
    const saldoVivo = await this.prisma.cuota.aggregate({
      where: {
        pagada: false,
        prestamo: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      },
      _sum: { capital: true, interes: true, mora: true },
    });
    const dineroEnCalle = Math.max(
      0,
      roundMoney(
        m(saldoVivo._sum.capital ?? 0) +
          m(saldoVivo._sum.interes ?? 0) +
          m(saldoVivo._sum.mora ?? 0),
      ),
    );

    // 6. Validar: Activos (Caja + Calle) == Patrimonio.
    // Sin "fondo general" de relleno: si no cuadra, es un descuadre real.
    const activos = roundMoney(dineroEnCaja + dineroEnCalle);
    const diferencia = roundMoney(activos - patrimonio);
    const cuadra = Math.abs(diferencia) < 0.01;

    return {
      capital: capitalTotal,
      gananciasNetas,
      resultadoOperativo,
      caja: dineroEnCaja,
      calle: dineroEnCalle,
      retiros: totalRetiros,
      patrimonio,
      activos,
      diferencia,
      cuadra,
      advertencia: !cuadra
        ? 'Descuadre contable detectado. Revisar movimientos financieros.'
        : null,
    };
  }

  // ─── CALCULAR CAPITAL DISPONIBLE (para nuevas cajas) ─────────────────────
  // Capital disponible = CapitalTotal - DineroEnCalle (lo que ya está prestado no puede reasignarse)
  async calcularCapitalDisponible(empresaId: string): Promise<number> {
    const capitalData = await this.getCapitalEmpresa(empresaId);
    const capitalTotal = capitalData.capitalTotal;

    // D1: dinero en calle = saldo vivo desde cuotas no pagadas de préstamos
    // ACTIVO/ATRASADO (capital + interés + mora).
    const saldoVivo = await this.prisma.cuota.aggregate({
      where: {
        pagada: false,
        prestamo: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      },
      _sum: { capital: true, interes: true, mora: true },
    });
    const dineroEnCalle = Math.max(
      0,
      roundMoney(
        m(saldoVivo._sum.capital ?? 0) +
          m(saldoVivo._sum.interes ?? 0) +
          m(saldoVivo._sum.mora ?? 0),
      ),
    );

    return Math.max(0, roundMoney(capitalTotal - dineroEnCalle));
  }

  // ─── CALCULAR DINERO EN CAJA ACTUAL ───────────────────────────────────────────────
  async calcularDineroEnCaja(empresaId: string): Promise<number> {
    const cajas = await this.prisma.cajaSesion.findMany({
      where: { empresaId, estado: 'ABIERTA' },
      select: { montoInicial: true, totalIngresos: true, totalEgresos: true },
    });
    // Misma fórmula que la métrica del día del dashboard: montoInicial de cada
    // caja abierta + ingresos acumulados - egresos acumulados.
    const dineroEnCaja = roundMoney(
      cajas.reduce(
        (sum, c) =>
          sum +
          m(c.montoInicial ?? 0) +
          m(c.totalIngresos ?? 0) -
          m(c.totalEgresos ?? 0),
        0,
      ),
    );
    return Math.max(0, dineroEnCaja);
  }

  // ─── CALCULAR DINERO EN CALLE (D1) ──────────────────────────────────────────────
  // Saldo vivo desde cuotas no pagadas (capital + interés + mora) de préstamos
  // ACTIVO/ATRASADO. Fuente única canónica usada por dashboard, rutas,
  // capital retirable y disponible.
  private async calcularCalle(empresaId: string): Promise<number> {
    const saldoVivo = await this.prisma.cuota.aggregate({
      where: {
        pagada: false,
        prestamo: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      },
      _sum: { capital: true, interes: true, mora: true },
    });
    return Math.max(
      0,
      roundMoney(
        m(saldoVivo._sum.capital ?? 0) +
          m(saldoVivo._sum.interes ?? 0) +
          m(saldoVivo._sum.mora ?? 0),
      ),
    );
  }
}
