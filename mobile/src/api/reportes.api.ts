import client from './client';
import type {
  CobrosResponse,
  CobrosFilters,
  CarteraVencidaResponse,
  CarteraFilters,
  EstadoGeneralResponse,
  EstadoFilters,
  ClienteReporteResponse,
  CajasResponse,
  CajasFilters,
  FlujoCajaResponse,
  FlujoCajaFilters,
  DesempenoCobradorResponse,
  DesempenoFilters,
  ProyeccionCuotasResponse,
  ProyeccionFilters,
} from '@/types/reportes.types';

export async function getCobros(
  filters: CobrosFilters,
): Promise<CobrosResponse> {
  const params: Record<string, string> = {
    desde: filters.desde,
    hasta: filters.hasta,
  };
  if (filters.provincia) params.provincia = filters.provincia;
  const response = await client.get<CobrosResponse>('/reportes/cobros', {
    params,
  });
  return response.data;
}

export async function getCarteraVencida(
  filters?: CarteraFilters,
): Promise<CarteraVencidaResponse> {
  const params: Record<string, string> = {};
  if (filters?.provincia) params.provincia = filters.provincia;
  const response = await client.get<CarteraVencidaResponse>(
    '/reportes/cartera-vencida',
    { params },
  );
  return response.data;
}

export async function getEstadoGeneral(
  filters?: EstadoFilters,
): Promise<EstadoGeneralResponse> {
  const params: Record<string, string> = {};
  if (filters?.provincia) params.provincia = filters.provincia;
  const response = await client.get<EstadoGeneralResponse>(
    '/reportes/estado-general',
    { params },
  );
  return response.data;
}

export async function getReporteCliente(
  clienteId: string,
): Promise<ClienteReporteResponse> {
  const response = await client.get<ClienteReporteResponse>(
    `/reportes/cliente/${clienteId}`,
  );
  return response.data;
}

export async function getReporteCajas(
  filters: CajasFilters,
): Promise<CajasResponse> {
  const params: Record<string, string> = {
    desde: filters.desde,
    hasta: filters.hasta,
  };
  if (filters.usuarioId) params.usuarioId = filters.usuarioId;
  const response = await client.get<CajasResponse>('/reportes/cajas', {
    params,
  });
  return response.data;
}

export async function getFlujoCaja(
  filters: FlujoCajaFilters,
): Promise<FlujoCajaResponse> {
  const params: Record<string, string> = {
    desde: filters.desde,
    hasta: filters.hasta,
  };
  if (filters.usuarioId) params.usuarioId = filters.usuarioId;
  const response = await client.get<FlujoCajaResponse>('/reportes/flujo-caja', {
    params,
  });
  return response.data;
}

export async function getDesempenoCobrador(
  filters?: DesempenoFilters,
): Promise<DesempenoCobradorResponse> {
  const params: Record<string, string> = {};
  if (filters?.desde) params.desde = filters.desde;
  if (filters?.hasta) params.hasta = filters.hasta;
  if (filters?.usuarioId) params.usuarioId = filters.usuarioId;
  const response = await client.get<DesempenoCobradorResponse>(
    '/reportes/desempeno-cobrador',
    { params },
  );
  return response.data;
}

export async function getProyeccionCuotas(
  filters?: ProyeccionFilters,
): Promise<ProyeccionCuotasResponse> {
  const params: Record<string, string> = {};
  if (filters?.provincia) params.provincia = filters.provincia;
  const response = await client.get<ProyeccionCuotasResponse>(
    '/reportes/proyeccion-cuotas',
    { params },
  );
  return response.data;
}
