import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';
import { getCurrentUser } from '@/api/auth.api';
import { waitForRefresh } from '@/api/refresh-manager';
import { clearSession } from '@/utils/session';
import { prefetchCritical } from '@/services/prefetch-manager';
import { hydrateFromDb } from '@/services/data-sync';
import { getCachedUser, setCachedUser } from '@/db/sync-meta-db';
import type { User } from '@/types/auth.types';

export function useAuthBootstrap(queryClient?: QueryClient) {
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
        const accessToken = await tokenStorage.getAccessToken();

        if (!refreshToken && !accessToken) {
          return;
        }

        let user: User | null = null;

        try {
          if (refreshToken) {
            const refreshSuccess = await waitForRefresh();
            if (refreshSuccess) {
              user = await getCurrentUser();
            } else {
              const stillHasAccess = await tokenStorage.getAccessToken();
              if (!stillHasAccess) return;
            }
          } else if (accessToken) {
            user = await getCurrentUser();
          }
        } catch {
          // API/network error — will try cache below
        }

        if (user) {
          setUser(user);
          await setCachedUser(user);

          if (queryClient) {
            await prefetchCritical(queryClient);
          }
        } else {
          const cachedUser = await getCachedUser();
          if (cachedUser) {
            setUser(cachedUser);

            if (queryClient) {
              hydrateFromDb(queryClient);
            }
          }
        }
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
        setHydrated();
      }
    }

    bootstrap();
  }, [setUser, setLoading, setHydrated, queryClient]);
}
