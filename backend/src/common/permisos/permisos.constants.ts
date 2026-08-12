// src/common/permisos/permisos.constants.ts
// Catálogo de módulos y permisos del sistema.
// - MODULOS: nivel empresa (Superadmin habilita/deshabilita módulos enteros).
// - PERMISOS: nivel usuario (modulo:accion), gestionados por el ADMIN.
// - Los sets por rol son la BASE; se combinan con permisos/permisosNegados del usuario.

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

export const PERMISOS = [
  'dashboard:ver',

  'clientes:ver',
  'clientes:crear',
  'clientes:editar',
  'clientes:desactivar',

  'prestamos:ver',
  'prestamos:crear',
  'prestamos:editar',
  'prestamos:revisar',
  'prestamos:aprobar',
  'prestamos:desembolsar',
  'prestamos:refinanciar',
  'prestamos:cancelar',

  'pagos:ver',
  'pagos:registrar',

  'caja:ver',
  'caja:abrir',
  'caja:cerrar',
  'caja:ajuste',

  'rutas:ver',
  'rutas:crear',
  'rutas:asignar',
  'rutas:eliminar',
  'rutas:marcarVisita',

  'reportes:exportar',

  'gastos:ver',
  'gastos:crear',
  'gastos:editar',
  'gastos:eliminar',

  'finanzas:ver',
  'finanzas:inyeccionCapital',
  'finanzas:retiroGanancias',

  'empleados:ver',
  'empleados:gestionar',
  'empleados:asistencia',
  'empleados:pagosSalario',

  'usuarios:ver',
  'usuarios:gestionar',
  'usuarios:resetPassword',

  'configuracion:ver',
  'configuracion:editar',

  'auditoria:ver',

  'alertas:ver',
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const PERMISO_TODOS = '*';

// ─── Set base por rol ────────────────────────────────────────────────────────
// SUPERADMIN no pasa por guards de negocio (bloqueado en F2); es bypass total.

export const PERMISOS_ADMIN: string[] = [...PERMISOS];

// Acceso actual de EMPLEADO: refleja exactamente lo que un EMPLEADO puede hacer
// HOY en los controllers. Los permisos retirados del catálogo (pagos:revertir,
// reportes:ver) se quitaron también de aquí por no tener endpoint asociado.
export const PERMISOS_EMPLEADO_DEFAULT: string[] = [
  'dashboard:ver',
  'clientes:ver',
  'clientes:crear',
  'clientes:editar',
  'prestamos:ver',
  'prestamos:crear',
  'prestamos:editar',
  'prestamos:desembolsar',
  'prestamos:refinanciar',
  'pagos:ver',
  'pagos:registrar',
  'caja:ver',
  'caja:abrir',
  'caja:cerrar',
  'rutas:ver',
  'rutas:marcarVisita',
  'configuracion:ver',
  'alertas:ver',
];

export function permisosBasePorRol(rol: string): string[] {
  switch (rol) {
    case 'SUPERADMIN':
      return [PERMISO_TODOS];
    case 'ADMIN':
      return [...PERMISOS_ADMIN];
    case 'EMPLEADO':
      return [...PERMISOS_EMPLEADO_DEFAULT];
    default:
      return [];
  }
}

export function moduloDePermiso(permiso: string): string | null {
  const idx = permiso.indexOf(':');
  return idx > 0 ? permiso.slice(0, idx) : null;
}
