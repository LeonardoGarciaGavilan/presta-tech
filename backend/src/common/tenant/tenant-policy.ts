// src/common/tenant/tenant-policy.ts
// Política defensiva de multi-tenancy (F6): para queries multi-fila sobre
// modelos de negocio CON columna empresaId, exige que el `where` incluya
// empresaId cuando hay un contexto de empresa activo.
//
// - LECTURAS (findMany/count): sin empresaId → WARN (no rompe reads válidos
//   por relación, p.ej. dashboard/prestamos por cliente).
// - ESCRITURAS (updateMany/deleteMany): sin empresaId → BLOQUEAR (riesgo de
//   actualizar/borrar datos de otras empresas).
// - SUPERADMIN y requests públicos → bypass total.
import type { TenantContexto } from './tenant-context';

/** Modelos con columna empresaId donde aplica defensa multi-fila. */
export const MODELOS_TENANT: ReadonlySet<string> = new Set([
  'Cliente',
  'Prestamo',
  'Gasto',
  'CajaSesion',
  'DesembolsoCaja',
  'Ruta',
  'Alerta',
  'Empleado',
  'AsistenciaEmpleado',
  'PagoSalario',
  'DescuentoEmpleado',
  'CapitalEmpresa',
  'InyeccionCapital',
  'RetiroGanancias',
  'MovimientoFinanciero',
  'Usuario',
]);

// Sin columna empresaId → se acotan por su padre (Cuota/Pago via prestamo,
// RutaCliente via ruta + assertRuta). Quedan fuera de la defensa directa.
export const MODELOS_SIN_EMPRESA_ID: ReadonlySet<string> = new Set([
  'Cuota',
  'Pago',
  'RutaCliente',
]);

// Usuario se EXCLUYE del bloqueo de escrituras: `limpiarTokenStale`
// (push-notifications) borra un pushToken globalmente (puede existir en varias
// empresas). Las escrituras masivas de Usuario del superadmin ya van scoped.
const MODELOS_ESCRITURA_OBLIGATORIA: ReadonlySet<string> = new Set(
  [...MODELOS_TENANT].filter((m) => m !== 'Usuario'),
);

const ESCRITURAS_MULTI = new Set(['updateMany', 'deleteMany']);
const LECTURAS_MULTI = new Set(['findMany', 'count']);

export type DecisionTenant =
  | { accion: 'permitir' }
  | { accion: 'advertir'; motivo: string }
  | { accion: 'bloquear'; motivo: string };

export function decidirPoliticaTenant(opts: {
  modelo: string;
  operacion: string;
  where?: unknown;
  contexto: TenantContexto | null;
}): DecisionTenant {
  const { modelo, operacion, where, contexto } = opts;

  if (!contexto) return { accion: 'permitir' };
  if (contexto.superAdmin) return { accion: 'permitir' };
  if (!contexto.empresaId) return { accion: 'permitir' };
  if (!MODELOS_TENANT.has(modelo)) return { accion: 'permitir' };
  if (MODELOS_SIN_EMPRESA_ID.has(modelo)) return { accion: 'permitir' };

  const tieneEmpresaId =
    !!where &&
    typeof where === 'object' &&
    (where as Record<string, unknown>).empresaId !== undefined;

  if (ESCRITURAS_MULTI.has(operacion)) {
    if (!MODELOS_ESCRITURA_OBLIGATORIA.has(modelo))
      return { accion: 'permitir' };
    if (!tieneEmpresaId) {
      return {
        accion: 'bloquear',
        motivo: `${modelo}.${operacion} sin empresaId en where (contexto empresa ${contexto.empresaId})`,
      };
    }
    return { accion: 'permitir' };
  }

  if (LECTURAS_MULTI.has(operacion)) {
    if (!tieneEmpresaId) {
      return {
        accion: 'advertir',
        motivo: `${modelo}.${operacion} sin empresaId en where (contexto empresa ${contexto.empresaId})`,
      };
    }
    return { accion: 'permitir' };
  }

  return { accion: 'permitir' };
}
