// Módulos del sistema (espejo de backend/src/common/permisos/permisos.constants.ts).
// El backend es la única verdad: la UI solo oculta, nunca autoriza.
export const MODULOS = [
  'DASHBOARD',
  'CLIENTES',
  'PRESTAMOS',
  'PAGOS',
  'CAJA',
  'RUTAS',
  'REPORTES',
  'GASTOS',
  'FINANZAS',
  'EMPLEADOS',
  'USUARIOS',
  'CONFIGURACION',
  'AUDITORIA',
  'ALERTAS',
  'SYNC',
] as const;

export type Modulo = (typeof MODULOS)[number];

export const PERMISO_TODOS = '*';

export interface AccesoUsuario {
  rol?: string | null;
  permisos?: string[];
  modulosDeshabilitados?: string[];
}

/**
 * Lógica pura de acceso client-side (testeable).
 * - Sin usuario → sin acceso.
 * - SUPERADMIN → bypass total (rol SUPERADMIN no debe existir en móvil: el
 *   servidor lo bloquea con X-App, esto es defensa en profundidad).
 * - `permiso` (p.ej. "clientes:crear") → se exige en permisos efectivos.
 * - `modulo` (p.ej. "CLIENTES") → se exige que no esté deshabilitado.
 */
export function puedeAcceder(opts: {
  user?: AccesoUsuario | null;
  permiso?: string;
  modulo?: string;
}): boolean {
  const { user, permiso, modulo } = opts;
  if (!user) return false;
  if (user.rol === 'SUPERADMIN') return true;

  const permisos = user.permisos ?? [];
  const deshabilitados = user.modulosDeshabilitados ?? [];

  if (modulo && deshabilitados.includes(modulo)) return false;
  if (permiso) {
    if (permisos.includes(PERMISO_TODOS)) return true;
    if (!permisos.includes(permiso)) return false;
  }
  return true;
}

// Módulo al que pertenece cada pantalla (para menús y guards de ruta).
export const MODULO_POR_PANTALLA: Record<string, Modulo | null> = {
  dashboard: 'DASHBOARD',
  clientes: 'CLIENTES',
  prestamos: 'PRESTAMOS',
  caja: 'CAJA',
  rutas: 'RUTAS',
  pagos: 'PAGOS',
  perfil: null,
  'admin/alertas': 'ALERTAS',
  'admin/analisis-rutas': 'RUTAS',
  'admin/auditoria': 'AUDITORIA',
  'admin/empleados': 'EMPLEADOS',
  'admin/estado-financiero': 'FINANZAS',
  'admin/gastos': 'GASTOS',
  'admin/usuarios': 'USUARIOS',
  'admin/permisos/[id]': 'USUARIOS',
  'admin/reportes': 'REPORTES',
  'admin/configuracion': 'CONFIGURACION',
};
