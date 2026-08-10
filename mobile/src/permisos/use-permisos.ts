import { useMemo } from 'react';

import { useAuthStore } from '@/store/auth.store';
import { puedeAcceder, type AccesoUsuario } from '@/permisos/permisos';

export interface UsePermisosResult {
  user: AccesoUsuario | null;
  permisos: string[];
  modulosDeshabilitados: string[];
  tienePermiso: (permiso: string) => boolean;
  moduloHabilitado: (modulo: string) => boolean;
}

export function usePermisos(): UsePermisosResult {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const permisos = user?.permisos ?? [];
    const modulosDeshabilitados = user?.modulosDeshabilitados ?? [];

    return {
      user,
      permisos,
      modulosDeshabilitados,
      tienePermiso: (permiso: string) =>
        puedeAcceder({ user, permiso }),
      moduloHabilitado: (modulo: string) =>
        puedeAcceder({ user, modulo }),
    };
  }, [user]);
}
