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
import {
  getRutas,
  upsertVistaDiaCache,
  upsertRutaClientes,
  deleteRutaClientesExcept,
  deleteRutas,
} from '@/db/rutas-db';
import { getEntitiesWithPendingMutations } from '@/services/sync-manager';
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
    const state = queryClient.getQueryState(queryKey);
    const isFresh =
      state &&
      state.status === 'success' &&
      state.dataUpdatedAt > 0 &&
      options?.staleTime !== undefined &&
      Date.now() - state.dataUpdatedAt < options.staleTime;

    if (isFresh) return true;

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
async function persistCambios(
  data: CambiosSyncResponse,
  opciones?: { reconciliarRutaClientes?: boolean; queryClient?: QueryClient },
): Promise<void> {
  // 1.5 race pull vs push: los préstamos/clientes con mutaciones locales aún
  // pendientes (pending/syncing) se excluyen del upsert. El snapshot del
  // servidor todavía no las incluye; sobrescribirlos en SQLite revertiría
  // localmente una operación que el push aún no ha confirmado.
  const pendientes = getEntitiesWithPendingMutations();
  const prestamos = (data.prestamos ?? []).filter((p) => !pendientes.prestamos.has(p.id));
  const clientes = (data.clientes ?? []).filter((c) => !pendientes.clientes.has(c.id));

  if (clientes.length) syncClientesToDb(clientes);
  if (prestamos.length) syncPrestamosToDb(prestamos);
  if (data.rutas?.length) syncRutasToDb(data.rutas);
  if (data.rutaClientes?.length) upsertRutaClientes(data.rutaClientes);
  if (data.configuracion) syncConfigToDb(data.configuracion);

  // C8: rutas ajenas (no-admin). Rutas de otros usuarios desactivadas o
  // reasignadas que cambiaron desde el cursor: se retiran de SQLite y del
  // cache de react-query para que no reaparezcan en modo offline.
  if (data.rutasAjenas?.length) {
    deleteRutas(data.rutasAjenas);
    const queryClient = opciones?.queryClient;
    if (queryClient) {
      const ajenas = new Set(data.rutasAjenas);
      const cached = queryClient.getQueryData(['rutas']);
      if (Array.isArray(cached)) {
        const restantes = (cached as { id?: string }[]).filter(
          (r) => r?.id && !ajenas.has(r.id),
        );
        queryClient.setQueryData(['rutas'], restantes);
      }
      queryClient.removeQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'rutas' &&
          typeof q.queryKey[1] === 'string' &&
          ajenas.has(q.queryKey[1]),
      });
    }
  }

  // C4-B1: solo en full reload el snapshot es autoritativo. Un rutaCliente
  // borrado en el servidor (hard-delete) no tiene updatedAt que entre en el
  // delta, por lo que sin reconciliación quedaría huérfano en SQLite.
  if (opciones?.reconciliarRutaClientes) {
    const keepIds = new Set<string>();
    for (const rc of data.rutaClientes ?? []) {
      if (rc?.id) keepIds.add(rc.id);
    }
    for (const ruta of data.rutas ?? []) {
      for (const rc of ruta.clientes ?? []) {
        if (rc?.id) keepIds.add(rc.id);
      }
    }
    deleteRutaClientesExcept([...keepIds]);
  }
}

async function fetchCambios(
  desde?: number,
  queryClient?: QueryClient,
): Promise<{
  success: number;
  failed: number;
  entities: number;
}> {
  const network = getNetworkStatus();
  if (!network.isOnline) return { success: 0, failed: 0, entities: 0 };

  try {
    const desdeIso = desde ? new Date(desde).toISOString() : undefined;
    const data = await getCambios(desdeIso);
    // En full reload (sin cursor) el snapshot es autoritativo: reconciliar
    // rutaClientes para limpiar los hard-deletes que el delta no ve.
    await persistCambios(data, {
      reconciliarRutaClientes: !desde,
      queryClient,
    });

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
export async function prefetchIncremental(
  queryClient?: QueryClient,
): Promise<{
  success: number;
  failed: number;
  entities: number;
}> {
  return fetchCambios(getSyncCursor() ?? undefined, queryClient);
}

// Descarga completa real (botón "Forzar recarga"): snapshot de todo el tenant.
export async function forceReloadAll(
  queryClient?: QueryClient,
): Promise<{
  success: number;
  failed: number;
  entities: number;
}> {
  return fetchCambios(undefined, queryClient);
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

    const incremental = await prefetchIncremental(queryClient);
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
