// frontend/src/utils/rutaPermisos.js
// Mapa único ruta → permiso efectivo. Fuente de verdad para proteger rutas del
// Router y ocultar items del sidebar. El backend sigue siendo la autoridad real.
import { tienePermiso } from "./permisos";

// Orden importa: las rutas más específicas primero (p. ej. /prestamos/nuevo
// antes de /prestamos).
export const RUTA_PERMISOS = [
  { path: "/prestamos/nuevo", permiso: "prestamos:crear" },
  { path: "/usuarios/:id/permisos", permiso: "usuarios:gestionar" },
  { path: "/dashboard", permiso: "dashboard:ver" },
  { path: "/clientes", permiso: "clientes:ver" },
  { path: "/prestamos", permiso: "prestamos:ver" },
  { path: "/pagos", permiso: "pagos:ver" },
  { path: "/caja", permiso: "caja:ver" },
  { path: "/rutas", permiso: "rutas:ver" },
  { path: "/finanzas", permiso: "finanzas:ver" },
  { path: "/control-cajas", permiso: "caja:ajuste" },
  { path: "/gastos", permiso: "gastos:ver" },
  { path: "/reportes", permiso: "reportes:exportar" },
  { path: "/analisis-rutas", permiso: "finanzas:ver" },
  { path: "/usuarios", permiso: "usuarios:ver" },
  { path: "/alertas", permiso: "alertas:ver" },
  { path: "/empleados", permiso: "empleados:ver" },
  { path: "/auditoria", permiso: "auditoria:ver" },
  { path: "/configuracion", permiso: "configuracion:ver" },
];

const normalize = (path) => {
  const escaped = String(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/:[^/]+/g, "[^/]+") + "$");
};

/** Permiso requerido para una ruta (undefined = sin permiso, solo autenticación). */
export function permisoDeRuta(path) {
  for (const { path: p, permiso } of RUTA_PERMISOS) {
    if (normalize(p).test(path)) return permiso;
  }
  return undefined;
}

/** True si el usuario puede ver la ruta según su permiso efectivo. */
export function puedeVerRuta(user, path) {
  const permiso = permisoDeRuta(path);
  return !permiso || tienePermiso(user, permiso);
}
