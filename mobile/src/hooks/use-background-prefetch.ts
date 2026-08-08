import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useNetworkContext } from '@/components/providers/network-provider';
import { prefetchAll, shouldPrefetch } from '@/services/prefetch-manager';

export function useBackgroundPrefetch() {
  const queryClient = useQueryClient();
  const { network } = useNetworkContext();
  const appState = useRef(AppState.currentState);

  // Al montar (arranque de app o login): llena la base offline si no se ha
  // hecho recientemente. No bloquea la UI: corre en background tras el render.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!network.isOnline) return;
      const shouldRun = await shouldPrefetch();
      if (!shouldRun || cancelled) return;
      try {
        await prefetchAll(queryClient);
      } catch {
        // Non-critical, ignore
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [queryClient, network.isOnline]);

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
