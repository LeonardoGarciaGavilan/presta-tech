// frontend/src/utils/permisos.js
// Helpers de acceso client-side (espejo de backend/src/common/permisos).
// El backend es la única verdad: la UI solo oculta, nunca autoriza.
export const PERMISO_TODOS = "*";

/**
 * True si el usuario tiene el permiso efectivo (p.ej. "gastos:ver").
 * - Sin usuario -> false.
 * - SUPERADMIN -> bypass total (sus efectivos contienen "*").
 * - Si el usuario trae permisos vacíos/ausentes -> false.
 */
export function tienePermiso(user, permiso) {
  if (!user || !permiso) return false;
  const permisos = user.permisos ?? [];
  if (permisos.includes(PERMISO_TODOS)) return true;
  return permisos.includes(permiso);
}

/**
 * True si el módulo no está deshabilitado para la empresa.
 * SUPERADMIN -> bypass total.
 */
export function moduloHabilitado(user, modulo) {
  if (!user || !modulo) return false;
  if (user.rol === "SUPERADMIN") return true;
  const deshabilitados = user.modulosDeshabilitados ?? [];
  return !deshabilitados.includes(modulo);
}
