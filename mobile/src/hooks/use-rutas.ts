import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';

import * as rutasApi from '@/api/rutas.api';
import type {
  CreateRutaRequest,
  UpdateRutaRequest,
  AddClienteRutaRequest,
  ReordenRequest,
  GenerarDiaRequest,
} from '@/types/rutas.types';

export function useRutas() {
  return useQuery({
    queryKey: ['rutas'],
    queryFn: rutasApi.listarRutas,
  });
}

export function useRuta(id: string) {
  return useQuery({
    queryKey: ['rutas', id],
    queryFn: () => rutasApi.obtenerRuta(id),
    enabled: !!id,
  });
}

export function useVistaDia(id: string, fecha: string) {
  return useQuery({
    queryKey: ['rutas', id, 'dia', fecha],
    queryFn: () => rutasApi.obtenerVistaDia(id, fecha),
    enabled: !!id && !!fecha,
    placeholderData: keepPreviousData,
  });
}

export function useCrearRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRutaRequest) => rutasApi.crearRuta(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useActualizarRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateRutaRequest;
    }) => rutasApi.actualizarRuta(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useEliminarRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rutasApi.eliminarRuta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useMarcarVisitado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rcId, visitado }: { rcId: string; visitado: boolean }) =>
      rutasApi.marcarVisitado(rcId, visitado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useResetVisitados() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => rutasApi.resetVisitados(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useGenerarDia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerarDiaRequest) =>
      rutasApi.generarRutaDia(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id, 'dia'] });
    },
  });
}

export function useAgregarClienteRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddClienteRutaRequest) =>
      rutasApi.agregarClienteRuta(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
    },
  });
}

export function useQuitarClienteRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rcId: string) => rutasApi.quitarClienteRuta(id, rcId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
    },
  });
}

export function useReordenarRuta(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReordenRequest) => rutasApi.reordenarRuta(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas', id] });
    },
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['rutas', 'usuarios'],
    queryFn: rutasApi.listarUsuarios,
  });
}

export function useAsignarUsuarioRuta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rutaId,
      usuarioId,
    }: {
      rutaId: string;
      usuarioId: string;
    }) => rutasApi.asignarUsuarioRuta(rutaId, usuarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
    },
  });
}

export function useResumenRutas() {
  return useQuery({
    queryKey: ['rutas', 'resumen'],
    queryFn: rutasApi.obtenerResumenRutas,
  });
}
