export type FrecuenciaPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

export interface Empleado {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  cargo: string;
  departamento: string | null;
  salario: number;
  frecuenciaPago: FrecuenciaPago;
  fechaIngreso: string;
  activo: boolean;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmpleadoDto {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono?: string;
  celular?: string;
  email?: string;
  cargo: string;
  departamento?: string;
  salario: number;
  frecuenciaPago?: FrecuenciaPago;
  fechaIngreso: string;
  observaciones?: string;
}

export interface UpdateEmpleadoDto {
  nombre?: string;
  apellido?: string;
  cedula?: string;
  telefono?: string | null;
  celular?: string | null;
  email?: string | null;
  cargo?: string;
  departamento?: string | null;
  salario?: number;
  frecuenciaPago?: FrecuenciaPago;
  fechaIngreso?: string;
  observaciones?: string | null;
}

export interface EmpleadosResumen {
  totalEmpleados: number;
  nominalMensual: number;
  presentesHoy: number;
  ausentesHoy: number;
  descuentosPendientesMonto: number;
  descuentosPendientesCount: number;
  pagadoEsteMes: number;
  pagosMesCount: number;
}

// ─── Asistencia ───────────────────────────────────────────────
export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'TARDANZA' | 'MEDIO_DIA' | 'FERIADO' | 'VACACIONES';

export interface AsistenciaEmpleado {
  id: string;
  empleadoId: string;
  empresaId: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  horasTrabajadas: number | null;
  estado: EstadoAsistencia;
  observacion: string | null;
  createdAt: string;
}

export interface EmpleadoConAsistencia {
  empleado: Empleado;
  asistencia: AsistenciaEmpleado | null;
}

export interface RegistrarAsistenciaDto {
  empleadoId: string;
  fecha: string;
  entrada?: string;
  salida?: string;
  estado: EstadoAsistencia;
  observacion?: string;
}

// ─── Pagos ────────────────────────────────────────────────────
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE';

export interface PagoSalario {
  id: string;
  empleadoId: string;
  empresaId: string;
  periodo: string;
  descripcion: string | null;
  salarioBruto: number;
  totalDescuentos: number;
  salarioNeto: number;
  metodoPago: MetodoPago;
  referencia: string | null;
  fechaPago: string;
  observaciones: string | null;
  empleado: { nombre: string; apellido: string; cargo: string };
}

export interface RegistrarPagoDto {
  empleadoId: string;
  periodo: string;
  descripcion?: string;
  metodoPago: MetodoPago;
  referencia?: string;
  observaciones?: string;
  descuentoIds?: string[];
}

// ─── Descuentos ───────────────────────────────────────────────
export type TipoDescuento = 'TARDANZA' | 'AUSENCIA' | 'PRESTAMO' | 'OTRO';

export interface DescuentoEmpleado {
  id: string;
  empleadoId: string;
  empresaId: string;
  tipo: TipoDescuento;
  descripcion: string;
  monto: number;
  fecha: string;
  aplicado: boolean;
  createdAt: string;
}

export interface CrearDescuentoDto {
  empleadoId: string;
  tipo: TipoDescuento;
  descripcion: string;
  monto: number;
}
