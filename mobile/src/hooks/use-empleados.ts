import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as empleadosApi from '@/api/empleados.api';
import type { CreateEmpleadoDto, CrearDescuentoDto, RegistrarAsistenciaDto, RegistrarPagoDto, UpdateEmpleadoDto } from '@/types/empleados.types';

// ─── Empleados CRUD ───────────────────────────────────────────
export function useEmpleados(inactivos = false) {
  return useQuery({
    queryKey: ['empleados', { inactivos }],
    queryFn: () => empleadosApi.getEmpleados(inactivos),
  });
}

export function useEmpleadosResumen() {
  return useQuery({
    queryKey: ['empleados', 'resumen'],
    queryFn: empleadosApi.getEmpleadosResumen,
  });
}

export function useCrearEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmpleadoDto) => empleadosApi.crearEmpleado(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empleados'] }); },
  });
}

export function useActualizarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmpleadoDto }) =>
      empleadosApi.actualizarEmpleado(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empleados'] }); },
  });
}

export function useDesactivarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => empleadosApi.desactivarEmpleado(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empleados'] }); },
  });
}

export function useReactivarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => empleadosApi.reactivarEmpleado(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['empleados'] }); },
  });
}

// ─── Asistencia ───────────────────────────────────────────────
export function useAsistencia(fecha: string) {
  return useQuery({
    queryKey: ['empleados', 'asistencia', fecha],
    queryFn: () => empleadosApi.getAsistencia(fecha),
  });
}

export function useRegistrarAsistencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegistrarAsistenciaDto) => empleadosApi.registrarAsistencia(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados', 'asistencia'] });
      queryClient.invalidateQueries({ queryKey: ['empleados', 'resumen'] });
    },
  });
}

// ─── Pagos ────────────────────────────────────────────────────
export function usePagos(empleadoId?: string) {
  return useQuery({
    queryKey: ['empleados', 'pagos', { empleadoId }],
    queryFn: () => empleadosApi.getPagos(empleadoId),
  });
}

export function useRegistrarPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegistrarPagoDto) => empleadosApi.registrarPago(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados', 'pagos'] });
      queryClient.invalidateQueries({ queryKey: ['empleados', 'resumen'] });
    },
  });
}

// ─── Descuentos ───────────────────────────────────────────────
export function useDescuentos(empleadoId: string) {
  return useQuery({
    queryKey: ['empleados', 'descuentos', empleadoId],
    queryFn: () => empleadosApi.getDescuentos(empleadoId),
    enabled: !!empleadoId,
  });
}

export function useCrearDescuento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CrearDescuentoDto) => empleadosApi.crearDescuento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados', 'descuentos'] });
      queryClient.invalidateQueries({ queryKey: ['empleados', 'resumen'] });
    },
  });
}

export function useEliminarDescuento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => empleadosApi.eliminarDescuento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empleados', 'descuentos'] });
      queryClient.invalidateQueries({ queryKey: ['empleados', 'resumen'] });
    },
  });
}
