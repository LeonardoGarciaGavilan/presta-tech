import client from './client';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'EMPLEADO';
  activo: boolean;
  debeCambiarPassword: boolean;
  createdAt: string;
}

export interface CreateUsuarioRequest {
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'EMPLEADO';
}

export interface CreateUsuarioResponse extends Usuario {
  passwordTemporal: string;
  mensaje: string;
}

export interface UpdateUsuarioRequest {
  nombre?: string;
  rol?: 'ADMIN' | 'EMPLEADO';
  activo?: boolean;
}

export interface ResetPasswordResponse {
  mensaje: string;
  passwordTemporal: string;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const response = await client.get<Usuario[]>('/usuarios');
  return response.data;
}

export async function crearUsuario(data: CreateUsuarioRequest): Promise<CreateUsuarioResponse> {
  const response = await client.post<CreateUsuarioResponse>('/usuarios', data);
  return response.data;
}

export async function actualizarUsuario(id: string, data: UpdateUsuarioRequest): Promise<Usuario> {
  const response = await client.put<Usuario>(`/usuarios/${id}`, data);
  return response.data;
}

export async function resetPassword(id: string): Promise<ResetPasswordResponse> {
  const response = await client.patch<ResetPasswordResponse>(`/usuarios/${id}/reset-password`);
  return response.data;
}
