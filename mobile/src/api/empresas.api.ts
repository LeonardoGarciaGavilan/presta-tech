import client from './client';

export interface Empresa {
  id: string;
  nombre: string;
}

export async function getEmpresas(): Promise<Empresa[]> {
  const response = await client.get<Empresa[]>('/superadmin/empresas');
  return response.data;
}
