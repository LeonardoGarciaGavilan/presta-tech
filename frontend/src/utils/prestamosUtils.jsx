//prestamosUtils.ts
// ─── Formatters ───────────────────────────────────────────────────────────────

export const formatCurrency = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(value ?? 0);

export const formatThousands = (value) => {
  if (!value && value !== 0) return '';
  const str = String(value).replace(/,/g, '');
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

export const formatDate = (date) => {
  if (!date) return "—";
  // Si es un string tipo "2026-03-01" (solo fecha, 10 chars), añadir T00:00:00
  // para que JS lo interprete en hora local y no UTC (evita el shift de -4h en RD)
  const d = typeof date === "string" && date.length === 10
    ? new Date(`${date}T00:00:00`)
    : new Date(date);
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

export const formatCedula = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
};

// ─── Frecuencia de pago ───────────────────────────────────────────────────────

export const FRECUENCIA_OPTIONS = [
  { value: "DIARIO",    label: "Diario" },
  { value: "SEMANAL",   label: "Semanal" },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "MENSUAL",   label: "Mensual" },
];

export const FRECUENCIA_LABEL = {
  DIARIO:    "Diario",
  SEMANAL:   "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL:   "Mensual",
};

export const FRECUENCIA_TASA_LABEL = {
  DIARIO:    "diaria",
  SEMANAL:   "semanal",
  QUINCENAL: "quincenal",
  MENSUAL:   "mensual",
};

export const CONFIG_FRECUENCIAS = {
  DIARIO: {
    min: 5,
    max: 90,
    sugeridas: [10, 15, 20, 30],
    descripcion: "Cobro diario para préstamos pequeños y de corto plazo.",
  },
  SEMANAL: {
    min: 4,
    max: 52,
    sugeridas: [8, 12, 16, 20, 24],
    descripcion: "Cobro cada 7 días. Ideal para préstamos informales.",
  },
  QUINCENAL: {
    min: 2,
    max: 24,
    sugeridas: [2, 4, 6, 8, 10, 12],
    descripcion: "Cobro cada 15 días. Ideal para empleados.",
  },
  MENSUAL: {
    min: 1,
    max: 60,
    sugeridas: [3, 6, 9, 12, 18, 24],
    descripcion: "Cobro mensual para préstamos grandes.",
  },
};

// Días entre cuotas según frecuencia
const DIAS_FRECUENCIA = {
  DIARIO:    1,
  SEMANAL:   7,
  QUINCENAL: 15,
  MENSUAL:   30,
};

// ─── Estado badge config ──────────────────────────────────────────────────────

