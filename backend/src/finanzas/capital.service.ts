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

    const capitalTotal = (capital?.capitalInicial ?? 0) + inyecciones.reduce((sum, i) => sum + i.monto, 0);

    return {
      capitalInicial: capital?.capitalInicial ?? 0,
      capitalTotal,
      totalInyecciones: inyecciones.reduce((sum, i) => sum + i.monto, 0),
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
      totalRetiros,
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

    const totalInteresCobrado = Math.round(
      ((totalesPagos._sum.interes ?? 0) + (totalesPagos._sum.mora ?? 0)) * 100
    ) / 100;

    const totalCapitalRecuperado = Math.round((totalesPagos._sum.capital ?? 0) * 100) / 100;
    const totalDesembolsado = Math.round((totalesDesembolsos._sum.monto ?? 0) * 100) / 100;
    const totalGastado = Math.round((totalesGastos._sum.monto ?? 0) * 100) / 100;
    const totalRetirado = Math.round((totalRetiros._sum.monto ?? 0) * 100) / 100;

    const gananciasAcumuladas = Math.round((totalInteresCobrado - totalRetirado) * 100) / 100;
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

    const dineroTotal = Math.round((capitalData.capitalTotal + gananciasAcumuladas) * 100) / 100;

    const metricas = this.calcularMetricas(
      capitalData.capitalTotal,
      gananciasAcumuladas,
      dineroEnCaja,
      totalInteresCobrado,
      interesEsperado._sum.interes ?? 0,
      movimientosMensuales,
      inicioMesActual,
    );

    const resumen = {
      totalCobrado: Math.round((totalesPagos._sum.montoTotal ?? 0) * 100) / 100,
      totalInteres: totalInteresCobrado,
      totalMora: Math.round((totalesPagos._sum.mora ?? 0) * 100) / 100,
      totalGastos: totalGastado,
      totalDesembolsos: totalDesembolsado,
      balanceNeto: Math.round((totalInteresCobrado - totalGastado - totalRetirado) * 100) / 100,
    };

    const dinero = {
      enCaja: dineroEnCaja,
      enCajaBase: montoInicialCajas,
      enCalle: dineroEnCalle,
      total: dineroTotal,
    };

    // Validar balance contable y agregar alerta si no cuadra
    const balance = await this.validarBalance(empresaId);
    const alertas = this.generarAlertas(metricas, resumen, dinero);

    if (!balance.cuadra) {
      alertas.unshift({
        tipo: 'CRITICAL',
        mensaje: `Descuadre contable detectado (RD$${balance.diferencia.toLocaleString()}). Revisar inmediatamente. Capital + Ganancias: RD$${balance.ladoIzquierdo.toLocaleString()} vs Activos (Caja + Calle): RD$${balance.ladoDerecho.toLocaleString()}`,
        codigo: 'DESCUADRE_CONTABLE',
        valor: balance.diferencia,
        umbral: 0,
      });
    }

    return {
      capital: {
        inicial: capitalData.capitalInicial,
        total: capitalData.capitalTotal,
        totalInyecciones: capitalData.totalInyecciones,
        tieneRegistro: capitalData.tieneCapitalRegistrado,
      },
      ganancias: {
        acumuladas: gananciasAcumuladas,
        disponibles: gananciasAcumuladas,
        totalInteresCobrado,
        totalRetiros: totalRetirado,
      },
      dinero,
      resumen,
      metricas,
      alertas,
      timestamp: new Date().toISOString(),
    };
  }

  private calcularMetricas(
    capitalTotal: number,
    gananciasAcumuladas: number,
    dineroEnCaja: number,
    totalInteresCobrado: number,
    interesEsperado: number,
    movimientosMensuales: { fecha: Date; interes: number; mora: number }[],
    inicioMesActual: Date,
  ): Metricas {
    const rentabilidad = capitalTotal > 0
      ? Math.round((gananciasAcumuladas / capitalTotal) * 10000) / 100
      : null;

    const eficienciaCobranza = interesEsperado > 0
      ? Math.round((totalInteresCobrado / interesEsperado) * 10000) / 100
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
    // Calcular capital total
    const capitalData = await this.getCapitalEmpresa(empresaId);
    const capitalTotal = capitalData.capitalTotal;

    // Calcular ganancias acumuladas (histórico)
    const [pagosGanancias, retirosGanancias, gastosQuery] = await Promise.all([
      this.prisma.pago.aggregate({
        where: { prestamo: { empresaId } },
        _sum: { interes: true, mora: true },
      }),
      this.prisma.retiroGanancias.aggregate({
        where: { empresaId },
        _sum: { monto: true },
      }),
      this.prisma.movimientoFinanciero.aggregate({
        where: {
          empresaId,
          tipo: { in: ['GASTO', 'GASTO_CAPITAL'] },
        },
        _sum: { monto: true },
      }),
    ]);
    const totalInteresCobrado = (pagosGanancias._sum.interes ?? 0) + (pagosGanancias._sum.mora ?? 0);
    const totalRetiros = retirosGanancias._sum.monto ?? 0;
    const totalGastos = gastosQuery._sum.monto ?? 0;
    const gananciasAcumuladas = Math.round(
      (totalInteresCobrado - totalGastos - totalRetiros) * 100
    ) / 100;

    // Calcular dinero en caja (desde MovimientoFinanciero)
    const efectivo = await this.prisma.movimientoFinanciero.aggregate({
      where: {
        empresaId,
        tipo: { in: ['PAGO_RECIBIDO', 'INYECCION_CAPITAL'] },
      },
      _sum: { monto: true },
    });
    const salidas = await this.prisma.movimientoFinanciero.aggregate({
      where: {
        empresaId,
        tipo: { in: ['DESEMBOLSO', 'GASTO', 'GASTO_CAPITAL', 'RETIRO_GANANCIAS'] },
      },
      _sum: { monto: true },
    });
    const dineroEnCaja = Math.max(0, Math.round(
      ((efectivo._sum.monto ?? 0) - (salidas._sum.monto ?? 0)) * 100
    ) / 100);

    // Calcular dinero en calle (préstamos activos)
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

    // Nueva fórmula contable
    const ladoIzquierdo = capitalTotal + gananciasAcumuladas;
    const ladoDerecho = dineroEnCaja + dineroEnCalle;
    const diferencia = Math.round((ladoIzquierdo - ladoDerecho) * 100) / 100;
    const cuadra = Math.abs(diferencia) < 5;

    return {
      capital: capitalTotal,
      ganancias: gananciasAcumuladas,
      caja: dineroEnCaja,
      calle: dineroEnCalle,
      ladoIzquierdo,
      ladoDerecho,
      diferencia,
      cuadra,
      advertencia: !cuadra
        ? 'Posible descuadre por datos históricos previos al rediseño. Revisar manualmente.'
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