import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as gastosApi from '@/api/gastos.api';
import type { CreateGastoDto, GastosFilters, UpdateGastoDto } from '@/types/gastos.types';

export function useGastos(filters?: GastosFilters) {
  return useQuery({
    queryKey: ['gastos', filters],
    queryFn: () => gastosApi.getGastos(filters),
  });
}

export function useGastosResumen() {
  return useQuery({
    queryKey: ['gastos', 'resumen'],
    queryFn: gastosApi.getGastosResumen,
  });
}

export function useCrearGasto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGastoDto) => gastosApi.crearGasto(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
    },
  });
}

export function useActualizarGasto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGastoDto }) =>
      gastosApi.actualizarGasto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
    },
  });
}

export function useEliminarGasto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gastosApi.eliminarGasto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
    },
  });
}
