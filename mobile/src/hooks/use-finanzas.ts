import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as finanzasApi from '@/api/finanzas.api';
import type { CreateInyeccionDto, CreateRetiroDto } from '@/types/finanzas.types';

export function useDashboard() {
  return useQuery({
    queryKey: ['finanzas', 'dashboard'],
    queryFn: finanzasApi.getDashboard,
  });
}

export function useMovimientos(limite = 50) {
  return useQuery({
    queryKey: ['finanzas', 'movimientos', limite],
    queryFn: () => finanzasApi.getMovimientos(limite),
  });
}

export function useBalance() {
  return useQuery({
    queryKey: ['finanzas', 'balance'],
    queryFn: finanzasApi.getBalance,
  });
}

export function useCapital() {
  return useQuery({
    queryKey: ['finanzas', 'capital'],
    queryFn: finanzasApi.getCapital,
  });
}

export function useCapitalRetirable() {
  return useQuery({
    queryKey: ['finanzas', 'capital-retirable'],
    queryFn: finanzasApi.getCapitalRetirable,
  });
}

export function useGananciasDisponibles() {
  return useQuery({
    queryKey: ['finanzas', 'ganancias-disponibles'],
    queryFn: finanzasApi.getGananciasDisponibles,
  });
}

export function useCrearInyeccion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInyeccionDto) => finanzasApi.crearInyeccion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
    },
  });
}

export function useCrearRetiroGanancias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRetiroDto) => finanzasApi.crearRetiroGanancias(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
    },
  });
}

export function useRetirarCapital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRetiroDto) => finanzasApi.retirarCapital(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finanzas'] });
    },
  });
}
