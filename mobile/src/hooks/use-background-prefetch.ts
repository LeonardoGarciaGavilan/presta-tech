import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useNetworkContext } from '@/components/providers/network-provider';
import { prefetchAll, shouldPrefetch } from '@/services/prefetch-manager';

export function useBackgroundPrefetch() {
  const queryClient = useQueryClient();
  const { network } = useNetworkContext();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          if (!network.isOnline) return;

          const shouldRun = await shouldPrefetch();
          if (!shouldRun) return;

          try {
            await prefetchAll(queryClient);
          } catch {
            // Non-critical, ignore
          }
        }
        appState.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [queryClient, network.isOnline]);
}
