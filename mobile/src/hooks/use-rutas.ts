import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';

import * as rutasApi from '@/api/rutas.api';
import type {
  CreateRutaRequest,
  UpdateRutaRequest,
  AddClienteRutaRequest,
  ReordenRequest,
  GenerarDiaRequest,
} from '@/types/rutas.types';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getRutas, getRutaById, upsertVistaDiaCache, getVistaDiaCache } from '@/db/rutas-db';
import { getNetworkStatus } from '@/hooks/use-network-status';

export function useRutas() {
  return useQuery({
    queryKey: ['rutas'],
    queryFn: async () => {
      try {
        return await rutasApi.listarRutas();
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getRutas();
          if (local.length > 0) return local;
        }
        throw new Error('Error al cargar rutas');
      }
    },
  });
}

export function useRuta(id: string) {
  return useQuery({
    queryKey: ['rutas', id],
    queryFn: async () => {
      try {
        return await rutasApi.obtenerRuta(id);
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getRutaById(id);
          if (local) return local;
        }
        throw new Error('Ruta no encontrada');
      }
    },
    enabled: !!id,
  });
}

export function useVistaDia(id: string, fecha: string) {
  return useQuery({
    queryKey: ['rutas', id, 'dia', fecha],
    queryFn: async () => {
      try {
        const data = await rutasApi.obtenerVistaDia(id, fecha);
        upsertVistaDiaCache(id, fecha, data);
        return data;
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const cached = getVistaDiaCache(id, fecha);
          if (cached) return cached;
        }
        throw new Error('Error al cargar la vista del día');
      }
    },
    enabled: !!id && !!fecha,
    placeholderData: keepPreviousData,
  });
}

export function useCrearRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRutaRequest) => rutasApi.crearRuta(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useActualizarRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateRutaRequest;
    }) => rutasApi.actualizarRuta(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useEliminarRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rutasApi.eliminarRuta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useMarcarVisitado() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({ rcId, visitado, rutaId, fecha }: { rcId: string; visitado: boolean; rutaId?: string; fecha?: string }) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/rutas/clientes/${rcId}/visita`,
          method: 'PATCH',
          data: { visitado },
          queryKeys: [
            ['rutas'],
            ...(rutaId && fecha ? [['rutas', rutaId, 'dia', fecha]] : []),
          ] as string[][],
          tempId: `visita_temp_${Date.now()}`,
          tempDisplay: {
            rcId,
            visitado,
          },
        });
        if (rutaId && fecha) {
          queryClient.setQueryData(
            ['rutas', rutaId, 'dia', fecha],
            (old: any) => {
              if (!old || !old.clientes) return old;
              return {
                ...old,
                clientes: old.clientes.map((c: any) =>
                  c.rutaClienteId === rcId || c.id === rcId
                    ? { ...c, visitado }
                    : c,
                ),
              };
            },
          );
        }
        queryClient.setQueriesData(
          { queryKey: ['rutas'] },
          (old: any) => {
            if (!old) return old;
            if (Array.isArray(old)) {
              return old.map((ruta: any) => ({
                ...ruta,
                clientes: ruta.clientes?.map((c: any) =>
                  c.rutaClienteId === rcId || c.id === rcId
                    ? { ...c, visitado }
                    : c,
                ),
              }));
            }
            return old;
          },
        );
        return { rcId, visitado, esOffline: true };
      }
      return rutasApi.marcarVisitado(rcId, visitado);
    },
    onSuccess: (_data, { rutaId, fecha }) => {
      const keys: any[][] = [['rutas']];
      if (rutaId) keys.push(['rutas', rutaId]);
      if (rutaId && fecha) keys.push(['rutas', rutaId, 'dia', fecha]);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useResetVisitados() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (params?: { rutaId?: string; fecha?: string }) => {
      const { rutaId, fecha } = params || {};
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: '/rutas/reset-visitados',
          method: 'POST',
          data: {},
          queryKeys: [
            ['rutas'],
            ...(rutaId && fecha ? [['rutas', rutaId, 'dia', fecha]] : []),
          ] as string[][],
          tempId: `reset_visitas_temp_${Date.now()}`,
          tempDisplay: { accion: 'reset_visitados' },
        });
        if (rutaId && fecha) {
          queryClient.setQueryData(
            ['rutas', rutaId, 'dia', fecha],
            (old: any) => {
              if (!old || !old.clientes) return old;
              return {
                ...old,
                clientes: old.clientes.map((c: any) => ({
                  ...c,
                  visitado: false,
                })),
              };
            },
          );
        }
        queryClient.setQueriesData(
          { queryKey: ['rutas'] },
          (old: any) => {
            if (!old) return old;
            if (Array.isArray(old)) {
              return old.map((ruta: any) => ({
                ...ruta,
                clientes: ruta.clientes?.map((c: any) => ({
                  ...c,
                  visitado: false,
                })),
              }));
            }
            return old;
          },
        );
        return { esOffline: true };
      }
      return rutasApi.resetVisitados();
    },
    onSuccess: (_data, params) => {
      const rutaId = params?.rutaId;
      const fecha = params?.fecha;
      const keys: any[][] = [['rutas']];
      if (rutaId) keys.push(['rutas', rutaId]);
      if (rutaId && fecha) keys.push(['rutas', rutaId, 'dia', fecha]);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useGenerarDia(id: string) {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (data: GenerarDiaRequest) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/rutas/${id}/generar-dia`,
          method: 'POST',
          data,
          queryKeys: [['rutas', id], ['rutas', id, 'dia'], ['rutas']],
          tempId: `generar_dia_temp_${Date.now()}`,
          tempDisplay: {
            rutaId: id,
            fecha: data.fecha,
          },
        });
        return { id, esOffline: true } as any;
      }
      return rutasApi.generarRutaDia(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id, 'dia'] });
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useAgregarClienteRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddClienteRutaRequest) =>
      rutasApi.agregarClienteRuta(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
    },
  });
}

export function useQuitarClienteRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rcId: string) => rutasApi.quitarClienteRuta(id, rcId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
    },
  });
}

export function useReordenarRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReordenRequest) => rutasApi.reordenarRuta(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
    },
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['rutas', 'usuarios'],
    queryFn: rutasApi.listarUsuarios,
  });
}

export function useAsignarUsuarioRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rutaId,
      usuarioId,
    }: {
      rutaId: string;
      usuarioId: string;
    }) => rutasApi.asignarUsuarioRuta(rutaId, usuarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useResumenRutas() {
  return useQuery({
    queryKey: ['rutas', 'resumen'],
    queryFn: rutasApi.obtenerResumenRutas,
  });
}
