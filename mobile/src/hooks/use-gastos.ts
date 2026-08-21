import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as gastosApi from '@/api/gastos.api';
import { getNetworkStatus } from '@/hooks/use-network-status';
import type { CreateGastoDto, GastosFilters, UpdateGastoDto } from '@/types/gastos.types';

function assertOnline(): void {
  if (!getNetworkStatus().isOnline) {
    throw new Error('Operación no disponible sin conexión. Conéctate a internet para continuar.');
  }
}

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
    mutationFn: (data: CreateGastoDto) => {
      assertOnline();
      return gastosApi.crearGasto(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
    },
  });
}

export function useActualizarGasto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGastoDto }) => {
      assertOnline();
      return gastosApi.actualizarGasto(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
    },
  });
}

export function useEliminarGasto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      assertOnline();
      return gastosApi.eliminarGasto(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
    },
  });
}
