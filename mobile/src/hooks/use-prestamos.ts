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
    queryFn: () => obtener(id),
    enabled: !!id,
  });
}

export function useCrearPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePrestamoRequest) => crear(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useActualizarPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreatePrestamoRequest>;
    }) => actualizar(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useCancelarPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelar(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useCambiarEstadoPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: CambiarEstadoDto;
    }) => cambiarEstado(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useDesembolsarPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => desembolsar(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['prestamos', id], _data);
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useRefinanciarPrestamo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: RefinanciarPrestamoDto;
    }) => refinanciar(id, data),
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
