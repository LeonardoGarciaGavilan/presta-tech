import client from './client';
import type {
  Ruta,
  VistaDiaResponse,
  CreateRutaRequest,
  UpdateRutaRequest,
  AddClienteRutaRequest,
  ReordenRequest,
  GenerarDiaRequest,
  UsuarioEmpresa,
  ResumenRutasResponse,
} from '@/types/rutas.types';

export type { Ruta };

const ENDPOINT = '/rutas';

export async function listarRutas(): Promise<Ruta[]> {
  const response = await client.get<Ruta[]>(ENDPOINT);
  return response.data;
}

export async function obtenerRuta(id: string): Promise<Ruta> {
  const response = await client.get<Ruta>(`${ENDPOINT}/${id}`);
  return response.data;
}

export async function crearRuta(data: CreateRutaRequest): Promise<Ruta> {
  const response = await client.post<Ruta>(ENDPOINT, data);
  return response.data;
}

export async function actualizarRuta(
  id: string,
  data: UpdateRutaRequest,
): Promise<Ruta> {
  const response = await client.patch<Ruta>(`${ENDPOINT}/${id}`, data);
  return response.data;
}

export async function eliminarRuta(id: string): Promise<void> {
  await client.delete(`${ENDPOINT}/${id}`);
}

export async function obtenerVistaDia(
  id: string,
  fecha: string,
): Promise<VistaDiaResponse> {
  const response = await client.get<VistaDiaResponse>(
    `${ENDPOINT}/${id}/dia`,
    { params: { fecha } },
  );
  return response.data;
}

export async function generarRutaDia(
  id: string,
  data: GenerarDiaRequest,
): Promise<void> {
  await client.post(`${ENDPOINT}/${id}/generar-dia`, data);
}

export async function marcarVisitado(rcId: string, visitado: boolean): Promise<void> {
  await client.patch(`${ENDPOINT}/clientes/${rcId}/visita`, { visitado });
}

export async function resetVisitados(): Promise<void> {
  await client.post(`${ENDPOINT}/reset-visitados`);
}

export async function agregarClienteRuta(
  id: string,
  data: AddClienteRutaRequest,
): Promise<void> {
  await client.post(`${ENDPOINT}/${id}/clientes`, data);
}

export async function actualizarClienteRuta(
  id: string,
  rcId: string,
  data: { observacion?: string; orden?: number },
): Promise<void> {
  await client.patch(`${ENDPOINT}/${id}/clientes/${rcId}`, data);
}

export async function quitarClienteRuta(
  id: string,
  rcId: string,
): Promise<void> {
  await client.delete(`${ENDPOINT}/${id}/clientes/${rcId}`);
}

export async function reordenarRuta(
  id: string,
  data: ReordenRequest,
): Promise<void> {
  await client.patch(`${ENDPOINT}/${id}/reordenar`, data);
}

export async function asignarUsuarioRuta(
  id: string,
  usuarioId: string,
): Promise<void> {
  await client.patch(`${ENDPOINT}/${id}/asignar-usuario`, { usuarioId });
}

export async function listarUsuarios(): Promise<UsuarioEmpresa[]> {
  const response = await client.get<UsuarioEmpresa[]>(
    `${ENDPOINT}/usuarios`,
  );
  return response.data;
}

export async function obtenerRutaCliente(
  clienteId: string,
): Promise<{ rutaId: string | null }> {
  const response = await client.get<{ rutaId: string | null }>(
    `${ENDPOINT}/cliente/${clienteId}`,
  );
  return response.data;
}

export async function asignarRuta(
  clienteId: string,
  rutaId: string | null,
): Promise<void> {
  await client.patch(`${ENDPOINT}/cliente/${clienteId}/asignar`, {
    rutaId,
  });
}

export async function obtenerResumenRutas(): Promise<ResumenRutasResponse> {
  const response = await client.get<ResumenRutasResponse>('/finanzas/rutas');
  return response.data;
}
