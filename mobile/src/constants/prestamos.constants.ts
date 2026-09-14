export const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; text: string; border: string }> = {
  SOLICITADO: { label: 'Solicitado', color: '#0369A1', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD', icon: 'time-outline' },
  EN_REVISION: { label: 'En Revisión', color: '#6D28D9', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE', icon: 'search-outline' },
  APROBADO: { label: 'Aprobado', color: '#047857', bg: '#D1FAE5', text: '#047857', border: '#A7F3D0', icon: 'checkmark-circle-outline' },
  RECHAZADO: { label: 'Rechazado', color: '#B91C1C', bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA', icon: 'close-circle-outline' },
  ACTIVO: { label: 'Activo', color: '#166534', bg: '#D1FAE5', text: '#166534', border: '#BBF7D0', icon: 'checkmark-circle' },
  ATRASADO: { label: 'Atrasado', color: '#B91C1C', bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA', icon: 'alert-circle' },
  PAGADO: { label: 'Pagado', color: '#4B5563', bg: '#F1F5F9', text: '#4B5563', border: '#E2E8F0', icon: 'checkmark-done-circle' },
  CANCELADO: { label: 'Cancelado', color: '#7E22CE', bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF', icon: 'ban-outline' },
  RENOVADO: { label: 'Renovado', color: '#0F766E', bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4', icon: 'refresh-circle' },
};

export const ACCIONES_FLOW_CONFIG: Record<string, { titulo: string; desc: string; icon: string; color: string; pedirMotivo: boolean }> = {
  EN_REVISION: { titulo: 'Poner en Revisión', desc: 'El préstamo pasará a estado EN REVISIÓN.', icon: 'search-outline', color: '#6D28D9', pedirMotivo: false },
  APROBADO: { titulo: 'Aprobar Préstamo', desc: 'El préstamo quedará APROBADO y pendiente de desembolso.', icon: 'checkmark-circle-outline', color: '#047857', pedirMotivo: false },
  RECHAZADO: { titulo: 'Rechazar Préstamo', desc: 'El préstamo será RECHAZADO. Esta acción no se puede deshacer.', icon: 'close-circle-outline', color: '#B91C1C', pedirMotivo: true },
  CANCELADO: { titulo: 'Cancelar Préstamo', desc: 'El préstamo quedará CANCELADO y dejará de cobrarse. Debes indicar el motivo. Esta acción no se puede deshacer.', icon: 'ban-outline', color: '#B91C1C', pedirMotivo: true },
};

export const FREQ_LABEL: Record<string, string> = {
  DIARIO: 'diario',
  SEMANAL: 'semanal',
  QUINCENAL: 'quincenal',
  MENSUAL: 'mensual',
};

export const DURACION_LABEL: Record<string, string> = {
  DIARIO: 'días',
  SEMANAL: 'semanas',
  QUINCENAL: 'quincenas',
  MENSUAL: 'meses',
};
