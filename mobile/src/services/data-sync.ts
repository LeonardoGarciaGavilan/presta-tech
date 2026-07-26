import type { QueryClient } from '@tanstack/react-query';

import { upsertClientes, getAllCachedClientes } from '@/db/clientes-db';
import { upsertPrestamos } from '@/db/prestamos-db';
import { upsertRutas, upsertRutaClientes, getRutas } from '@/db/rutas-db';
import { setConfiguracion, getConfiguracion } from '@/db/config-db';
import { setLastSyncAt } from '@/db/sync-meta-db';
import type { Cliente, PaginatedClientesResponse } from '@/types/cliente.types';
import type { Prestamo, PaginatedPrestamosResponse } from '@/types/prestamo.types';
import type { Ruta } from '@/types/rutas.types';
import type { ConfiguracionResponse } from '@/api/configuracion.api';

export function syncClientesToDb(clientes: Cliente[]): void {
  if (clientes.length === 0) return;
  upsertClientes(clientes);
}

export function syncPrestamosToDb(prestamos: Prestamo[]): void {
  if (prestamos.length === 0) return;
  upsertPrestamos(prestamos);
}

export function syncRutasToDb(rutas: Ruta[]): void {
  if (rutas.length === 0) return;
  upsertRutas(rutas);

  const allRc = rutas.flatMap((r) =>
    (r.clientes ?? []).map((rc: any) => ({
      id: rc.id ?? `${r.id}_${rc.id}`,
      orden: rc.orden ?? 0,
      observacion: rc.observacion ?? null,
      visitadoHoy: rc.visitadoHoy ?? false,
      ultimaVisita: rc.ultimaVisita ?? null,
      fechaRuta: rc.fechaRuta ?? null,
      rutaId: r.id,
      clienteId: rc.id,
    })),
  );
  if (allRc.length > 0) {
    upsertRutaClientes(allRc);
  }
}

export function syncConfigToDb(config: ConfiguracionResponse): void {
  setConfiguracion(config);
}

export function hydrateFromDb(queryClient: QueryClient): void {
  const cachedClientes = getAllCachedClientes();
  if (cachedClientes.length > 0) {
    queryClient.setQueryData(
      ['clientes', { page: 1, limit: cachedClientes.length }],
      { data: cachedClientes, total: cachedClientes.length, pagina: 1, porPagina: cachedClientes.length, totalPaginas: 1 },
    );
  }

  const cachedRutas = getRutas();
  if (cachedRutas.length > 0) {
    queryClient.setQueryData(['rutas'], cachedRutas);
  }

  const cachedConfig = getConfiguracion();
  if (cachedConfig) {
    queryClient.setQueryData(['configuracion'], cachedConfig);
  }

  setLastSyncAt(Date.now());
}
