import client from './client';
import { TIMEOUTS } from '@/constants/api.constants';
import type { UbicacionCatalogo } from '@/types/ubicaciones.types';

const ENDPOINT = '/ubicaciones';

export interface UbicacionesVersionResponse {
  version: string;
}

export async function getUbicacionesVersion(): Promise<UbicacionesVersionResponse> {
  const res = await client.get<UbicacionesVersionResponse>(`${ENDPOINT}/version`);
  return res.data;
}

// ~20,6k nodos viajan enteros: timeout generoso como el de upload.
export async function getUbicacionesCatalogo(): Promise<UbicacionCatalogo> {
  const res = await client.get<UbicacionCatalogo>(`${ENDPOINT}/catalogo`, {
    timeout: TIMEOUTS.UPLOAD,
  });
  return res.data;
}