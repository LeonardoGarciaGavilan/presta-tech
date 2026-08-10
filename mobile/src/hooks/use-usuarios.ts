import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  resetPassword,
  obtenerPermisos,
  actualizarPermisos,
  type CreateUsuarioRequest,
  type UpdateUsuarioRequest,
  type ActualizarPermisosRequest } from '@/api/usuarios.api';

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  });
}

export function usePermisos(id: string) {
  return useQuery({
    queryKey: ['usuarios', id, 'permisos'],
    queryFn: () => obtenerPermisos(id),
    enabled: !!id,
  });
}

export function useActualizarPermisos(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ActualizarPermisosRequest) => actualizarPermisos(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios', id, 'permisos'] });
    },
  });
}

export function useCrearUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUsuarioRequest) => crearUsuario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

export function useActualizarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUsuarioRequest }) =>
      actualizarUsuario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (id: string) => resetPassword(id),
  });
}
