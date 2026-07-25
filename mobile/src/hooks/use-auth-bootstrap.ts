import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { tokenStorage } from '@/utils/token-storage';
import { useAuthStore } from '@/store/auth.store';
import { getCurrentUser } from '@/api/auth.api';
import { waitForRefresh } from '@/api/refresh-manager';
import { clearSession } from '@/utils/session';
import { prefetchCritical } from '@/services/prefetch-manager';
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

        if (!refreshToken) {
          return;
        }

        const success = await waitForRefresh();

        if (!success) {
          return;
        }

        const user = await getCurrentUser();
        setUser(user);

        if (queryClient) {
          const network = getNetworkStatus();
          if (network.isOnline) {
            try {
              await prefetchCritical(queryClient);
            } catch {
              // Non-critical, ignore prefetch errors
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
