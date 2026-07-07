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

export function useClientes(filters?: ClientesFilters) {
  return useQuery({
    queryKey: ['clientes', filters],
    queryFn: () => listar(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: () => obtener(id),
    enabled: !!id,
  });
}

export function useCrearCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClienteRequest) => crear(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useActualizarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClienteRequest }) =>
      actualizar(id, data),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(['clientes', id], data);
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useEliminarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useReactivarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivar(id),
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
