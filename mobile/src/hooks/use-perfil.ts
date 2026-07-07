import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obtenerPerfil,
  actualizarNombre,
  cambiarPassword,
  actualizarEmpresa } from '@/api/perfil.api';
import { useAuthStore } from '@/store/auth.store';

export function usePerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: obtenerPerfil,
  });
}

export function useActualizarNombre() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: actualizarNombre,
    onSuccess: (_data, variables) => {
      if (user) {
        setUser({ ...user, nombre: variables.nombre });
      }
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
    },
  });
}

export function useCambiarPassword() {
  return useMutation({
    mutationFn: cambiarPassword,
  });
}

export function useActualizarEmpresa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: actualizarEmpresa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
    },
  });
}
