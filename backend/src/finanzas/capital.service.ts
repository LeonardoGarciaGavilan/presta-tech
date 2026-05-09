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
      throw new ForbiddenException('Solo el administrador puede realizar esta operación');
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

    if (metricas.rentabilidad !== null && metricas.rentabilidad < UMBRAL_RENTABILIDAD) {
      alertas.push({
        tipo: 'WARNING',
        mensaje: `La rentabilidad del negocio es baja (${metricas.rentabilidad}%). Considera aumentar el capital prestado.`,
        codigo: 'BAJA_RENTABILIDAD',
        valor: metricas.rentabilidad,
        umbral: UMBRAL_RENTABILIDAD,
      });
    }

    const ratioMora = resumen.totalCobrado > 0
      ? resumen.totalMora / resumen.totalCobrado
      : 0;

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
    const retirosCapital = await this.prisma.movimientoFinanciero.aggregate({
      where: { empresaId, tipo: 'RETIRO_CAPITAL' },
      _sum: { capital: true },
    });
    const totalRetirosCapital = Math.abs(retirosCapital._sum.capital ?? 0);

    const capitalInicial = capital?.capitalInicial ?? 0;
    const totalInyecciones = inyecciones.reduce((sum, i) => sum + i.monto, 0);
    const capitalTotal = capitalInicial + totalInyecciones - totalRetirosCapital;

    return {
      capitalInicial,
      capitalTotal,
      totalInyecciones,
      totalRetirosCapital,
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
          observaciones: dto.observaciones ?? `Capital inicial registrado el ${new Date().toLocaleDateString('es-DO')}`,
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
      throw new BadRequestException('El monto de la inyección debe ser mayor a 0');
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

    const totalGanado = (totalIntereses._sum.interes ?? 0) + (totalIntereses._sum.mora ?? 0);
    const totalRetirado = totalRetiros._sum.monto ?? 0;

    return Math.round((totalGanado - totalRetirado) * 100) / 100;
  }

  async retirarGanancias(dto: CreateRetiroDto, user: any) {
    this.assertAdmin(user);
    const { empresaId } = user;

    if (dto.monto <= 0) {
      throw new BadRequestException('El monto del retiro debe ser mayor a 0');
    }

    const gananciasDisponibles = await this.calcularGananciasDisponibles(empresaId);

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
  // Sin afectar la liquidez mínima operativa (RD$5,000)
  async calcularCapitalRetirable(empresaId: string): Promise<number> {
    const MINIMO_OPERATIVO = 5000;

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
    const gananciasNetas = Math.max(0, Math.round(
      ((ingresos._sum.interes ?? 0) + (ingresos._sum.mora ?? 0) - Math.abs(gastos._sum.interes ?? 0)) * 100
    ) / 100);

    // Calcular dinero en caja
    const cajas = await this.prisma.cajaSesion.findMany({
      where: { empresaId, estado: 'ABIERTA' },
      select: { montoInicial: true, totalIngresos: true, totalEgresos: true },
    });
    const dineroEnCaja = Math.round(
      cajas.reduce((sum, c) => sum + (c.montoInicial ?? 0) + (c.totalIngresos ?? 0) - (c.totalEgresos ?? 0), 0) * 100
    ) / 100;

    // Calcular dinero en calle
    const [prestamos, cobros] = await Promise.all([
      this.prisma.prestamo.aggregate({
        where: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
        _sum: { monto: true },
      }),
      this.prisma.pago.aggregate({
        where: { prestamo: { empresaId } },
        _sum: { capital: true },
      }),
    ]);
    const dineroEnCalle = Math.max(0, Math.round(
      ((prestamos._sum.monto ?? 0) - (cobros._sum.capital ?? 0)) * 100
    ) / 100);

    // Calcular patrimonio total
    const retiros = await this.prisma.retiroGanancias.aggregate({
      where: { empresaId },
      _sum: { monto: true },
    });
    const totalRetiros = retiros._sum.monto ?? 0;
    const patrimonioTotal = Math.round((capitalTotal + gananciasNetas - totalRetiros) * 100) / 100;

    // Capital retirable = Patrimonio - Ganancias - Caja - Calle
    const capitalRetirable = Math.max(0, Math.round(
      (patrimonioTotal - gananciasNetas - dineroEnCaja - dineroEnCalle - MINIMO_OPERATIVO) * 100
    ) / 100);

    return Math.max(0, capitalRetirable);
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
        'No puedes retirar capital mientras existan cajas operativas abiertas. Cierra todas las cajas primero.'
      );
    }

    // Validar capital retirable disponible
    const capitalRetirable = await this.calcularCapitalRetirable(empresaId);
    if (dto.monto > capitalRetirable) {
      throw new BadRequestException(
        `No hay suficiente capital disponible para retirar. Disponible: RD$${capitalRetirable.toLocaleString()}`
      );
    }

    // Validar liquidez mínima
    const MINIMO_OPERATIVO = 5000;
    if (dto.monto > capitalRetirable - MINIMO_OPERATIVO) {
      throw new BadRequestException(
        `No puedes retirar este monto porque compromete la liquidez operativa mínima de RD$${MINIMO_OPERATIVO.toLocaleString()}`
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
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const [
      capitalData,
      totalesPagos,
      totalesDesembolsos,
      totalesGastos,
      totalRetirosGananciasData,
      totalRetirosCapitalData,
      cajasAbiertas,
      interesEsperado,
      movimientosMensuales,
      pagosDelDia,
      desembolsosDelDia,
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
        where: { empresaId },
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
        _sum: { montoInicial: true },
      }),
      this.prisma.cuota.aggregate({
        where: {
          prestamo: { empresaId },
          fechaVencimiento: { lte: ahora },
        },
        _sum: { interes: true },
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
      this.prisma.pago.aggregate({
        where: {
          prestamo: { empresaId },
          metodo: 'EFECTIVO',
          createdAt: {
            gte: inicioDia,
            lte: finDia,
          },
        },
        _sum: {
          montoTotal: true,
        },
      }),
      this.prisma.desembolsoCaja.aggregate({
        where: {
          empresaId,
          createdAt: {
            gte: inicioDia,
            lte: finDia,
          },
        },
        _sum: {
          monto: true,
        },
      }),
    ]);

    const gananciasBrutas = Math.round(
      ((totalesPagos._sum.interes ?? 0) + (totalesPagos._sum.mora ?? 0)) * 100
    ) / 100;

    const gastosTotales = Math.round((totalesGastos._sum.monto ?? 0) * 100) / 100;
    const totalCapitalRecuperado = Math.round((totalesPagos._sum.capital ?? 0) * 100) / 100;
    const totalDesembolsado = Math.round((totalesDesembolsos._sum.monto ?? 0) * 100) / 100;
    const totalRetiradoGanancias = Math.round((totalRetirosGananciasData._sum.monto ?? 0) * 100) / 100;
    const totalRetirosCapital = Math.abs(totalRetirosCapitalData._sum.capital ?? 0);
    const totalRetirosCompleto = totalRetiradoGanancias + totalRetirosCapital;

    // Resultado operativo real
    const resultadoOperativo = gananciasBrutas - gastosTotales;

    // Si queda negativo, consume capital
    const excedenteQueConsumeCapital =
      resultadoOperativo < 0
        ? Math.abs(resultadoOperativo)
        : 0;

    // Nunca mostrar ganancias negativas
    const gananciasNetas =
      resultadoOperativo > 0
        ? resultadoOperativo
        : 0;

    // Capital ajustado
    const capitalAjustado =
      capitalData.capitalTotal - excedenteQueConsumeCapital;

    // Patrimonio real (incluye ambos tipos de retiros)
    const patrimonioTotal =
      capitalAjustado + gananciasNetas - totalRetirosCompleto;

    const dineroEnCalle = Math.max(0, Math.round((totalDesembolsado - totalCapitalRecuperado) * 100) / 100);
    const montoInicialCajas = Math.round((cajasAbiertas._sum.montoInicial ?? 0) * 100) / 100;

    // ⚠️ IMPORTANTE:
    // dineroEnCaja es MÉTRICA DEL DÍA (operativa)
    // Usa pagos y desembolsos filtrados por fecha (hoy)
    // NO usar datos históricos aquí
    const totalPagosHoy = pagosDelDia._sum?.montoTotal ?? 0;
    const totalDesembolsosHoy = desembolsosDelDia._sum?.monto ?? 0;

    const dineroEnCaja = Math.max(0, Math.round(
      (montoInicialCajas + totalPagosHoy - totalDesembolsosHoy) * 100
    ) / 100);

    const metricas = this.calcularMetricas(
      capitalAjustado,
      gananciasNetas,
      dineroEnCaja,
      gananciasBrutas,
      interesEsperado._sum.interes ?? 0,
      movimientosMensuales,
      inicioMesActual,
    );

    const resumen = {
      totalCobrado: Math.round((totalesPagos._sum.montoTotal ?? 0) * 100) / 100,
      totalInteres: gananciasBrutas,
      totalMora: Math.round((totalesPagos._sum.mora ?? 0) * 100) / 100,
      totalGastos: gastosTotales,
      totalDesembolsos: totalDesembolsado,
      balanceNeto: Math.round((gananciasNetas - totalRetirosCompleto) * 100) / 100,
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
        totalInteresCobrado: gananciasBrutas,
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
    movimientosMensuales: { fecha: Date; interes: number; mora: number }[],
    inicioMesActual: Date,
  ): Metricas {
    const rentabilidad = capitalAjustado > 0
      ? Math.round((gananciasNetas / capitalAjustado) * 10000) / 100
      : null;

    const eficienciaCobranza = interesEsperado > 0
      ? Math.round((gananciasBrutas / interesEsperado) * 10000) / 100
      : null;

    const dineroOcioso = Math.max(0, dineroEnCaja - MINIMO_OPERATIVO);

    const movimientosPorMes = this.agruparPorMes(movimientosMensuales);
    const mesActualKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const mesAnteriorKey = `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}`;

    const gananciasMesActual = movimientosPorMes[mesActualKey] ?? 0;
    const gananciasMesAnterior = movimientosPorMes[mesAnteriorKey] ?? 0;

    const crecimientoMensual = Math.round((gananciasMesActual - gananciasMesAnterior) * 100) / 100;

    return {
      rentabilidad,
      eficienciaCobranza,
      dineroOcioso,
      crecimientoMensual,
    };
  }

  private agruparPorMes(
    movimientos: { fecha: Date; interes: number; mora: number }[],
  ): Record<string, number> {
    // Note: This function calculates gross earnings (interes + mora) by month
    const agrupado: Record<string, number> = {};

    for (const mov of movimientos) {
      const fecha = new Date(mov.fecha);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      if (!agrupado[mesKey]) {
        agrupado[mesKey] = 0;
      }
      agrupado[mesKey] += (mov.interes ?? 0) + (mov.mora ?? 0);
    }

    for (const key in agrupado) {
      agrupado[key] = Math.round(agrupado[key] * 100) / 100;
    }

    return agrupado;
  }

  async getResumenRutas(empresaId: string) {
    const rutas = await this.prisma.ruta.findMany({
      where: { empresaId, activa: true },
      include: {
        usuario: { select: { id: true, nombre: true } },
        clientes: {
          include: {
            cliente: {
              include: {
                prestamos: {
                  where: {
                    estado: { in: ['ACTIVO', 'ATRASADO'] },
                  },
                  select: {
                    id: true,
                    monto: true,
                    saldoPendiente: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const rutaIds = rutas.map((r) => r.id);

    const prestamosPorRuta = await this.prisma.prestamo.findMany({
      where: {
        cliente: {
          rutaClientes: {
            some: {
              rutaId: { in: rutaIds },
            },
          },
        },
        empresaId,
        estado: { in: ['ACTIVO', 'ATRASADO'] },
      },
      select: {
        id: true,
        monto: true,
        saldoPendiente: true,
        clienteId: true,
        cliente: {
          select: {
            id: true,
            rutaClientes: {
              select: { rutaId: true },
            },
          },
        },
      },
    });

    const pagosPorRuta = await this.prisma.pago.findMany({
      where: {
        prestamo: {
          cliente: {
            rutaClientes: {
              some: { rutaId: { in: rutaIds } },
            },
          },
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

    const resumenRutas = rutas.map((ruta) => {
      const clientesIds = new Set(
        ruta.clientes.map((rc) => rc.clienteId)
      );

      const prestamosActivos = prestamosPorRuta.filter((p) =>
        p.cliente.rutaClientes.some((rc) => rc.rutaId === ruta.id)
      );

      const pagosRuta = pagosPorRuta.filter((p) =>
        p.prestamo.cliente.rutaClientes.some((rc) => rc.rutaId === ruta.id)
      );

      const totalCobrado = pagosRuta.reduce((sum, p) => sum + p.montoTotal, 0);
      const totalInteres = pagosRuta.reduce((sum, p) => sum + p.interes + p.mora, 0);
      const capitalRecuperado = pagosRuta.reduce((sum, p) => sum + p.capital, 0);
      const dineroEnCalleRuta = prestamosActivos.reduce((sum, p) => sum + p.saldoPendiente, 0);

      return {
        rutaId: ruta.id,
        nombre: ruta.nombre,
        cobrador: ruta.usuario.nombre,
        clientesActivos: clientesIds.size,
        totalCobrado: Math.round(totalCobrado * 100) / 100,
        totalInteres: Math.round(totalInteres * 100) / 100,
        capitalRecuperado: Math.round(capitalRecuperado * 100) / 100,
        dineroEnCalle: Math.round(dineroEnCalleRuta * 100) / 100,
        prestamosActivos: prestamosActivos.length,
      };
    });

    const totalGeneral = resumenRutas.reduce(
      (acc, r) => ({
        totalCobrado: acc.totalCobrado + r.totalCobrado,
        totalInteres: acc.totalInteres + r.totalInteres,
        capitalRecuperado: acc.capitalRecuperado + r.capitalRecuperado,
        dineroEnCalle: acc.dineroEnCalle + r.dineroEnCalle,
        clientesActivos: acc.clientesActivos + r.clientesActivos,
        prestamosActivos: acc.prestamosActivos + r.prestamosActivos,
      }),
      { totalCobrado: 0, totalInteres: 0, capitalRecuperado: 0, dineroEnCalle: 0, clientesActivos: 0, prestamosActivos: 0 }
    );

    return {
      rutas: resumenRutas.sort((a, b) => b.totalCobrado - a.totalCobrado),
      totales: {
        totalCobrado: Math.round(totalGeneral.totalCobrado * 100) / 100,
        totalInteres: Math.round(totalGeneral.totalInteres * 100) / 100,
        capitalRecuperado: Math.round(totalGeneral.capitalRecuperado * 100) / 100,
        dineroEnCalle: Math.round(totalGeneral.dineroEnCalle * 100) / 100,
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

    return this.prisma.movimientoFinanciero.findMany({
      where: { empresaId: user.empresaId },
      orderBy: { fecha: 'desc' },
      take: limite,
      include: { usuario: { select: { nombre: true } } },
    });
  }

  // ─── VALIDAR BALANCE CONTABLE ─────────────────────────────────────────
  // Verifica que: Capital + Ganancias = Caja + Calle
  async validarBalance(empresaId: string) {
    // 1. Calcular capital total
    const capitalData = await this.getCapitalEmpresa(empresaId);
    const capitalTotal = capitalData.capitalTotal;

    // 2. Calcular ganancias netas: (intereses + mora) - gastos operativos
    const [ingresos, gastosOperativos] = await Promise.all([
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'PAGO_RECIBIDO' },
        _sum: { interes: true, mora: true },
      }),
      this.prisma.movimientoFinanciero.aggregate({
        where: { empresaId, tipo: 'GASTO' },
        _sum: { interes: true },
      }),
    ]);
    const gananciasNetas = Math.round(
      ((ingresos._sum.interes ?? 0) + (ingresos._sum.mora ?? 0) - Math.abs(gastosOperativos._sum.interes ?? 0)) * 100
    ) / 100;

    // 3. Calcular retiros de ganancias
    const retirosGanancias = await this.prisma.retiroGanancias.aggregate({
      where: { empresaId },
      _sum: { monto: true },
    });
    const totalRetirosGanancias = Math.round((retirosGanancias._sum.monto ?? 0) * 100) / 100;

    const retirosCapital = await this.prisma.movimientoFinanciero.aggregate({
      where: { empresaId, tipo: 'RETIRO_CAPITAL' },
      _sum: { capital: true },
    });
    const totalRetirosCapital = Math.abs(retirosCapital._sum.capital ?? 0);

    const totalRetiros = totalRetirosGanancias + totalRetirosCapital;

    // 4. PATRIMONIO = CapitalTotal + GananciasNetas - Retiros
    const patrimonio = Math.round((capitalTotal + gananciasNetas - totalRetiros) * 100) / 100;

    // 5. Calcular ACTIVOS: Caja Operativa + Fondo General + En Calle
    // Caja Operativa = suma de cajas abiertas (montoInicial + ingresos - egresos)
    const cajasAbiertas = await this.prisma.cajaSesion.findMany({
      where: { empresaId, estado: 'ABIERTA' },
      select: { montoInicial: true, totalIngresos: true, totalEgresos: true },
    });
    const dineroEnCaja = Math.round(
      cajasAbiertas.reduce((sum, c) => sum + (c.montoInicial ?? 0) + (c.totalIngresos ?? 0) - (c.totalEgresos ?? 0), 0) * 100
    ) / 100;

    // En Calle
    const prestamos = await this.prisma.prestamo.aggregate({
      where: { empresaId, estado: { in: ['ACTIVO', 'ATRASADO'] } },
      _sum: { monto: true },
    });
    const cobros = await this.prisma.pago.aggregate({
      where: { prestamo: { empresaId } },
      _sum: { capital: true },
    });
    const dineroEnCalle = Math.max(0, Math.round(
      ((prestamos._sum.monto ?? 0) - (cobros._sum.capital ?? 0)) * 100
    ) / 100);

    // Fondo General = Patrimonio - Caja Operativa - En Calle
    const fondoGeneral = Math.max(0, Math.round((patrimonio - dineroEnCaja - dineroEnCalle) * 100) / 100);

    // 6. Validar: Activos (Caja + Fondo + Calle) == Patrimonio
    const activos = Math.round((dineroEnCaja + fondoGeneral + dineroEnCalle) * 100) / 100;
    const diferencia = Math.round((activos - patrimonio) * 100) / 100;
    const cuadra = Math.abs(diferencia) < 1;

    return {
      capital: capitalTotal,
      gananciasNetas,
      caja: dineroEnCaja,
      fondoGeneral,
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

    // Calcular dinero en calle
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
    const dineroEnCalle = Math.max(0, Math.round(
      ((prestamos._sum.monto ?? 0) - (cobros._sum.capital ?? 0)) * 100
    ) / 100);

    return Math.max(0, Math.round((capitalTotal - dineroEnCalle) * 100) / 100);
  }

  // ─── CALCULAR DINERO EN CAJA ACTUAL ───────────────────────────────────────────────
  async calcularDineroEnCaja(empresaId: string): Promise<number> {
    const cajas = await this.prisma.cajaSesion.groupBy({
      by: ['estado'],
      where: { empresaId, estado: 'ABIERTA' },
      _sum: { montoInicial: true },
    });
    const dineroEnCaja = Math.round((cajas[0]?._sum?.montoInicial ?? 0) * 100) / 100;
    return dineroEnCaja;
  }
}