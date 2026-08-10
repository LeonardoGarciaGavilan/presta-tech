import client from './client';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'EMPLEADO';
  activo: boolean;
  debeCambiarPassword: boolean;
  permisos?: string[];
  permisosNegados?: string[];
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

export interface PermisosResponse {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: 'ADMIN' | 'EMPLEADO';
    activo: boolean;
  };
  base: string[];
  permisos: string[];
  permisosNegados: string[];
  modulos: string[];
  catalogo: string[];
}

export interface ActualizarPermisosRequest {
  permisos: string[];
  permisosNegados: string[];
}

export async function obtenerPermisos(id: string): Promise<PermisosResponse> {
  const response = await client.get<PermisosResponse>(`/usuarios/${id}/permisos`);
  return response.data;
}

export async function actualizarPermisos(
  id: string,
  data: ActualizarPermisosRequest,
): Promise<{ mensaje: string }> {
  const response = await client.put<{ mensaje: string }>(`/usuarios/${id}/permisos`, data);
  return response.data;
}
