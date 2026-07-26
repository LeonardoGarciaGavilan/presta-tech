import { useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData } from '@tanstack/react-query';
import { listar,
  obtener,
  crear,
  actualizar,
  cancelar,
  cambiarEstado,
  desembolsar,
  refinanciar,
  calcularTabla,
  getResumen,
  getSolicitudes } from '@/api/prestamos.api';
import type {
  CreatePrestamoRequest,
  CambiarEstadoDto,
  RefinanciarPrestamoDto,
  PrestamosFilters,
} from '@/types/prestamo.types';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getPrestamoById } from '@/db/prestamos-db';
import { getNetworkStatus } from '@/hooks/use-network-status';

export function usePrestamos(filters?: PrestamosFilters) {
  return useQuery({
    queryKey: ['prestamos', filters],
    queryFn: () => listar(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePrestamo(id: string) {
  return useQuery({
    queryKey: ['prestamos', id],
    queryFn: async () => {
      try {
        return await obtener(id);
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getPrestamoById(id);
          if (local) return local;
        }
        throw new Error('Préstamo no encontrado');
      }
    },
    enabled: !!id,
  });
}

export function useCrearPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (data: CreatePrestamoRequest) => {
      if (!network.isOnline) {
        const tempId = `prestamo_temp_${Date.now()}`;
        await addToOfflineQueue({
          endpoint: '/prestamos',
          method: 'POST',
          data,
          queryKeys: [['prestamos'], ['clientes']],
          tempId,
          tempDisplay: {
            clienteNombre: data.clienteId,
            monto: data.monto,
            estado: 'SOLICITADO',
          },
        });
        return {
          id: tempId,
          ...data,
          estado: 'SOLICITADO',
          saldoPendiente: data.monto,
          esOffline: true,
        };
      }
      return crear(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useActualizarPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreatePrestamoRequest>;
    }) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/prestamos/${id}`,
          method: 'PATCH',
          data,
          queryKeys: [['prestamos', id], ['prestamos']],
          tempId: `update_prestamo_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId: id,
            cambios: Object.keys(data),
          },
        });
        queryClient.setQueryData(['prestamos', id], (old: any) => ({
          ...old,
          ...data,
        }));
        return { id, ...data, esOffline: true } as any;
      }
      return actualizar(id, data);
    },
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useCancelarPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/prestamos/${id}/cancelar`,
          method: 'PATCH',
          data: {},
          queryKeys: [['prestamos', id], ['prestamos']],
          tempId: `cancelar_prestamo_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId: id,
          },
        });
        queryClient.setQueryData(['prestamos', id], (old: any) => ({
          ...old,
          estado: 'CANCELADO',
        }));
        return { id, estado: 'CANCELADO', esOffline: true } as any;
      }
      return cancelar(id);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useCambiarEstadoPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CambiarEstadoDto;
    }) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/prestamos/${id}/estado`,
          method: 'PATCH',
          data,
          queryKeys: [['prestamos', id], ['prestamos']],
          tempId: `estado_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId: id,
            nuevoEstado: data.estado,
            motivo: data.motivo,
          },
        });
        queryClient.setQueryData(['prestamos', id], (old: any) => ({
          ...old,
          estado: data.estado,
        }));
        return { id, estado: data.estado, esOffline: true };
      }
      return cambiarEstado(id, data);
    },
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useDesembolsarPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/prestamos/${id}/desembolsar`,
          method: 'PATCH',
          data: {},
          queryKeys: [['prestamos', id], ['prestamos']],
          tempId: `desembolso_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId: id,
          },
        });
        queryClient.setQueryData(['prestamos', id], (old: any) => ({
          ...old,
          estado: 'ACTIVO',
        }));
        return { id, estado: 'ACTIVO', esOffline: true };
      }
      return desembolsar(id);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useRefinanciarPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: RefinanciarPrestamoDto;
    }) => {
      if (!network.isOnline) {
        await addToOfflineQueue({
          endpoint: `/prestamos/${id}/refinanciar`,
          method: 'PATCH',
          data,
          queryKeys: [['prestamos', id], ['prestamos']],
          tempId: `refinanciar_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId: id,
            nuevasCuotas: data.nuevasCuotas,
            nuevaTasa: data.nuevaTasa,
          },
        });
        queryClient.setQueryData(['prestamos', id], (old: any) => ({
          ...old,
          estado: 'REFINANCIADO',
        }));
        return { id, estado: 'REFINANCIADO', esOffline: true } as any;
      }
      return refinanciar(id, data);
    },
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useCalcularTabla() {
  return useMutation({
    mutationFn: ({
      monto,
      tasaInteres,
      numeroCuotas,
      frecuenciaPago,
      fechaInicio,
    }: {
      monto: number;
      tasaInteres: number;
      numeroCuotas: number;
      frecuenciaPago: string;
      fechaInicio?: string;
    }) => calcularTabla(monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio),
  });
}

export function useResumenPrestamos() {
  return useQuery({
    queryKey: ['prestamos', 'resumen'],
    queryFn: () => getResumen(),
  });
}

export function useSolicitudesPrestamos() {
  return useQuery({
    queryKey: ['prestamos', 'solicitudes'],
    queryFn: () => getSolicitudes(),
  });
}
