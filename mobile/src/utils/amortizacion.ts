import type {
  Cuota,
  FrecuenciaPago,
  Prestamo,
  RefinanciarPrestamoDto,
  RenovarPrestamoDto,
  TablaAmortizacion,
} from "@/types/prestamo.types";
import type { CuotaPreview } from "@/types/prestamo.types";

export const DIAS_FRECUENCIA: Record<FrecuenciaPago, number> = {
  DIARIO: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

// Parsea 'YYYY-MM-DD' como día de calendario LOCAL (new Date('YYYY-MM-DD')
// usa UTC medianoche y resta un día en zonas UTC-negativas).
const parseFechaISO = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

// Réplica de PrestamosService.siguienteFecha (date-fns addDays/addWeeks/
// addMonths). En MENSUAL se clampea al último día del mes cuando el día no
// existe en el mes destino (ej. 31 ene + 1 mes → 28 feb), igual que date-fns.
export function siguienteFecha(
  fecha: Date,
  frecuencia: FrecuenciaPago,
  numero: number,
): Date {
  const result = new Date(fecha);
  switch (frecuencia) {
    case "DIARIO":
      result.setDate(result.getDate() + numero);
      break;
    case "SEMANAL":
      result.setDate(result.getDate() + numero * 7);
      break;
    case "QUINCENAL":
      result.setDate(result.getDate() + numero * 15);
      break;
    case "MENSUAL":
    default: {
      const diaOriginal = result.getDate();
      result.setMonth(result.getMonth() + numero);
      if (result.getDate() !== diaOriginal) result.setDate(0);
      break;
    }
  }
  return result;
}

// Réplica exacta de PrestamosService.calcularAmortizacion (modo clásico):
// misma fórmula de cuota fija y mismos redondeos a 2 decimales.
export function calcularAmortizacionLocal(
  monto: number,
  tasaInteres: number,
  numeroCuotas: number,
  frecuenciaPago: FrecuenciaPago,
  fechaInicio?: string,
): TablaAmortizacion {
  const tasaMensual = tasaInteres / 100;
  const diasPeriodo = DIAS_FRECUENCIA[frecuenciaPago];
  const tasaPeriodo = tasaMensual * (diasPeriodo / 30);

  let cuotaFija: number;
  if (tasaPeriodo === 0) {
    cuotaFija = Math.round((monto / numeroCuotas) * 100) / 100;
  } else {
    const factor = Math.pow(1 + tasaPeriodo, numeroCuotas);
    cuotaFija =
      Math.round(((monto * (tasaPeriodo * factor)) / (factor - 1)) * 100) / 100;
  }

  const startDate = fechaInicio ? new Date(fechaInicio) : new Date();
  const cuotas: CuotaPreview[] = [];
  let saldo = monto;
  let totalIntereses = 0;

  for (let i = 1; i <= numeroCuotas; i++) {
    const interes = Math.round(saldo * tasaPeriodo * 100) / 100;
    const capital =
      i === numeroCuotas
        ? Math.round(saldo * 100) / 100
        : Math.round((cuotaFija - interes) * 100) / 100;
    const montoCuota = Math.round((capital + interes) * 100) / 100;
    const saldoRestante = Math.max(
      0,
      Math.round((saldo - capital) * 100) / 100,
    );

    cuotas.push({
      numero: i,
      monto: montoCuota,
      capital,
      interes,
      fechaVencimiento: siguienteFecha(startDate, frecuenciaPago, i)
        .toISOString()
        .split("T")[0],
      saldoRestante,
    });

    totalIntereses += interes;
    saldo = saldoRestante;
  }

  return {
    montoTotal: Math.round((monto + totalIntereses) * 100) / 100,
    totalIntereses: Math.round(totalIntereses * 100) / 100,
    cuotaInicial: cuotas[0]?.monto ?? 0,
    tasaPeriodo,
    cuotas,
  };
}

// Réplica del cálculo de fechaBase en refinanciar(): la fecha enviada es la
// PRÓXIMA cuota, así que la base retrocede un período usando DIAS_FRECUENCIA
// (addDays negativo, no resta de meses).
function restarUnPeriodo(fecha: Date, frecuencia: FrecuenciaPago): Date {
  const result = new Date(fecha);
  result.setDate(result.getDate() - DIAS_FRECUENCIA[frecuencia]);
  return result;
}

export interface PrestamoRefinanciadoLocal {
  prestamo: Prestamo;
  saldoRefinanciado: number;
}

/**
 * Réplica offline de PrestamosService.refinanciar(): recalcula saldo
 * (capital + mora de cuotas pendientes, interés excluido), genera la nueva
 * tabla y devuelve el préstamo actualizado para cache/SQLite.
 */
export function construirPrestamoRefinanciadoLocal(
  prestamo: Prestamo,
  dto: RefinanciarPrestamoDto,
  ahora: Date = new Date(),
): PrestamoRefinanciadoLocal {
  const cuotasActuales = prestamo.cuotas ?? [];
  const pendientes = cuotasActuales.filter((c) => !c.pagada);
  const capitalPendiente = pendientes.reduce((sum, c) => sum + c.capital, 0);
  const morasPendientes = pendientes.reduce((sum, c) => sum + (c.mora || 0), 0);
  const saldoRefinanciado =
    Math.round((capitalPendiente + morasPendientes) * 100) / 100;

  const frecuenciaFinal = dto.nuevaFrecuencia ?? prestamo.frecuenciaPago;

  const fechaBase = dto.nuevaFechaPago
    ? restarUnPeriodo(parseFechaISO(dto.nuevaFechaPago), frecuenciaFinal)
    : ahora;

  const tabla = calcularAmortizacionLocal(
    saldoRefinanciado,
    dto.nuevaTasa,
    dto.nuevasCuotas,
    frecuenciaFinal,
    fechaBase.toISOString(),
  );

  const ultimoNumeroPagado = cuotasActuales
    .filter((c) => c.pagada)
    .reduce((max, c) => Math.max(max, c.numero), 0);

  const stamp = ahora.getTime();
  const nuevasCuotas: Cuota[] = tabla.cuotas.map((c) => ({
    id: `refin_temp_${prestamo.id}_${ultimoNumeroPagado + c.numero}_${stamp}`,
    numero: ultimoNumeroPagado + c.numero,
    monto: c.monto,
    capital: c.capital,
    interes: c.interes,
    mora: 0,
    fechaVencimiento: c.fechaVencimiento,
    pagada: false,
    fechaPago: null,
    createdAt: ahora.toISOString(),
    prestamoId: prestamo.id,
  }));

  return {
    saldoRefinanciado,
    prestamo: {
      ...prestamo,
      tasaInteres: dto.nuevaTasa,
      frecuenciaPago: frecuenciaFinal,
      numeroCuotas: ultimoNumeroPagado + dto.nuevasCuotas,
      cuotaMensual: tabla.cuotaInicial,
      montoTotal: tabla.montoTotal,
      fechaVencimiento: siguienteFecha(
        fechaBase,
        frecuenciaFinal,
        dto.nuevasCuotas,
      ).toISOString(),
      estado: "ACTIVO",
      moraAcumulada: 0,
      refinanciado: true,
      vecesRefinanciado: (prestamo.vecesRefinanciado ?? 0) + 1,
      cuotas: [...cuotasActuales.filter((c) => c.pagada), ...nuevasCuotas],
      esOffline: true,
    },
  };
}

// ─── Renovación de préstamos ─────────────────────────────────────────────────

export interface ReglasRenovacion {
  /** config.incluirInteresEnRenovacion (default true = cobrar interés futuro). */
  incluirInteres?: boolean;
  /** config.porcentajeMaximoSaldoAplicado (default 100). */
  porcentajeMaximoSaldoAplicado?: number;
}

export interface LiquidacionRenovacionLocal {
  capital: number;
  interes: number;
  mora: number;
  /** total = saldo anterior aplicado al nuevo préstamo. */
  total: number;
}

export interface RenovacionCalculada {
  liquidacion: LiquidacionRenovacionLocal;
  desembolsoNeto: number;
  /** Tabla de amortización del préstamo nuevo sobre montoNuevo completo. */
  tablaNueva: TablaAmortizacion;
  nuevaCuota: number;
  /** Espejo de las validaciones del backend; null = renovación válida. */
  error: string | null;
}

/**
 * Réplica offline de PrestamosService.renovar() para el preview en vivo del
 * modal y la validación de reglas antes de llamar al servidor:
 * liquidación desglosada (capital siempre, interés si config, mora siempre),
 * validaciones de entrega cero / % máximo, y tabla nueva con la matemática
 * idéntica a calcularAmortizacion del backend.
 * NO replica reglas de quota ni fondos de caja (solo se validan en servidor).
 */
export function calcularRenovacionLocal(
  prestamo: Prestamo,
  dto: RenovarPrestamoDto,
  reglas: ReglasRenovacion = {},
  ahora: Date = new Date(),
): RenovacionCalculada {
  const incluirInteres = reglas.incluirInteres !== false;
  const pctMaximo = reglas.porcentajeMaximoSaldoAplicado ?? 100;

  const pendientes = (prestamo.cuotas ?? []).filter((c) => !c.pagada);
  const capital =
    Math.round(pendientes.reduce((s, c) => s + c.capital, 0) * 100) / 100;
  const interes = incluirInteres
    ? Math.round(pendientes.reduce((s, c) => s + (c.interes || 0), 0) * 100) /
      100
    : 0;
  const mora =
    Math.round(pendientes.reduce((s, c) => s + (c.mora || 0), 0) * 100) / 100;
  const saldoAplicado = Math.round((capital + interes + mora) * 100) / 100;

  const montoNuevo = Math.round(dto.montoNuevo * 100) / 100;
  const desembolsoNeto = Math.round((montoNuevo - saldoAplicado) * 100) / 100;

  let error: string | null = null;
  if (pendientes.length === 0) {
    error = "Este préstamo no tiene cuotas pendientes para renovar";
  } else if (montoNuevo <= saldoAplicado) {
    error = "El monto nuevo debe ser mayor al saldo anterior aplicado.";
  } else if (
    pctMaximo < 100 &&
    saldoAplicado > montoNuevo * (pctMaximo / 100)
  ) {
    error = `El saldo anterior aplicado excede el máximo permitido de ${pctMaximo}% sobre el monto nuevo.`;
  }

  const frecuenciaFinal: FrecuenciaPago =
    dto.frecuenciaPago ?? prestamo.frecuenciaPago;
  const tablaNueva = calcularAmortizacionLocal(
    montoNuevo,
    dto.tasaInteres,
    dto.numeroCuotas,
    frecuenciaFinal,
    ahora.toISOString(),
  );

  return {
    liquidacion: { capital, interes, mora, total: saldoAplicado },
    desembolsoNeto,
    tablaNueva,
    nuevaCuota: tablaNueva.cuotaInicial,
    error,
  };
}
