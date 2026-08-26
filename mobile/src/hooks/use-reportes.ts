import { useQuery } from '@tanstack/react-query';

import * as reportesApi from '@/api/reportes.api';
import type {
  CobrosFilters,
  CarteraFilters,
  EstadoFilters,
  CajasFilters,
  FlujoCajaFilters,
  DesempenoFilters,
  ProyeccionFilters,
} from '@/types/reportes.types';

export function useCobros(
  filters: CobrosFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'cobros', filters],
    queryFn: () => reportesApi.getCobros(filters),
    enabled,
  });
}

export function useCarteraVencida(
  filters?: CarteraFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'cartera-vencida', filters],
    queryFn: () => reportesApi.getCarteraVencida(filters),
    enabled,
  });
}

export function useEstadoGeneral(
  filters?: EstadoFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'estado-general', filters],
    queryFn: () => reportesApi.getEstadoGeneral(filters),
    enabled,
  });
}

export function useReporteCliente(
  clienteId: string | null,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'cliente', clienteId],
    queryFn: () => reportesApi.getReporteCliente(clienteId!),
    enabled: enabled && !!clienteId,
  });
}

export function useReporteCajas(
  filters: CajasFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'cajas', filters],
    queryFn: () => reportesApi.getReporteCajas(filters),
    enabled,
  });
}

export function useFlujoCaja(
  filters: FlujoCajaFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'flujo-caja', filters],
    queryFn: () => reportesApi.getFlujoCaja(filters),
    enabled,
  });
}

export function useDesempenoCobrador(
  filters?: DesempenoFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'desempeno-cobrador', filters],
    queryFn: () => reportesApi.getDesempenoCobrador(filters),
    enabled,
  });
}

export function useProyeccionCuotas(
  filters?: ProyeccionFilters,
  enabled = false,
) {
  return useQuery({
    queryKey: ['reportes', 'proyeccion-cuotas', filters],
    queryFn: () => reportesApi.getProyeccionCuotas(filters),
    enabled,
  });
}
