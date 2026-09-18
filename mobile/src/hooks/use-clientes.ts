import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  reactivar,
  uploadCedula,
  getCedulaSignedUrl } from '@/api/clientes.api';
import type {
  CreateClienteRequest,
  UpdateClienteRequest,
  ClientesFilters,
} from '@/types/cliente.types';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getClienteById, getClienteNombre, upsertClientes, getAllCachedClientes } from '@/db/clientes-db';
import { findDuplicate } from '@/db/offline-queue-db';
import { unformatCedula } from '@/utils/formatters';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { useAuthStore } from '@/store/auth.store';

export function useClientes(filters?: ClientesFilters) {
  return useQuery({
    queryKey: ['clientes', filters],
    queryFn: async () => {
      try {
        return await listar(filters);
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getAllCachedClientes();
          return {
            data: local,
            total: local.length,
            pagina: 1,
            porPagina: local.length,
            totalPaginas: 1,
          };
        }
        throw new Error('Error al cargar clientes');
      }
    },
    placeholderData: keepPreviousData,
  });
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: async () => {
      try {
        return await obtener(id);
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getClienteById(id);
          if (local) return local;
        }
        throw new Error('Cliente no encontrado');
      }
    },
    enabled: !!id,
  });
}

export function useCrearCliente() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (data: CreateClienteRequest) => {
      if (!network.isOnline) {
        // Cédula normalizada (sin guiones) para el check local de duplicado y
        // para que el payload que sincroniza coincida con backend//form.
        const normalizedData = data.cedula
          ? { ...data, cedula: unformatCedula(data.cedula) }
          : data;

        // Si ya hay una creación pendiente/failed con la misma cédula, se
        // reutiliza el registro local en lugar de crear una fila fantasma.
        const duplicated = findDuplicate('/clientes', 'POST', normalizedData);
        if (duplicated?.tempId) {
          const existing = getClienteById(duplicated.tempId);
          if (existing) {
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            return existing;
          }
        }

        // Duplicado contra la caché local (cédula normalizada). El backend es
        // única por empresa y la app opera una sola, así que un cliente ya
        // cacheado con la misma cédula siempre será un conflicto.
        const cedulaNormalizada = normalizedData.cedula ?? '';
        const duplicadoLocal = (getAllCachedClientes() ?? []).find(
          (c) => unformatCedula(c.cedula ?? '') === cedulaNormalizada,
        );
        if (duplicadoLocal) {
          throw new Error('Ya existe un cliente con esta cédula en esta empresa.');
        }

        const tempId = `cliente_temp_${Date.now()}`;
        const empresaId = useAuthStore.getState().user?.empresaId || '';
        const now = new Date().toISOString();
        const syntheticCliente = {
          id: tempId,
          nombre: data.nombre,
          apellido: data.apellido || '',
          cedula: normalizedData.cedula || data.cedula,
          telefono: data.telefono || '',
          celular: data.celular || null,
          email: data.email || null,
          provincia: data.provincia || null,
          municipio: data.municipio || null,
          sector: data.sector || null,
          provinciaId: data.provinciaId || null,
          municipioId: data.municipioId || null,
          sectorId: data.sectorId || null,
          direccion: data.direccion || null,
          ocupacion: data.ocupacion || null,
          empresaLaboral: data.empresaLaboral || null,
          ingresos: data.ingresos ?? null,
          observaciones: data.observaciones || null,
          latitud: data.latitud || null,
          longitud: data.longitud || null,
          activo: true,
          coordsAproximadas: false,
          cedulaFrontalPath: null,
          cedulaTraseraPath: null,
          empresaId,
          createdAt: now,
          updatedAt: now,
          esOffline: true,
        };
        await addToOfflineQueue({
          endpoint: '/clientes',
          method: 'POST',
          data: normalizedData,
          queryKeys: [['clientes'], ['rutas']],
          tempId,
          tempDisplay: {
            nombre: data.nombre,
            apellido: data.apellido,
            cedula: normalizedData.cedula || data.cedula,
          },
        });
        upsertClientes([syntheticCliente]);
        return syntheticCliente;
      }
      return crear(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useActualizarCliente() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateClienteRequest }) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/clientes/${id}`,
          method: 'PATCH',
          data,
          queryKeys: [['clientes', id], ['clientes']],
          tempId: `update_cliente_temp_${Date.now()}`,
          tempDisplay: {
            clienteId: id,
            cambios: Object.keys(data),
            clienteNombre: getClienteNombre(id),
          },
        });
        // Merge sobre el detalle cacheado (no truncar préstamos/garantías) y
        // persistir la mutación a SQLite para que sobreviva al arranque.
        const merged = {
          ...(queryClient.getQueryData(['clientes', id]) ?? {}),
          ...data,
          esOffline: true,
        } as any;
        queryClient.setQueryData(['clientes', id], merged);
        const local = getClienteById(id);
        if (local) {
          upsertClientes([{ ...local, ...data, updatedAt: new Date().toISOString() } as any]);
        }
        return merged;
      }
      return actualizar(id, data);
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(['clientes', id], (old: any) =>
        old ? { ...old, ...data } : data,
      );
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useEliminarCliente() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/clientes/${id}`,
          method: 'DELETE',
          data: {},
          queryKeys: [['clientes'], ['clientes', id]],
          tempId: `eliminar_cliente_temp_${Date.now()}`,
          tempDisplay: { clienteId: id, clienteNombre: getClienteNombre(id) },
        });
        queryClient.setQueryData(['clientes', id], (old: any) => ({
          ...old,
          activo: false,
        }));
        const local = getClienteById(id);
        if (local) {
          upsertClientes([{ ...local, activo: false, updatedAt: new Date().toISOString() } as any]);
        }
        return { id, esOffline: true } as any;
      }
      return eliminar(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useReactivarCliente() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/clientes/${id}/reactivar`,
          method: 'PATCH',
          data: {},
          queryKeys: [['clientes', id], ['clientes']],
          tempId: `reactivar_cliente_temp_${Date.now()}`,
          tempDisplay: { clienteId: id, clienteNombre: getClienteNombre(id) },
        });
        queryClient.setQueryData(['clientes', id], (old: any) => ({
          ...old,
          activo: true,
        }));
        const local = getClienteById(id);
        if (local) {
          upsertClientes([{ ...local, activo: true, updatedAt: new Date().toISOString() } as any]);
        }
        return { id, esOffline: true } as any;
      }
      return reactivar(id);
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(['clientes', id], (old: any) =>
        old ? { ...old, ...data } : data,
      );
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useCedulaSignedUrl(
  clienteId: string | undefined,
  tipo: 'cedula-frontal' | 'cedula-trasera' | null,
) {
  return useQuery({
    queryKey: ['cedula-signed-url', clienteId, tipo],
    queryFn: () => getCedulaSignedUrl(clienteId!, tipo!),
    enabled: !!clienteId && !!tipo,
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });
}

export function useUploadCedula() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clienteId,
      tipo,
      fileUri,
    }: {
      clienteId: string;
      tipo: 'cedula-frontal' | 'cedula-trasera';
      fileUri: string;
    }) => uploadCedula(clienteId, tipo, fileUri),
    onSuccess: (_data, { clienteId, tipo }) => {
      queryClient.invalidateQueries({
        queryKey: ['cedula-signed-url', clienteId, tipo],
      });
      queryClient.invalidateQueries({ queryKey: ['clientes', clienteId] });
    },
  });
}
