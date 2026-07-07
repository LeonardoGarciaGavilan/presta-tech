import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  resetPassword,
  type CreateUsuarioRequest,
  type UpdateUsuarioRequest } from '@/api/usuarios.api';

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
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
