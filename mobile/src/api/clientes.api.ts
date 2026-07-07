import client from './client';
import type {
  Cliente,
  CreateClienteRequest,
  UpdateClienteRequest,
  ClientesFilters,
  PaginatedClientesResponse,
  EstadoCuentaResponse,
} from '@/types/cliente.types';
import { TIMEOUTS } from '@/constants/api.constants';

const ENDPOINT = '/clientes';

export async function listar(
  filters?: ClientesFilters,
  inactivos?: boolean,
): Promise<PaginatedClientesResponse> {
  const endpoint = inactivos ? `${ENDPOINT}/inactivos` : ENDPOINT;
  const response = await client.get<PaginatedClientesResponse>(endpoint, {
    params: filters,
  });
  return response.data;
}

export async function obtener(id: string): Promise<Cliente> {
  const response = await client.get<Cliente>(`${ENDPOINT}/${id}`);
  return response.data;
}

export async function crear(
  data: CreateClienteRequest,
): Promise<Cliente> {
  const response = await client.post<Cliente>(ENDPOINT, data);
  return response.data;
}

export async function actualizar(
  id: string,
  data: UpdateClienteRequest,
): Promise<Cliente> {
  const response = await client.patch<Cliente>(`${ENDPOINT}/${id}`, data);
  return response.data;
}

export async function eliminar(id: string): Promise<Cliente> {
  const response = await client.delete<Cliente>(`${ENDPOINT}/${id}`);
  return response.data;
}

export async function getEstadoCuenta(id: string): Promise<EstadoCuentaResponse> {
  const response = await client.get<EstadoCuentaResponse>(`/reportes/cliente/${id}`);
  return response.data;
}

export async function uploadCedula(
  id: string,
  tipo: 'cedula-frontal' | 'cedula-trasera',
  fileUri: string,
): Promise<{ path: string; signedUrl: string; expiresAt: number }> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: 'image/jpeg',
    name: `${tipo}.jpg`,
  } as any);
  formData.append('tipo', tipo);

  const response = await client.post<{
    path: string;
    signedUrl: string;
    expiresAt: number;
  }>(`${ENDPOINT}/${id}/cedula`, formData, {
    timeout: TIMEOUTS.UPLOAD,
  });

  return response.data;
}

export async function getCedulaSignedUrl(
  id: string,
  tipo: 'cedula-frontal' | 'cedula-trasera',
): Promise<{ signedUrl: string; expiresAt: number }> {
  const response = await client.get<{
    signedUrl: string;
    expiresAt: number;
  }>(`${ENDPOINT}/${id}/cedula/signed-url`, {
    params: { tipo },
  });
  return response.data;
}

export async function reactivar(id: string): Promise<Cliente> {
  const response = await client.patch<Cliente>(`${ENDPOINT}/${id}/reactivar`);
  return response.data;
}
