import type { QueryClient } from '@tanstack/react-query';

import { upsertClientes } from '@/db/clientes-db';
import { upsertPrestamos } from '@/db/prestamos-db';
import { upsertRutas, upsertRutaClientes, getRutas } from '@/db/rutas-db';
import { setConfiguracion, getConfiguracion } from '@/db/config-db';
import { getCajaActivaCache } from '@/db/caja-db';
import { getClientesOffline, getPrestamosOffline } from '@/services/offline-data';
import { obtener as obtenerPrestamo } from '@/api/prestamos.api';
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

// Reconciliación best-effort: tras sincronizar una operación que muta un
// préstamo, trae el estado autoritativo del servidor y lo persiste en SQLite
// (cuotas pagadas, saldo, mora, estado). Nunca lanza: si el GET falla o el
// préstamo ya no existe, se ignora sin afectar el resultado del sync.
export async function reconciliarPrestamoLocal(prestamoId: string): Promise<void> {
  try {
    if (!prestamoId || prestamoId.startsWith('prestamo_temp_')) return;
    const prestamo = await obtenerPrestamo(prestamoId);
    upsertPrestamos([prestamo]);
  } catch {
    // best-effort
  }
}

export function syncRutasToDb(rutas: Ruta[]): void {
  if (rutas.length === 0) return;
  upsertRutas(rutas);

  const allRc = rutas.flatMap((r) =>
    (r.clientes ?? []).map((rc) => ({
      id: rc.id,
      orden: rc.orden ?? 0,
      observacion: rc.observacion ?? null,
      visitadoHoy: rc.visitadoHoy ?? false,
      ultimaVisita: rc.ultimaVisita ?? null,
      fechaRuta: rc.fechaRuta ?? null,
      rutaId: r.id,
      clienteId: rc.clienteId,
      eliminado: rc.eliminado ?? false,
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
  // Siembra las claves exactas que usan los listados infinitos offline
  // (['clientes', search, verInactivos] / ['prestamos', search, estado]) para
  // que en arranque en frío sin conexión se vea la lista completa al instante.
  const clientes = getClientesOffline('', false);
  if (clientes.data.length > 0) {
    queryClient.setQueryData(['clientes', '', false], clientes);
  }

  const cachedRutas = getRutas();
  if (cachedRutas.length > 0) {
    queryClient.setQueryData(['rutas'], cachedRutas);
  }

  const cachedConfig = getConfiguracion();
  if (cachedConfig) {
    queryClient.setQueryData(['configuracion'], cachedConfig);
  }

  const prestamos = getPrestamosOffline('', '');
  if (prestamos.data.length > 0) {
    queryClient.setQueryData(['prestamos', '', ''], prestamos);
  }

  // C2: la caja activa persiste en SQLite para sobrevivir al arranque en frío.
  const cajaActivaCache = getCajaActivaCache();
  if (cajaActivaCache) {
    queryClient.setQueryData(['caja', 'activa'], cajaActivaCache);
  }
}
