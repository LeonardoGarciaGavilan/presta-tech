import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '@/store/auth.store';
import { getCurrentUser } from '@/api/auth.api';
import { setCachedUser } from '@/db/sync-meta-db';
import { useToast } from '@/components/ui/toast';

/**
 * Detecta cambios de `authVersion` (permisos/modulos editados en el backend)
 * re-consultando `/auth/me` al volver al primer plano y al montar.
 * Si la versión cambió, actualiza el store y el usuario cacheado y avisa.
 * El backend sigue siendo la autoridad real: esto solo refresca la UI.
 */
export function useAuthVersionSync() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { showToast } = useToast();

  const authVersionRef = useRef<number | undefined>(user?.authVersion);

  useEffect(() => {
    authVersionRef.current = user?.authVersion;
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const fresh = await getCurrentUser();
        if (cancelled || !fresh) return;

        const previous = authVersionRef.current;
        if (
          previous !== undefined &&
          fresh.authVersion !== undefined &&
          fresh.authVersion !== previous
        ) {
          setUser(fresh);
          await setCachedUser(fresh);
          authVersionRef.current = fresh.authVersion;
          showToast('Tus permisos fueron actualizados', 'info');
        }
      } catch {
        // Offline/error — se reintentará en el próximo primer plano.
      }
    }

    check();

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          check();
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [setUser, showToast]);
}
