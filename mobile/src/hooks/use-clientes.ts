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
        const tempId = `cliente_temp_${Date.now()}`;
        const empresaId = useAuthStore.getState().user?.empresaId || '';
        const now = new Date().toISOString();
        const syntheticCliente = {
          id: tempId,
          nombre: data.nombre,
          apellido: data.apellido || '',
          cedula: data.cedula,
          telefono: data.telefono || '',
          celular: data.celular || null,
          email: data.email || null,
          provincia: data.provincia || null,
          municipio: data.municipio || null,
          sector: data.sector || null,
          direccion: data.direccion || null,
          ocupacion: data.ocupacion || null,
          empresaLaboral: data.empresaLaboral || null,
          ingresos: data.ingresos || 0,
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
          data,
          queryKeys: [['clientes'], ['rutas']],
          tempId,
          tempDisplay: {
            nombre: data.nombre,
            apellido: data.apellido,
            cedula: data.cedula,
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
        queryClient.setQueryData(['clientes', id], (old: any) => ({
          ...old,
          ...data,
        }));
        return { id, ...data, esOffline: true } as any;
      }
      return actualizar(id, data);
    },
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(['clientes', id], data);
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
          queryKeys: [['clientes']],
          tempId: `eliminar_cliente_temp_${Date.now()}`,
          tempDisplay: { clienteId: id, clienteNombre: getClienteNombre(id) },
        });
        queryClient.setQueryData(['clientes', id], (old: any) => ({
          ...old,
          activo: false,
        }));
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
        return { id, esOffline: true } as any;
      }
      return reactivar(id);
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(['clientes', id], data);
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
