import client from './client';

const ENDPOINT = '/pagos';

export interface PagoConPrestamo {
  id: string;
  montoTotal: number;
  capital: number;
  interes: number;
  mora: number;
  metodo: string;
  referencia: string | null;
  observacion: string | null;
  createdAt: string;
  usuarioId: string;
  prestamoId: string;
  cajaId: string | null;
  usuario?: { id: string; nombre: string };
  prestamo: {
    id: string;
    monto: number;
    saldoPendiente: number;
    cliente: {
      id: string;
      nombre: string;
      apellido: string | null;
      cedula: string;
    };
  };
}

export async function registrarPago(dto: {
  prestamoId: string;
  cuotaId?: string;
  montoPagado: number;
  metodo: string;
  referencia?: string;
  observacion?: string;
}) {
  const response = await client.post(ENDPOINT, dto);
  return response.data;
}

export async function obtenerPagos(prestamoId: string) {
  const response = await client.get(`${ENDPOINT}/prestamo/${prestamoId}`);
  return response.data;
}

export async function obtenerPago(id: string) {
  const response = await client.get(`${ENDPOINT}/${id}`);
  return response.data;
}

export async function obtenerResumenPagos() {
  const response = await client.get(`${ENDPOINT}/resumen`);
  return response.data;
}

export async function saldarPrestamo(
  prestamoId: string,
  dto: { metodo: string; referencia?: string; observacion?: string },
) {
  const response = await client.post(`${ENDPOINT}/saldar/${prestamoId}`, dto);
  return response.data;
}

export async function obtenerTodosPagos() {
  const response = await client.get(ENDPOINT);
  return response.data as PagoConPrestamo[];
}
