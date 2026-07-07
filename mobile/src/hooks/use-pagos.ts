import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { registrarPago,
  obtenerPagos,
  obtenerPago,
  obtenerResumenPagos,
  saldarPrestamo,
  obtenerTodosPagos } from '@/api/pagos.api';
import type {
  CreatePagoDto,
  SaldarPrestamoDto,
} from '@/types/prestamo.types';

export function useRegistrarPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePagoDto) => registrarPago(dto),
    onSuccess: (_data) => {
      const prestamoId = _data?.pago?.prestamoId || _data?.prestamo?.id;
      if (prestamoId) {
        queryClient.invalidateQueries({ queryKey: ['prestamos', prestamoId] });
      }
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos', 'resumen'] });
      queryClient.invalidateQueries({ queryKey: ['pagos', 'todos'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
}

export function usePagosDePrestamo(prestamoId: string) {
  return useQuery({
    queryKey: ['pagos', 'prestamo', prestamoId],
    queryFn: () => obtenerPagos(prestamoId),
    enabled: !!prestamoId,
  });
}

export function usePago(id: string) {
  return useQuery({
    queryKey: ['pagos', id],
    queryFn: () => obtenerPago(id),
    enabled: !!id,
  });
}

export function useResumenPagos() {
  return useQuery({
    queryKey: ['pagos', 'resumen'],
    queryFn: () => obtenerResumenPagos(),
  });
}

export function useSaldarPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      prestamoId,
      dto,
    }: {
      prestamoId: string;
      dto: SaldarPrestamoDto;
    }) => saldarPrestamo(prestamoId, dto),
    onSuccess: (_data, { prestamoId }) => {
      queryClient.invalidateQueries({ queryKey: ['prestamos', prestamoId] });
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos', 'resumen'] });
      queryClient.invalidateQueries({ queryKey: ['pagos', 'todos'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
  });
}

export function useTodosPagos() {
  return useQuery({
    queryKey: ['pagos', 'todos'],
    queryFn: () => obtenerTodosPagos(),
  });
}
