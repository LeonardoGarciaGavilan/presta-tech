import type { QueryClient } from '@tanstack/react-query';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { obtenerCajaActiva } from '@/api/caja.api';
import { listarRutas, listarUsuarios, obtenerVistaDia } from '@/api/rutas.api';
import { obtenerResumenPagos } from '@/api/pagos.api';
import { getDashboardMobile } from '@/api/dashboard.api';
import { obtenerConfiguracion } from '@/api/configuracion.api';
import { getCambios, type CambiosSyncResponse } from '@/api/sync.api';
import {
  syncClientesToDb,
  syncPrestamosToDb,
  syncRutasToDb,
  syncConfigToDb,
} from '@/services/data-sync';
import { getRutas, upsertVistaDiaCache, upsertRutaClientes } from '@/db/rutas-db';
import {
  getLastSyncAt,
  setLastSyncAt,
  getSyncCursor,
  setSyncCursor,
} from '@/db/sync-meta-db';
import { dateToISO } from '@/utils/formatters';

const PREFETCH_INTERVAL_MS = 30 * 60 * 1000;

async function safeFetch<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  options?: { staleTime?: number; persistFn?: (data: T) => void },
): Promise<boolean> {
  try {
    const existing = queryClient.getQueryData(queryKey);
    if (existing) return true;

    const data = await fetchFn();
    queryClient.setQueryData(queryKey, data, {
      updatedAt: Date.now(),
    });

    if (options?.persistFn && data) {
      try {
        options.persistFn(data);
      } catch {
        // Non-critical: SQLite persistence failed
      }
    }

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
      persistFn: (data) => syncRutasToDb(data as any),
    }),
    safeFetch(queryClient, ['rutas', 'usuarios'], () => listarUsuarios(), {
      staleTime: 30 * 60 * 1000,
    }),
    safeFetch(queryClient, ['pagos', 'resumen'], () => obtenerResumenPagos(), {
      staleTime: 2 * 60 * 1000,
    }),
    safeFetch(queryClient, ['configuracion'], () => obtenerConfiguracion(), {
      staleTime: 30 * 60 * 1000,
      persistFn: (data) => syncConfigToDb(data as any),
    }),
  ]);

  results.forEach((r) => (r.status === 'fulfilled' && r.value ? success++ : failed++));

  return { success, failed };
}

// Persiste en SQLite lo que devuelve GET /sync/cambios. Se ejecuta ANTES de
// avanzar el cursor: si algo falla a media escritura, el cursor no avanza y la
// siguiente pasada reintenta el mismo delta (upserts idempotentes).
async function persistCambios(data: CambiosSyncResponse): Promise<void> {
  if (data.clientes?.length) syncClientesToDb(data.clientes);
  if (data.prestamos?.length) syncPrestamosToDb(data.prestamos);
  if (data.rutas?.length) syncRutasToDb(data.rutas);
  if (data.rutaClientes?.length) upsertRutaClientes(data.rutaClientes);
  if (data.configuracion) syncConfigToDb(data.configuracion);
}

async function fetchCambios(desde?: number): Promise<{
  success: number;
  failed: number;
  entities: number;
}> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0, entities: 0 };

  try {
    const desdeIso = desde ? new Date(desde).toISOString() : undefined;
    const data = await getCambios(desdeIso);
    await persistCambios(data);

    // serverTime es la fuente de verdad del cursor: evita que el reloj del
    // dispositivo cause re-descargas o pierda cambios.
    const serverTime = data.serverTime ? Date.parse(data.serverTime) : Date.now();
    setSyncCursor(serverTime);
    setLastSyncAt(Date.now());

    const entities =
      (data.clientes?.length ?? 0) +
      (data.prestamos?.length ?? 0) +
      (data.rutas?.length ?? 0) +
      (data.rutaClientes?.length ?? 0) +
      (data.configuracion ? 1 : 0);

    return { success: 1, failed: 0, entities };
  } catch (error) {
    if (__DEV__) {
      console.warn('[Sync] Error en getCambios:', error);
    }
    return { success: 0, failed: 1, entities: 0 };
  }
}

// Descarga incremental: solo lo que cambió desde el último cursor.
export async function prefetchIncremental(): Promise<{
  success: number;
  failed: number;
  entities: number;
}> {
  return fetchCambios(getSyncCursor() ?? undefined);
}

// Descarga completa real (botón "Forzar recarga"): snapshot de todo el tenant.
export async function forceReloadAll(): Promise<{
  success: number;
  failed: number;
  entities: number;
}> {
  return fetchCambios();
}

let prefetchInFlight = false;

export async function prefetchDashboard(
  queryClient: QueryClient,
): Promise<boolean> {
  const network = getNetworkStatus();
  if (!network.isOnline) return false;

  return safeFetch(queryClient, ['dashboard', 'mobile'], () => getDashboardMobile(), {
    staleTime: 2 * 60 * 1000,
  });
}

// Cachea la "vista del día" (GET /rutas/:id/dia) de todas las rutas para la
// fecha actual. Es lo que permite ver una ruta sin conexión aunque nunca se
// haya abierto estando online: `useVistaDia` lee `getVistaDiaCache` cuando
// está offline. Nunca lanza: cada ruta se cuenta como success/failed.
export async function prefetchVistaDiasRuta(
  queryClient: QueryClient,
): Promise<{ success: number; failed: number }> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0 };

  const fecha = dateToISO(new Date());
  const cached = queryClient.getQueryData(['rutas']);
  const rutas = Array.isArray(cached)
    ? (cached as { id: string }[])
    : getRutas();

  let success = 0;
  let failed = 0;
  for (const ruta of rutas) {
    const ok = await safeFetch(
      queryClient,
      ['rutas', ruta.id, 'dia', fecha],
      () => obtenerVistaDia(ruta.id, fecha),
      {
        staleTime: 5 * 60 * 1000,
        persistFn: (data) => upsertVistaDiaCache(ruta.id, fecha, data),
      },
    );
    if (ok) {
      success++;
    } else {
      failed++;
    }
  }
  return { success, failed };
}

export async function prefetchAll(
  queryClient: QueryClient,
): Promise<{ success: number; failed: number }> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0 };
  if (prefetchInFlight) return { success: 0, failed: 0 };

  prefetchInFlight = true;
  try {
    let success = 0;
    let failed = 0;

    const critical = await prefetchCritical(queryClient);
    success += critical.success;
    failed += critical.failed;

    const incremental = await prefetchIncremental();
    success += incremental.success;
    failed += incremental.failed;

    await prefetchDashboard(queryClient);

    return { success, failed };
  } finally {
    prefetchInFlight = false;
  }
}

export async function shouldPrefetch(): Promise<boolean> {
  try {
    const last = getLastSyncAt();
    if (!last) return true;
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
