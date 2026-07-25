import type { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { listar as listarClientes } from '@/api/clientes.api';
import { listar as listarPrestamos } from '@/api/prestamos.api';
import { obtenerCajaActiva } from '@/api/caja.api';
import { listarRutas, listarUsuarios } from '@/api/rutas.api';
import { obtenerResumenPagos } from '@/api/pagos.api';
import { getDashboardMobile } from '@/api/dashboard.api';
import { obtenerConfiguracion } from '@/api/configuracion.api';

const PREFETCH_TIMESTAMP_KEY = 'sas_prestamos_last_prefetch';
const PREFETCH_INTERVAL_MS = 30 * 60 * 1000;

async function safeFetch<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  options?: { staleTime?: number; gcTime?: number },
): Promise<boolean> {
  try {
    const existing = queryClient.getQueryData(queryKey);
    if (existing) return true;

    const data = await fetchFn();
    queryClient.setQueryData(queryKey, data, {
      updatedAt: Date.now(),
    });
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[Prefetch] Error fetching ${queryKey.join('/')}:`, error);
    }
    return false;
  }
}

export async function prefetchCritical(
  queryClient: QueryClient,
): Promise<{ success: number; failed: number }> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  const results = await Promise.allSettled([
    safeFetch(queryClient, ['caja', 'activa'], () => obtenerCajaActiva(), {
      staleTime: 2 * 60 * 1000,
    }),
    safeFetch(queryClient, ['rutas'], () => listarRutas(), {
      staleTime: 5 * 60 * 1000,
    }),
    safeFetch(queryClient, ['rutas', 'usuarios'], () => listarUsuarios(), {
      staleTime: 30 * 60 * 1000,
    }),
    safeFetch(queryClient, ['pagos', 'resumen'], () => obtenerResumenPagos(), {
      staleTime: 2 * 60 * 1000,
    }),
    safeFetch(queryClient, ['configuracion'], () => obtenerConfiguracion(), {
      staleTime: 30 * 60 * 1000,
    }),
  ]);

  results.forEach((r) => (r.status === 'fulfilled' && r.value ? success++ : failed++));

  return { success, failed };
}

export async function prefetchSecondary(
  queryClient: QueryClient,
): Promise<{ success: number; failed: number }> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  const rutas = queryClient.getQueryData<any[]>(['rutas']);
  const clienteIds = rutas
    ?.flatMap((r: any) => (r.clientes || []).map((c: any) => c.id))
    .filter(Boolean) ?? [];

  if (clienteIds.length > 0) {
    const clientResults = await Promise.allSettled([
      safeFetch(
        queryClient,
        ['clientes', { page: 1, limit: clienteIds.length }],
        () => listarClientes({ page: 1, limit: clienteIds.length, ids: clienteIds }),
        { staleTime: 10 * 60 * 1000 },
      ),
    ]);
    clientResults.forEach((r) => (r.status === 'fulfilled' && r.value ? success++ : failed++));
  }

  const prestamoResults = await Promise.allSettled([
    safeFetch(
      queryClient,
      ['prestamos', { page: 1, limit: 200 }],
      () => listarPrestamos({ page: 1, limit: 200 }),
      { staleTime: 10 * 60 * 1000 },
    ),
  ]);
  prestamoResults.forEach((r) => (r.status === 'fulfilled' && r.value ? success++ : failed++));

  return { success, failed };
}

export async function prefetchDashboard(
  queryClient: QueryClient,
): Promise<boolean> {
  const network = getNetworkStatus();
  if (!network.isOnline) return false;

  return safeFetch(queryClient, ['dashboard', 'mobile'], () => getDashboardMobile(), {
    staleTime: 2 * 60 * 1000,
  });
}

export async function prefetchAll(
  queryClient: QueryClient,
): Promise<{ success: number; failed: number }> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  const critical = await prefetchCritical(queryClient);
  success += critical.success;
  failed += critical.failed;

  const secondary = await prefetchSecondary(queryClient);
  success += secondary.success;
  failed += secondary.failed;

  await prefetchDashboard(queryClient);

  await AsyncStorage.setItem(PREFETCH_TIMESTAMP_KEY, Date.now().toString());

  return { success, failed };
}

export async function shouldPrefetch(): Promise<boolean> {
  try {
    const lastStr = await AsyncStorage.getItem(PREFETCH_TIMESTAMP_KEY);
    if (!lastStr) return true;
    const last = parseInt(lastStr, 10);
    return Date.now() - last > PREFETCH_INTERVAL_MS;
  } catch {
    return true;
  }
}

export async function prefetchOnReconnect(
  queryClient: QueryClient,
): Promise<void> {
  const network = getNetworkStatus();
  if (!network.isOnline) return;

  const shouldRun = await shouldPrefetch();
  if (!shouldRun) return;

  await prefetchAll(queryClient);
}
