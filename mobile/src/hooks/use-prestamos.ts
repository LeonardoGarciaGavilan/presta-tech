import { useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData } from '@tanstack/react-query';
import type { Prestamo } from '@/types/prestamo.types';
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
import { getPrestamoById, upsertPrestamos, getAllCachedPrestamos } from '@/db/prestamos-db';
import { getClienteNombre, getClienteById } from '@/db/clientes-db';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { useAuthStore } from '@/store/auth.store';

function clienteNombreDePrestamo(prestamoId: string): string | null {
  const prestamo = getPrestamoById(prestamoId);
  return prestamo?.clienteId ? getClienteNombre(prestamo.clienteId) : null;
}

export function usePrestamos(filters?: PrestamosFilters) {
  return useQuery({
    queryKey: ['prestamos', filters],
    queryFn: async () => {
      try {
        return await listar(filters);
      } catch {
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getAllCachedPrestamos();
          return {
            data: local,
            total: local.length,
            pagina: 1,
            porPagina: local.length,
            totalPaginas: 1,
          };
        }
        throw new Error('Error al cargar préstamos');
      }
    },
    placeholderData: keepPreviousData,
  });
}

export function usePrestamo(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['prestamos', id],
    queryFn: async () => {
      if (id.startsWith('prestamo_temp_')) {
        const cached = queryClient.getQueryData<Prestamo>(['prestamos', id]);
        if (cached) return cached;
        const local = getPrestamoById(id);
        if (local) {
          queryClient.setQueryData(['prestamos', id], local);
          return local;
        }
        throw new Error('Préstamo no encontrado');
      }
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
        const empresaId = useAuthStore.getState().user?.empresaId || '';
        const now = new Date().toISOString();
        const today = now.split('T')[0];
        await addToOfflineQueue({
          endpoint: '/prestamos',
          method: 'POST',
          data,
          queryKeys: [['prestamos'], ['clientes']],
          tempId,
          tempDisplay: {
            clienteNombre: getClienteNombre(data.clienteId),
            clienteCedula: getClienteById(data.clienteId)?.cedula,
            monto: data.monto,
            estado: 'SOLICITADO',
          },
        });
        const tempPrestamo: Prestamo = {
          id: tempId,
          clienteId: data.clienteId,
          monto: data.monto,
          tasaInteres: data.tasaInteres,
          numeroCuotas: data.numeroCuotas,
          montoTotal: data.montoTotal ?? data.monto,
          saldoPendiente: data.monto,
          cuotaMensual: 0,
          frecuenciaPago: data.frecuenciaPago,
          fechaInicio: data.fechaInicio || today,
          fechaVencimiento: today,
          moraAcumulada: 0,
          estado: 'SOLICITADO',
          refinanciado: false,
          vecesRefinanciado: 0,
          historialRefinanciamiento: null,
          motivoRechazo: null,
          solicitadoPor: null,
          aprobadoPor: null,
          fechaAprobacion: null,
          fechaDesembolso: null,
          modoRapido: data.modoRapido ?? false,
          createdAt: now,
          empresaId,
          garanteId: data.garanteId ?? null,
          cliente: { id: data.clienteId, nombre: '...', cedula: '...', apellido: null, telefono: null, celular: null },
          cuotas: [],
          pagos: [],
        };
        (tempPrestamo as any).esOffline = true;
        queryClient.setQueryData(['prestamos', tempId], tempPrestamo);
        upsertPrestamos([tempPrestamo]);
        return tempPrestamo;
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
            clienteNombre: clienteNombreDePrestamo(id),
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
            clienteNombre: clienteNombreDePrestamo(id),
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
            clienteNombre: clienteNombreDePrestamo(id),
          },
        });
        return { id, estado: data.estado, esOffline: true };
      }
      return cambiarEstado(id, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['prestamos', id] });
      const previous = queryClient.getQueryData(['prestamos', id]);
      queryClient.setQueryData(['prestamos', id], (old: any) => {
        if (!old) return old;
        return { ...old, estado: data.estado };
      });
      return { previous, id };
    },
    onSuccess: (_data, { id }) => {
      if (_data && !_data.esOffline) {
        queryClient.setQueryData(['prestamos', id], _data);
      }
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['prestamos', id], context.previous);
      }
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
            monto: getPrestamoById(id)?.monto,
            clienteNombre: clienteNombreDePrestamo(id),
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
            clienteNombre: clienteNombreDePrestamo(id),
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
