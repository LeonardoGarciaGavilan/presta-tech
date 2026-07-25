import { useEffect, useState, useRef, useCallback } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  isWifi: boolean;
  isCellular: boolean;
}

type Listener = (status: NetworkStatus) => void;

let globalStatus: NetworkStatus = {
  isOnline: true,
  isInternetReachable: null,
  connectionType: 'unknown',
  isWifi: false,
  isCellular: false,
};

const listeners = new Set<Listener>();

function emit(status: NetworkStatus) {
  globalStatus = status;
  listeners.forEach((l) => l(status));
}

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  NetInfo.addEventListener((state: NetInfoState) => {
    const status: NetworkStatus = {
      isOnline: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      connectionType: state.type,
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
    };
    emit(status);
  });
}

export function getNetworkStatus(): NetworkStatus {
  return globalStatus;
}

export function subscribeToNetwork(listener: Listener): () => void {
  ensureInitialized();
  listeners.add(listener);
  listener(globalStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(globalStatus);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    ensureInitialized();

    const unsubscribe = subscribeToNetwork((newStatus) => {
      if (mountedRef.current) {
        setStatus(newStatus);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  return status;
}

export function waitForOnline(timeoutMs = 30000): Promise<boolean> {
  if (globalStatus.isOnline) return Promise.resolve(true);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = subscribeToNetwork((status) => {
      if (status.isOnline) {
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

export function onOnline(callback: () => void): () => void {
  let wasOffline = !globalStatus.isOnline;

  return subscribeToNetwork((status) => {
    if (wasOffline && status.isOnline) {
      callback();
    }
    wasOffline = !status.isOnline;
  });
}
