export const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; text: string; border: string }> = {
  SOLICITADO: { label: 'Solicitado', color: '#0369A1', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD', icon: 'time-outline' },
  EN_REVISION: { label: 'En Revisión', color: '#6D28D9', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE', icon: 'search-outline' },
  APROBADO: { label: 'Aprobado', color: '#047857', bg: '#D1FAE5', text: '#047857', border: '#A7F3D0', icon: 'checkmark-circle-outline' },
  RECHAZADO: { label: 'Rechazado', color: '#B91C1C', bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA', icon: 'close-circle-outline' },
  ACTIVO: { label: 'Activo', color: '#15803D', bg: '#D1FAE5', text: '#15803D', border: '#BBF7D0', icon: 'checkmark-circle' },
  ATRASADO: { label: 'Atrasado', color: '#DC2626', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', icon: 'alert-circle' },
  PAGADO: { label: 'Pagado', color: '#64748B', bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0', icon: 'checkmark-done-circle' },
  CANCELADO: { label: 'Cancelado', color: '#7E22CE', bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF', icon: 'ban-outline' },
};

export const ACCIONES_FLOW_CONFIG: Record<string, { titulo: string; desc: string; icon: string; color: string; pedirMotivo: boolean }> = {
  EN_REVISION: { titulo: 'Poner en Revisión', desc: 'El préstamo pasará a estado EN REVISIÓN.', icon: 'search-outline', color: '#6D28D9', pedirMotivo: false },
  APROBADO: { titulo: 'Aprobar Préstamo', desc: 'El préstamo quedará APROBADO y pendiente de desembolso.', icon: 'checkmark-circle-outline', color: '#047857', pedirMotivo: false },
  RECHAZADO: { titulo: 'Rechazar Préstamo', desc: 'El préstamo será RECHAZADO. Esta acción no se puede deshacer.', icon: 'close-circle-outline', color: '#B91C1C', pedirMotivo: true },
};
