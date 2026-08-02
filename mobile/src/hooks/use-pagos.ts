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
  Pago,
} from '@/types/prestamo.types';
import { useNetworkContext } from '@/components/providers/network-provider';
import { insertPago } from '@/db/pagos-db';
import { aplicarPagoLocal, getPrestamoById, saldarPrestamoLocal } from '@/db/prestamos-db';
import { useAuthStore } from '@/store/auth.store';
import { getFechaRD } from '@/utils/formatters';

export function useRegistrarPago() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (dto: CreatePagoDto) => {
      if (!network.isOnline) {
        const usuarioId = useAuthStore.getState().user?.id || '';
        const prestamoLocal = getPrestamoById(dto.prestamoId);
        if (prestamoLocal && dto.montoPagado > prestamoLocal.saldoPendiente + 0.001) {
          throw new Error(
            `El monto del pago ($${dto.montoPagado.toLocaleString()}) excede el saldo pendiente ($${prestamoLocal.saldoPendiente.toLocaleString()}).`,
          );
        }
        const dtoConFecha = { ...dto, fecha: getFechaRD() };
        const tempId = `pago_temp_${Date.now()}`;
        const item = await addToOfflineQueue({
          endpoint: '/pagos',
          method: 'POST',
          data: dtoConFecha,
          queryKeys: [
            ['pagos'],
            ['pagos', 'resumen'],
            ['pagos', 'todos'],
            ['pagos', 'prestamo', dto.prestamoId],
            ['prestamos', dto.prestamoId],
            ['prestamos'],
            ['caja'],
          ],
          tempId,
          tempDisplay: {
            montoPagado: dto.montoPagado,
            metodo: dto.metodo,
          },
        });
        const now = new Date().toISOString();
        const distribucion = aplicarPagoLocal(dto.prestamoId, dto.cuotaId, dto.montoPagado);
        const syntheticPago: Pago = {
          id: tempId,
          montoTotal: dto.montoPagado,
          capital: distribucion.capital,
          interes: distribucion.interes,
          mora: distribucion.mora,
          metodo: dto.metodo,
          referencia: dto.referencia || null,
          observacion: dto.observacion || null,
          createdAt: now,
          usuarioId,
          prestamoId: dto.prestamoId,
          cajaId: null,
        };
        insertPago(syntheticPago);
        return {
          pago: syntheticPago,
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
        const dtoConFecha = { ...dto, fecha: getFechaRD() };
        const item = await addToOfflineQueue({
          endpoint: `/pagos/saldar/${prestamoId}`,
          method: 'POST',
          data: dtoConFecha,
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
        saldarPrestamoLocal(prestamoId);
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
