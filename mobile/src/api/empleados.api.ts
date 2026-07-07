import client from './client';
import type {
  Empleado,
  CreateEmpleadoDto,
  UpdateEmpleadoDto,
  EmpleadosResumen,
  EmpleadoConAsistencia,
  RegistrarAsistenciaDto,
  PagoSalario,
  RegistrarPagoDto,
  DescuentoEmpleado,
  CrearDescuentoDto,
} from '@/types/empleados.types';

// ─── Empleados CRUD ───────────────────────────────────────────
export async function getEmpleados(inactivos = false): Promise<Empleado[]> {
  const response = await client.get<Empleado[]>('/empleados', {
    params: inactivos ? { inactivos: 'true' } : undefined,
  });
  return response.data;
}

export async function getEmpleadosResumen(): Promise<EmpleadosResumen> {
  const response = await client.get<EmpleadosResumen>('/empleados/resumen');
  return response.data;
}

export async function crearEmpleado(data: CreateEmpleadoDto): Promise<Empleado> {
  const response = await client.post<Empleado>('/empleados', data);
  return response.data;
}

export async function actualizarEmpleado(id: string, data: UpdateEmpleadoDto): Promise<Empleado> {
  const response = await client.patch<Empleado>(`/empleados/${id}`, data);
  return response.data;
}

export async function desactivarEmpleado(id: string): Promise<Empleado> {
  const response = await client.delete<Empleado>(`/empleados/${id}`);
  return response.data;
}

export async function reactivarEmpleado(id: string): Promise<Empleado> {
  const response = await client.patch<Empleado>(`/empleados/${id}/reactivar`);
  return response.data;
}

// ─── Asistencia ───────────────────────────────────────────────
export async function getAsistencia(fecha: string): Promise<EmpleadoConAsistencia[]> {
  const response = await client.get<EmpleadoConAsistencia[]>('/empleados/asistencia', {
    params: { fecha },
  });
  return response.data;
}

export async function registrarAsistencia(data: RegistrarAsistenciaDto): Promise<void> {
  await client.post('/empleados/asistencia', data);
}

// ─── Pagos ────────────────────────────────────────────────────
export async function getPagos(empleadoId?: string): Promise<PagoSalario[]> {
  const response = await client.get<PagoSalario[]>('/empleados/pagos', {
    params: empleadoId ? { empleadoId } : undefined,
  });
  return response.data;
}

export async function registrarPago(data: RegistrarPagoDto): Promise<void> {
  await client.post('/empleados/pagos', data);
}

// ─── Descuentos ───────────────────────────────────────────────
export async function getDescuentos(empleadoId: string): Promise<DescuentoEmpleado[]> {
  const response = await client.get<DescuentoEmpleado[]>(`/empleados/${empleadoId}/descuentos`);
  return response.data;
}

export async function crearDescuento(data: CrearDescuentoDto): Promise<void> {
  await client.post('/empleados/descuentos', data);
}

export async function eliminarDescuento(id: string): Promise<void> {
  await client.delete(`/empleados/descuentos/${id}`);
}