export const ESTADO_CONFIG = {
  SOLICITADO: {
    label: "Solicitado",
    classes: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
  },
  EN_REVISION: {
    label: "En Revisión",
    classes: "bg-purple-100 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  APROBADO: {
    label: "Aprobado",
    classes: "bg-sky-100 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
  RECHAZADO: {
    label: "Rechazado",
    classes: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  ACTIVO: {
    label: "Activo",
    classes: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  ATRASADO: {
    label: "Atrasado",
    classes: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  PAGADO: {
    label: "Pagado",
    classes: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  CANCELADO: {
    label: "Cancelado",
    classes: "bg-gray-100 text-gray-500 border-gray-200",
    dot: "bg-gray-400",
  },
};

export const EstadoBadge = ({ estado }) => {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado || "Desconocido", classes: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const siguienteFecha = (fecha, frecuencia, numero) => {
  const d = new Date(fecha);
  switch (frecuencia) {
    case "DIARIO":    d.setDate(d.getDate() + numero);        break;
    case "SEMANAL":   d.setDate(d.getDate() + numero * 7);    break;
    case "QUINCENAL": d.setDate(d.getDate() + numero * 15);   break;
    case "MENSUAL":
    default:          d.setMonth(d.getMonth() + numero);      break;
  }
  return d;
};

// ─── Cálculo de amortización — CUOTA FIJA (PMT) ──────────────────────────────
// tasaInteres: tasa mensual en % (ej: 5 = 5% mensual)
// La tasa se convierte al período según la frecuencia (proporcional)
// Cuota fija = monto × (i / (1 - (1+i)^-n))  donde i = tasa del período

export const calcularAmortizacion = (
  monto,
  tasaInteres,          // % mensual (ej: 5)
  numeroCuotas,
  frecuenciaPago = "MENSUAL",
  fechaInicio,
) => {
  const tasaMensual  = tasaInteres / 100;
  const diasPeriodo  = DIAS_FRECUENCIA[frecuenciaPago] ?? 30;
  const tasaPeriodo  = tasaMensual * (diasPeriodo / 30);
  const fechaBase    = fechaInicio
    ? (
        typeof fechaInicio === "string" && fechaInicio.length === 10
          ? new Date(`${fechaInicio}T00:00:00`)
          : new Date(fechaInicio)
      )
    : new Date();

  // Cuota fija PMT
  let cuotaFija;
  if (tasaPeriodo === 0) {
    cuotaFija = Math.round((monto / numeroCuotas) * 100) / 100;
  } else {
    const factor = Math.pow(1 + tasaPeriodo, numeroCuotas);
    cuotaFija = Math.round((monto * (tasaPeriodo * factor) / (factor - 1)) * 100) / 100;
  }

  let saldo = monto;
  let totalIntereses = 0;
  const cuotas = [];

  for (let i = 1; i <= numeroCuotas; i++) {
    const interes    = Math.round(saldo * tasaPeriodo * 100) / 100;
    const capital    = i === numeroCuotas
      ? Math.round(saldo * 100) / 100
      : Math.round((cuotaFija - interes) * 100) / 100;
    const montoCuota = Math.round((capital + interes) * 100) / 100;

    cuotas.push({
      numero: i,
      fechaVencimiento: siguienteFecha(fechaBase, frecuenciaPago, i),
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
    cuotas,
    totalIntereses: totalInteresesRedondeado,
    montoTotal: Math.round((monto + totalInteresesRedondeado) * 100) / 100,
    cuotaInicial: cuotas[0]?.monto ?? 0,
    cuotaFinal:   cuotas[cuotas.length - 1]?.monto ?? 0,
  };
};

// ─── Cálculo de cuotas para modo Rápido Informal ─────────────────────────────
// NO usa PMT. Calcula cuotas fijas enteras con última cuota ajustada.

export const calcularCuotasRapidas = (
  monto,
  totalCobrar,
  cuotaFija,
  numeroCuotas,
  frecuenciaPago = "SEMANAL",
  fechaInicio,
) => {
  const fechaBase = fechaInicio
    ? (
        typeof fechaInicio === "string" && fechaInicio.length === 10
          ? new Date(`${fechaInicio}T00:00:00`)
          : new Date(fechaInicio)
      )
    : new Date();

  if (totalCobrar < monto) {
    throw new Error("El total a cobrar no puede ser menor al monto prestado.");
  }

  const ultimaCuota = Math.round((totalCobrar - cuotaFija * (numeroCuotas - 1)) * 100) / 100;
  const gananciaTotal = Math.round((totalCobrar - monto) * 100) / 100;

  if (ultimaCuota <= 0) {
    throw new Error("La última cuota sería menor o igual a cero. Reduce la ganancia o aumenta las cuotas.");
  }

  const gananciaPorCuota = numeroCuotas > 0
    ? Math.round((gananciaTotal / numeroCuotas) * 100) / 100
    : 0;

  let saldo = monto;
  let totalIntereses = 0;
  const cuotas = [];

  for (let i = 1; i <= numeroCuotas; i++) {
    const montoCuota = i === numeroCuotas ? ultimaCuota : cuotaFija;
    const interes = i === numeroCuotas
      ? Math.round((gananciaTotal - totalIntereses) * 100) / 100
      : gananciaPorCuota;
    const capital = Math.max(0, Math.round((montoCuota - interes) * 100) / 100);

    cuotas.push({
      numero: i,
      fechaVencimiento: siguienteFecha(fechaBase, frecuenciaPago, i),
      capital,
      interes,
      monto: Math.round(montoCuota * 100) / 100,
      saldoRestante: Math.max(0, Math.round((saldo - capital) * 100) / 100),
    });

    totalIntereses += interes;
    saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100);
  }

  return {
    cuotas,
    totalIntereses: Math.round(gananciaTotal * 100) / 100,
    montoTotal: Math.round(totalCobrar * 100) / 100,
    cuotaInicial: cuotas[0]?.monto ?? 0,
    cuotaFinal: cuotas[cuotas.length - 1]?.monto ?? 0,
  };
};

// ─── Solver de tasa equivalente (bisección) ──────────────────────────────────
// Dado monto, pagoDeseado, cuotas y frecuencia, encuentra la tasa mensual %
// que hace que el PMT del sistema actual produzca ≈ pagoDeseado.
// Retorna null si no es posible (pago menor al mínimo).

export const calcularTasaDesdePago = (
  monto,
  pagoDeseado,
  numeroCuotas,
  frecuenciaPago = "SEMANAL",
) => {
  const diasPeriodo = DIAS_FRECUENCIA[frecuenciaPago] ?? 30;
  const pagoMinimo = monto / numeroCuotas;

  if (pagoDeseado < pagoMinimo - 0.0001) return null;

  if (Math.abs(pagoDeseado - pagoMinimo) < 0.0001) return 0;

  if (numeroCuotas === 1) {
    const tasaPeriodo = pagoDeseado / monto - 1;
    if (tasaPeriodo <= 0) return 0;
    return Math.round(tasaPeriodo * (30 / diasPeriodo) * 100 * 10000) / 10000;
  }

  const calcularPMT = (tasaPeriodo) => {
    if (tasaPeriodo < 1e-12) return monto / numeroCuotas;
    const factor = Math.pow(1 + tasaPeriodo, numeroCuotas);
    return monto * (tasaPeriodo * factor) / (factor - 1);
  };

  let low = 1e-10;
  let high = 0.5;

  let pmtHigh = calcularPMT(high);
  while (pmtHigh < pagoDeseado && high < 10) {
    high *= 2;
    pmtHigh = calcularPMT(high);
  }

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const pmtMid = calcularPMT(mid);

    if (Math.abs(pmtMid - pagoDeseado) < 0.001) {
      const tasaMensual = mid * (30 / diasPeriodo);
      return Math.round(tasaMensual * 100 * 10000) / 10000;
    }

    if (pmtMid < pagoDeseado) low = mid;
    else high = mid;
  }

  const tasaPeriodo = (low + high) / 2;
  const tasaMensual = tasaPeriodo * (30 / diasPeriodo);
  return Math.round(tasaMensual * 100 * 10000) / 10000;
};