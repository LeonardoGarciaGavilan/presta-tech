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

// Por defecto asumimos OFFLINE hasta que NetInfo aporte evidencia real. Si
// asumimos online, una mutación (pago/cobro) en frío offline saldría por red,
// fallaría y no se encolaría: riesgo de pérdida de dinero.
let globalStatus: NetworkStatus = {
  isOnline: false,
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

  let receivedEvent = false;

  NetInfo.addEventListener((state: NetInfoState) => {
    receivedEvent = true;
    emit(statusFromState(state));
  });

  // Seed inicial: NetInfo.addEventListener ya emite el estado actual al
  // suscribirse, pero de forma asíncrona. Un fetch garantiza que el primer
  // estado llegue rápido. Solo se aplica si aún no hubo evento real, para no
  // pisar una lectura más fresca.
  NetInfo.fetch()
    .then((state) => {
      if (!receivedEvent) {
        emit(statusFromState(state));
      }
    })
    .catch(() => {
      // Conservamos el estado por defecto (offline) ante cualquier fallo.
    });
}

function statusFromState(state: NetInfoState): NetworkStatus {
  return {
    isOnline: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
    connectionType: state.type,
    isWifi: state.type === 'wifi',
    isCellular: state.type === 'cellular',
  };
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
