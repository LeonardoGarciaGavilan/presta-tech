//prestamosUtils.ts
// ─── Formatters ───────────────────────────────────────────────────────────────

export const formatCurrency = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(value ?? 0);

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
) => {
  const tasaMensual  = tasaInteres / 100;
  const diasPeriodo  = DIAS_FRECUENCIA[frecuenciaPago] ?? 30;
  const tasaPeriodo  = tasaMensual * (diasPeriodo / 30);
  const fechaInicio  = new Date();

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
      fechaVencimiento: siguienteFecha(fechaInicio, frecuenciaPago, i),
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