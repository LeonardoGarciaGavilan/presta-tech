import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  useNetworkStatus,
  type NetworkStatus,
  onOnline,
} from '@/hooks/use-network-status';
import {
  getQueueStats,
  addToQueue as addToQueueFn,
  recoverSyncingItems,
  markStaleAsFailed,
} from '@/db/offline-queue-db';
import { syncNow, retryFailed as retryFailedFn, onSyncProgress, onSyncComplete } from '@/services/sync-manager';
import { prefetchOnReconnect } from '@/services/prefetch-manager';
import type { OfflineQueueItem, SyncProgress } from '@/types/offline.types';

interface NetworkContextValue {
  network: NetworkStatus;
  isSyncing: boolean;
  bannerVisible: boolean;
  setBannerVisible: (visible: boolean) => void;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  syncProgress: SyncProgress | null;
  addToOfflineQueue: (
    item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status'>,
  ) => Promise<OfflineQueueItem>;
  triggerSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetworkContext(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetworkContext must be used within NetworkProvider');
  return ctx;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const network = useNetworkStatus();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const autoSyncTriggeredRef = useRef(false);
  const bootSyncDoneRef = useRef(false);
  const isSyncingRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const triggerSyncRef = useRef<() => Promise<void>>(async () => {});

  const refreshStats = useCallback(async () => {
    const stats = await getQueueStats();
    setPendingCount(stats.pending);
    setFailedCount(stats.failed);
  }, []);

  // 1.5: deduplica el push. Si ya hay un sync en curso, devuelve la misma
  // promesa en vez de lanzar un segundo `syncNow` concurrente (que `syncing`
  // de sync-manager ya rechazaría, pero sin exponer el fin del push real).
  const triggerSync = useCallback(async () => {
    if (syncPromiseRef.current) return syncPromiseRef.current;
    if (!network.isOnline) return;
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    const promise = (async () => {
      try {
        await syncNow(queryClient);
        setLastSyncAt(Date.now());
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
        await refreshStats();
        syncPromiseRef.current = null;
        const stats = await getQueueStats();
        if (stats.pending > 0 && retryTimeoutRef.current === null) {
          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            triggerSyncRef.current();
          }, 5000);
        }
      }
    })();
    syncPromiseRef.current = promise;
    return promise;
  }, [network.isOnline, queryClient, refreshStats]);

  triggerSyncRef.current = triggerSync;

  const retryFailed = useCallback(async () => {
    if (isSyncingRef.current || !network.isOnline) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      await retryFailedFn(queryClient);
      setLastSyncAt(Date.now());
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshStats();
    }
  }, [network.isOnline, queryClient, refreshStats]);

  const addToOfflineQueue = useCallback(
    async (
      item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status'>,
    ) => {
      const created = await addToQueueFn(item);
      await refreshStats();
      return created;
    },
    [refreshStats],
  );

  useEffect(() => {
    const unsubProgress = onSyncProgress((progress) => {
      setSyncProgress(progress);
    });
    const unsubComplete = onSyncComplete(() => {
      setSyncProgress(null);
      setLastSyncAt(Date.now());
      refreshStats();
      queryClient.invalidateQueries({ queryKey: ['offline-queue'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    });

    refreshStats();

    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [refreshStats, queryClient]);

  useEffect(() => {
    if (!bootSyncDoneRef.current && network.isOnline) {
      bootSyncDoneRef.current = true;
      (async () => {
        await recoverSyncingItems();
        await markStaleAsFailed();
        const stats = await getQueueStats();
        setPendingCount(stats.pending);
        setFailedCount(stats.failed);
        if (stats.pending > 0 && !isSyncingRef.current) {
          triggerSync();
        }
      })();
    }
  }, [network.isOnline, triggerSync]);

  useEffect(() => {
    if (network.isOnline && pendingCount > 0 && !isSyncingRef.current) {
      if (!autoSyncTriggeredRef.current) {
        autoSyncTriggeredRef.current = true;
        triggerSync();
      }
    }
    if (!network.isOnline) {
      autoSyncTriggeredRef.current = false;
    }
  }, [network.isOnline, pendingCount, triggerSync]);

  useEffect(() => {
    const unsubscribe = onOnline(() => {
      refreshStats();
      // 1.5: al reconectar, orden pull/push. Si hay items pendientes se suben
      // ANTES de descargar el delta: el snapshot del servidor aún no incluye
      // las mutaciones locales recién encoladas, así que perseguir el pull
      // mientras el push está en vuelo pisaría esos cambios en SQLite.
      (async () => {
        const stats = await getQueueStats();
        if (stats.pending > 0) {
          await triggerSync();
        }
        await prefetchOnReconnect(queryClient);
      })();
    });
    return unsubscribe;
  }, [refreshStats, queryClient, triggerSync]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const contextValue = useMemo<NetworkContextValue>(
    () => ({
      network,
      isSyncing,
      bannerVisible,
      setBannerVisible,
      pendingCount,
      failedCount,
      lastSyncAt,
      syncProgress,
      addToOfflineQueue,
      triggerSync,
      retryFailed,
      refreshStats,
    }),
    [
      network,
      isSyncing,
      bannerVisible,
      setBannerVisible,
      pendingCount,
      failedCount,
      lastSyncAt,
      syncProgress,
      addToOfflineQueue,
      triggerSync,
      retryFailed,
      refreshStats,
    ],
  );

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
}
