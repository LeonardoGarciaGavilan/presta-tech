import { useQuery } from '@tanstack/react-query';
import { getUbicacionesCatalogo, getUbicacionesVersion as getUbicacionesVersionApi } from '@/api/ubicaciones.api';
import {
  getCatalogoDesdeDb,
  getUbicacionesVersion as getUbicacionesVersionLocal,
  syncUbicacionesToDb,
} from '@/db/ubicaciones-db';
import { getNetworkStatus } from '@/hooks/use-network-status';
import type { UbicacionCatalogo } from '@/types/ubicaciones.types';

// Catálogo RD (20,6k nodos): refresca el catálogo en background y lo deja
// listo offline en SQLite. Si el servidor mantiene la misma versión que el
// dispositivo, sirve la copia local sin volver a descargar los 20,6k nodos.
export function useUbicaciones() {
  return useQuery<UbicacionCatalogo>({
    queryKey: ['ubicaciones', 'catalogo'],
    queryFn: async () => {
      const red = getNetworkStatus();

      if (red.isOnline) {
        try {
const { version } = await getUbicacionesVersionApi();
            if (version && version === getUbicacionesVersionLocal()) {
            const local = getCatalogoDesdeDb();
            if (local) return local;
          }
          const catalogo = await getUbicacionesCatalogo();
          syncUbicacionesToDb(catalogo);
          return catalogo;
        } catch {
          // Servidor inalcanzable: cae al catálogo local si existe.
        }
      }

      const local = getCatalogoDesdeDb();
      if (local) return local;
      throw new Error('Catálogo de ubicaciones no disponible');
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}