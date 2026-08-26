// reporteConstants.js — Constantes compartidas entre componentes de reportes

export const ESTADO_COLOR = {
  ACTIVO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ATRASADO: "bg-red-100 text-red-700 border-red-200",
  PAGADO: "bg-blue-100 text-blue-700 border-blue-200",
  CANCELADO: "bg-gray-100 text-gray-500 border-gray-200",
};

export const METODO_LABEL = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CHEQUE: "Cheque",
};

export const METODO_COLOR = {
  EFECTIVO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TRANSFERENCIA: "bg-blue-100 text-blue-700 border-blue-200",
  TARJETA: "bg-violet-100 text-violet-700 border-violet-200",
  CHEQUE: "bg-amber-100 text-amber-700 border-amber-200",
};

export const FRECUENCIA_LABEL = {
  DIARIO: "Diario",
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
};

export const TABS = [
  { id: "cobros", label: "Cobros", labelFull: "Cobros por período", icon: "💰" },
  { id: "cartera", label: "Cartera", labelFull: "Cartera vencida", icon: "⚠️" },
  { id: "estado", label: "Estado", labelFull: "Estado general", icon: "📊" },
  { id: "cliente", label: "Cliente", labelFull: "Historial por cliente", icon: "👤" },
  { id: "cajas", label: "Cajas", labelFull: "Reporte de cajas", icon: "🗃️" },
  { id: "flujo", label: "Flujo", labelFull: "Flujo de caja", icon: "📈" },
  { id: "cobrador", label: "Cobrador", labelFull: "Desempeño por cobrador", icon: "🧑‍💼" },
  { id: "proyeccion", label: "Proyección", labelFull: "Proyección de cuotas", icon: "📅" },
];
