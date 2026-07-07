import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { obtenerConfiguracion,
  guardarConfiguracion,
  type UpsertConfiguracionRequest } from '@/api/configuracion.api';

export function useConfiguracion() {
  return useQuery({
    queryKey: ['configuracion'],
    queryFn: obtenerConfiguracion,
  });
}

export function useGuardarConfiguracion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertConfiguracionRequest) => guardarConfiguracion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion'] });
    },
  });
}
