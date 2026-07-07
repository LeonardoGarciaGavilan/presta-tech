import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obtenerCajaActiva,
  abrirCaja,
  cerrarCaja,
  obtenerHistorialCajas,
  obtenerResumenCaja,
  obtenerAuditoriaCaja,
  obtenerCajas } from '@/api/caja.api';
import type { AbrirCajaDto, CerrarCajaDto } from '@/types/caja.types';

export function useCajaActiva(fecha?: string) {
  return useQuery({
    queryKey: ['caja', 'activa', fecha],
    queryFn: () => obtenerCajaActiva(fecha),
  });
}

export function useAbrirCaja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AbrirCajaDto) => abrirCaja(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja', 'activa'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'lista'] });
    },
  });
}

export function useCerrarCaja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CerrarCajaDto }) => cerrarCaja(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja', 'activa'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'lista'] });
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useHistorialCajas() {
  return useQuery({
    queryKey: ['caja', 'historial'],
    queryFn: () => obtenerHistorialCajas(),
  });
}

export function useResumenCaja(fecha?: string, cajaId?: string) {
  return useQuery({
    queryKey: ['caja', 'resumen', fecha, cajaId],
    queryFn: () => obtenerResumenCaja(fecha, cajaId),
  });
}

export function useAuditoriaCaja(id?: string) {
  return useQuery({
    queryKey: ['caja', 'auditoria', id],
    queryFn: () => obtenerAuditoriaCaja(id!),
    enabled: !!id,
  });
}

export function useCajas(estado?: string) {
  return useQuery({
    queryKey: ['caja', 'lista', estado],
    queryFn: () => obtenerCajas(estado),
  });
}
