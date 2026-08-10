import type { ReactNode } from 'react';

import { usePermisos } from '@/permisos/use-permisos';
import SinAcceso from '@/components/permisos/sin-acceso';

interface PermisoGateProps {
  modulo?: string;
  permiso?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Controla el acceso a una sección/acción en la UI.
 * - `modulo`  → módulo deshabilitado por la empresa (p.ej. 'GASTOS').
 * - `permiso` → permiso efectivo requerido (p.ej. 'clientes:crear').
 * Si no hay acceso muestra `fallback` (por defecto <SinAcceso />).
 * El backend sigue siendo la autoridad real: esto solo oculta.
 */
export function PermisoGate({
  modulo,
  permiso,
  children,
  fallback,
}: PermisoGateProps) {
  const { moduloHabilitado, tienePermiso } = usePermisos();

  if (modulo && !moduloHabilitado(modulo)) {
    return (
      <>
        {fallback ?? (
          <SinAcceso
            icon="alert-circle-outline"
            title="Módulo deshabilitado"
            subtitle="Este módulo está disponible para tu empresa, pero actualmente se encuentra deshabilitado. Contacta al administrador de tu empresa."
          />
        )}
      </>
    );
  }

  if (permiso && !tienePermiso(permiso)) {
    return <>{fallback ?? <SinAcceso />}</>;
  }

  return <>{children}</>;
}
