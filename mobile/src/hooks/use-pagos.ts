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
import { useNetworkContext } from '@/components/providers/network-provider';

export function useRegistrarPago() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (dto: CreatePagoDto) => {
      if (!network.isOnline) {
        const item = await addToOfflineQueue({
          endpoint: '/pagos',
          method: 'POST',
          data: dto,
          queryKeys: [
            ['pagos'],
            ['pagos', 'resumen'],
            ['pagos', 'todos'],
            ['pagos', 'prestamo', dto.prestamoId],
            ['prestamos', dto.prestamoId],
            ['prestamos'],
            ['caja'],
          ],
          tempId: `pago_temp_${Date.now()}`,
          tempDisplay: {
            montoPagado: dto.montoPagado,
            metodo: dto.metodo,
          },
        });
        return {
          pago: {
            id: item.tempId,
            montoTotal: dto.montoPagado,
            capital: dto.montoPagado,
            interes: 0,
            mora: 0,
            metodo: dto.metodo,
            referencia: dto.referencia || null,
            observacion: dto.observacion || null,
            createdAt: new Date().toISOString(),
            usuarioId: '',
            prestamoId: dto.prestamoId,
            cajaId: null,
          },
          prestamo: {
            id: dto.prestamoId,
            monto: 0,
            saldoPendiente: 0,
          },
          cliente: {
            nombre: 'Pendiente de sincronización',
            apellido: '',
            cedula: '',
          },
          cuota: null,
          usuario: { nombre: '' },
          esOffline: true,
          pendingSync: true,
        };
      }
      return registrarPago(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
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
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({
      prestamoId,
      dto,
    }: {
      prestamoId: string;
      dto: SaldarPrestamoDto;
    }) => {
      if (!network.isOnline) {
        const item = await addToOfflineQueue({
          endpoint: `/pagos/saldar/${prestamoId}`,
          method: 'POST',
          data: dto,
          queryKeys: [
            ['prestamos', prestamoId],
            ['prestamos'],
            ['pagos', 'prestamo', prestamoId],
            ['pagos', 'resumen'],
            ['pagos', 'todos'],
            ['caja'],
          ],
          tempId: `saldar_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId,
            metodo: dto.metodo,
          },
        });
        return {
          cajaId: null,
          esperado: 0,
          montoCierre: 0,
          diferencia: 0,
          estado: 'PAGADO',
          esOffline: true,
          tempId: item.tempId,
        };
      }
      return saldarPrestamo(prestamoId, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
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
