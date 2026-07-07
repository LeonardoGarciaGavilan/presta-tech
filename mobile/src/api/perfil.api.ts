import client from './client';

export interface PerfilResponse {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    createdAt: string;
  };
  empresa: {
    nombre: string;
    activa: boolean;
  } | null;
}

export async function obtenerPerfil(): Promise<PerfilResponse> {
  const response = await client.get<PerfilResponse>('/perfil');
  return response.data;
}

export interface ActualizarNombreRequest {
  nombre: string;
}

export async function actualizarNombre(data: ActualizarNombreRequest): Promise<void> {
  await client.put('/perfil', data);
}

export interface CambiarPasswordRequest {
  passwordActual: string;
  passwordNuevo: string;
}

export async function cambiarPassword(data: CambiarPasswordRequest): Promise<void> {
  await client.patch('/perfil/password', data);
}

export interface ActualizarEmpresaRequest {
  nombre: string;
}

export async function actualizarEmpresa(data: ActualizarEmpresaRequest): Promise<void> {
  await client.put('/perfil/empresa', data);
}
