import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';
import { getCurrentUser } from '@/api/auth.api';
import { waitForRefresh } from '@/api/refresh-manager';
import { clearSession } from '@/utils/session';
import { prefetchCritical } from '@/services/prefetch-manager';
import { hydrateFromDb } from '@/services/data-sync';
import { getNetworkStatus } from '@/hooks/use-network-status';

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
        const network = getNetworkStatus();

        if (!network.isOnline) {
          const accessToken = await tokenStorage.getAccessToken();
          if (accessToken) {
            try {
              const user = await getCurrentUser();
              setUser(user);
            } catch {
              // Token expired offline — keep last session, don't clearSession()
            }
          } else {
            return;
          }
        } else {
          if (!refreshToken) {
            return;
          }

          const success = await waitForRefresh();
          if (!success) {
            return;
          }

          const user = await getCurrentUser();
          setUser(user);
        }

        if (queryClient) {
          const net = getNetworkStatus();
          if (net.isOnline) {
            try {
              await prefetchCritical(queryClient);
            } catch {
              // Non-critical, ignore prefetch errors
            }
          } else {
            hydrateFromDb(queryClient);
          }
        }
      } catch {
        const net = getNetworkStatus();
        if (net.isOnline) {
          await clearSession();
        }
      } finally {
        setLoading(false);
        setHydrated();
      }
    }

    bootstrap();
  }, [setUser, setLoading, setHydrated, queryClient]);
}
