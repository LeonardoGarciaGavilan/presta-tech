export interface Auditoria {
  id: string;
  accion: string;
  descripcion?: string;
  createdAt: string;
  empresaId?: string;
  datosAnteriores?: Record<string, unknown>;
  datosNuevos?: Record<string, unknown>;
  ip?: string;
  monto?: number;
  nivel?: string;
  referenciaId?: string;
  referenciaTipo?: string;
  tipo: string;
  userAgent?: string;
  usuarioId?: string;
  usuario?: { nombre: string; email: string };
  empresa?: { nombre: string };
}

export interface AuditoriaFilters {
  empresaId?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
}
