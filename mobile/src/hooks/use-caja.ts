import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { obtenerCajaActiva,
  abrirCaja,
  cerrarCaja,
  obtenerHistorialCajas,
  obtenerResumenCaja,
  obtenerAuditoriaCaja,
  obtenerCajas } from '@/api/caja.api';
import type { AbrirCajaDto, CerrarCajaDto } from '@/types/caja.types';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getCajaActivaCache, saveCajaActiva } from '@/db/caja-db';

// Clave fija (sin fecha) para que las pantallas compartan la misma entrada de
// cache que siembra `hydrateFromDb` en arranque en frío offline y que escribe
// `useAbrirCaja`/`useCerrarCaja`. El `fecha` sigue viajando al servidor en el
// queryFn, pero no forma parte del key (C1).
export function useCajaActiva(fecha?: string) {
  return useQuery({
    queryKey: ['caja', 'activa'],
    queryFn: () => obtenerCajaActiva(fecha),
  });
}

// C2: paridad con el guard del backend (abrirCaja rechaza si ya existe una caja
// ese día). Offline solo podemos saber si el usuario ya tiene una caja abierta
// (cache react-query + SQLite); no validamos la "cerrada" porque el cache solo
// guarda la activa.
function assertNoCajaAbiertaOffline(queryClient: QueryClient): void {
  const enCache = queryClient
    .getQueriesData({ queryKey: ['caja', 'activa'] })
    .some(([, data]) => (data as { estado?: string } | null | undefined)?.estado === 'ABIERTA');
  const enDb = getCajaActivaCache();
  if (enCache || (enDb && enDb.estado === 'ABIERTA')) {
    throw new Error('Ya tienes una caja abierta para este día');
  }
}

export function useAbrirCaja() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (dto: AbrirCajaDto) => {
      if (!network.isOnline) {
        assertNoCajaAbiertaOffline(queryClient);
        const tempId = `caja_temp_${Date.now()}`;
        await addToOfflineQueue({
          endpoint: '/caja/abrir',
          method: 'POST',
          data: dto,
          queryKeys: [['caja', 'activa'], ['caja', 'historial'], ['caja', 'lista'], ['caja', 'resumen']],
          tempId,
          tempDisplay: {
            montoInicial: dto.montoInicial,
            fecha: dto.fecha || new Date().toISOString(),
            estado: 'ABIERTA',
          },
        });
        const cajaData = {
          id: tempId,
          montoInicial: dto.montoInicial,
          estado: 'ABIERTA',
          fecha: dto.fecha || new Date().toISOString(),
          horaApertura: new Date().toISOString(),
          totalIngresos: 0,
          totalEgresos: 0,
          cantidadMovimientos: 0,
          usuarioId: '',
          empresaId: '',
          resumen: {
            totalIngresos: 0,
            totalEgresos: 0,
            cantidadMovimientos: 0,
            porMetodo: {},
            pagos: [],
            desembolsos: [],
          },
          esOffline: true,
        };
        queryClient.setQueriesData(
          { queryKey: ['caja', 'activa'] },
          cajaData,
        );
        saveCajaActiva(cajaData);
        return {
          id: tempId,
          montoInicial: dto.montoInicial,
          estado: 'ABIERTA',
          fecha: dto.fecha || new Date().toISOString(),
          horaApertura: cajaData.horaApertura,
          totalIngresos: 0,
          totalEgresos: 0,
          cantidadMovimientos: 0,
          usuarioId: '',
          empresaId: '',
        };
      }
      return abrirCaja(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja', 'activa'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'lista'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'resumen'] });
    },
  });
}

export function useCerrarCaja() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: CerrarCajaDto }) => {
      if (!network.isOnline) {
        // C2: cerrar una caja offline (aunque sea una caja abierta offline con
        // tempId) se encola; sync-manager reescribe la cadena tempId → id real
        // cuando se procesa el ABRIR. El endpoint y los queryKeys contienen el
        // tempId para que `getQueueItemsReferencingTempId` los actualice.
        await addToOfflineQueue({
          endpoint: `/caja/${id}/cerrar`,
          method: 'PATCH',
          data: dto,
          queryKeys: [['caja', 'activa'], ['caja', 'historial'], ['caja', 'lista'], ['caja', 'resumen'], ['prestamos'], ['caja', id]],
          tempId: `cerrar_temp_${Date.now()}`,
          tempDisplay: {
            cajaId: id,
            montoCierre: dto.montoCierre,
            observaciones: dto.observaciones,
          },
        });
        queryClient.setQueriesData(
          { queryKey: ['caja', 'activa'] },
          null,
        );
        saveCajaActiva(null);
        return {
          cajaId: id,
          esperado: 0,
          montoCierre: dto.montoCierre,
          diferencia: 0,
          estado: 'CERRADA',
          esOffline: true,
        };
      }
      return cerrarCaja(id, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja', 'activa'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'lista'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'resumen'] });
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useHistorialCajas() {
  return useQuery({
    queryKey: ['caja', 'historial'],
    queryFn: () => obtenerHistorialCajas(),
  });
}

export function useResumenCaja(fecha?: string, cajaId?: string) {
  return useQuery({
    queryKey: ['caja', 'resumen', fecha, cajaId],
    queryFn: () => obtenerResumenCaja(fecha, cajaId),
  });
}

export function useAuditoriaCaja(id?: string) {
  return useQuery({
    queryKey: ['caja', 'auditoria', id],
    queryFn: () => obtenerAuditoriaCaja(id!),
    enabled: !!id,
  });
}

export function useCajas(estado?: string) {
  return useQuery({
    queryKey: ['caja', 'lista', estado],
    queryFn: () => obtenerCajas(estado),
  });
}
