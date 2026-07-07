import { useEffect, useRef } from 'react';

import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';
import { getCurrentUser } from '@/api/auth.api';
import { waitForRefresh } from '@/api/refresh-manager';
import { clearSession } from '@/utils/session';

export function useAuthBootstrap() {
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    async function bootstrap() {
      setLoading(true);

      try {
        const refreshToken = await tokenStorage.getRefreshToken();

        if (!refreshToken) {
          return;
        }

        const success = await waitForRefresh();

        if (!success) {
          return;
        }

        const user = await getCurrentUser();
        setUser(user);
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
        setHydrated();
      }
    }

    bootstrap();
  }, [setUser, setLoading, setHydrated]);
}
