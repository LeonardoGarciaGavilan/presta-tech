import client from './client';
import type {
  Prestamo,
  CreatePrestamoRequest,
  CambiarEstadoDto,
  RefinanciarPrestamoDto,
  PrestamosFilters,
  PaginatedPrestamosResponse,
  PrestamoResumen,
  TablaAmortizacion,
} from '@/types/prestamo.types';

const ENDPOINT = '/prestamos';

export async function listar(
  filters?: PrestamosFilters,
): Promise<PaginatedPrestamosResponse> {
  const response = await client.get<PaginatedPrestamosResponse>(ENDPOINT, {
    params: filters,
  });
  return response.data;
}

export async function obtener(id: string): Promise<Prestamo> {
  const response = await client.get<Prestamo>(`${ENDPOINT}/${id}`);
  return response.data;
}

export async function crear(data: CreatePrestamoRequest): Promise<Prestamo> {
  const response = await client.post<Prestamo>(ENDPOINT, data);
  return response.data;
}

export async function actualizar(
  id: string,
  data: Partial<CreatePrestamoRequest>,
): Promise<Prestamo> {
  const response = await client.patch<Prestamo>(`${ENDPOINT}/${id}`, data);
  return response.data;
}

export async function cancelar(id: string): Promise<Prestamo> {
  const response = await client.patch<Prestamo>(`${ENDPOINT}/${id}/cancelar`);
  return response.data;
}

export async function cambiarEstado(
  id: string,
  data: CambiarEstadoDto,
): Promise<Prestamo> {
  const response = await client.patch<Prestamo>(
    `${ENDPOINT}/${id}/estado`,
    data,
  );
  return response.data;
}

export async function desembolsar(id: string): Promise<Prestamo> {
  const response = await client.patch<Prestamo>(
    `${ENDPOINT}/${id}/desembolsar`,
  );
  return response.data;
}

export async function refinanciar(
  id: string,
  data: RefinanciarPrestamoDto,
): Promise<Prestamo> {
  const response = await client.patch<Prestamo>(
    `${ENDPOINT}/${id}/refinanciar`,
    data,
  );
  return response.data;
}

export async function calcularTabla(
  monto: number,
  tasaInteres: number,
  numeroCuotas: number,
  frecuenciaPago: string,
  fechaInicio?: string,
): Promise<TablaAmortizacion> {
  const response = await client.get<TablaAmortizacion>(
    `${ENDPOINT}/calcular`,
    {
      params: {
        monto,
        tasaInteres,
        numeroCuotas,
        frecuenciaPago,
        fechaInicio,
      },
    },
  );
  return response.data;
}

export async function getResumen(): Promise<PrestamoResumen> {
  const response = await client.get<PrestamoResumen>(`${ENDPOINT}/resumen`);
  return response.data;
}

export async function getSolicitudes(): Promise<Prestamo[]> {
  const response = await client.get<Prestamo[]>(`${ENDPOINT}/solicitudes`);
  return response.data;
}
