import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAlertas,
  contarAlertas,
  marcarLeida,
  marcarTodasLeidas,
  type AlertasFilters } from '@/api/alertas.api';

export function useAlertas(filters?: AlertasFilters) {
  return useQuery({
    queryKey: ['alertas', filters],
    queryFn: () => getAlertas(filters),
  });
}

export function useContarAlertas() {
  return useQuery({
    queryKey: ['alertas', 'contador'],
    queryFn: contarAlertas,
    refetchInterval: 30_000,
  });
}

export function useMarcarLeida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertaId: string) => marcarLeida(alertaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      queryClient.invalidateQueries({ queryKey: ['alertas', 'contador'] });
    },
  });
}

export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: marcarTodasLeidas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      queryClient.invalidateQueries({ queryKey: ['alertas', 'contador'] });
    },
  });
}
