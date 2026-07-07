export interface Prestamo {
  id: string;
  monto: number;
  saldoPendiente: number;
  cuotaMensual: number;
  estado: string;
  fechaInicio: string;
  fechaVencimiento: string;
  tasaInteres?: number;
  numeroCuotas?: number;
  montoTotal?: number;
  moraAcumulada?: number;
  frecuenciaPago?: string;
  cuotas?: Array<{ monto: number; mora: number; numero?: number; fechaVencimiento?: string; capital?: number; interes?: number; pagada?: boolean }>;
  cliente?: { id: string; nombre: string; apellido?: string | null; cedula?: string };
}

export interface Garantia {
  id: string;
  monto: number;
  estado: string;
}

export interface RutaCliente {
  ruta: {
    nombre: string;
  };
}

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  cedula: string;
  telefono: string | null;
  celular: string | null;
  email: string | null;
  provincia: string | null;
  municipio: string | null;
  sector: string | null;
  direccion: string | null;
  ocupacion: string | null;
  empresaLaboral: string | null;
  ingresos: number | null;
  observaciones: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  empresaId: string;
  latitud: number | null;
  longitud: number | null;
  coordsAproximadas: boolean;
  cedulaFrontalPath: string | null;
  cedulaTraseraPath: string | null;
  prestamos?: Prestamo[];
  garantias?: Garantia[];
  rutaClientes?: RutaCliente[];
}

export interface CreateClienteRequest {
  nombre: string;
  cedula: string;
  apellido?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  provincia?: string;
  municipio?: string;
  sector?: string;
  direccion?: string;
  ocupacion?: string;
  empresaLaboral?: string;
  ingresos?: number;
  latitud?: number;
  longitud?: number;
  coordsAproximadas?: boolean;
}

export type UpdateClienteRequest = Partial<CreateClienteRequest>;

export interface ClientesFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedClientesResponse {
  data: Cliente[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface CuotaPendienteDetalle {
  numero: number;
  fechaVencimiento: string;
  monto: number;
  vencida: boolean;
}

export interface PagoEstadoCuenta {
  fecha: string;
  capital: number;
  interes: number;
  mora: number;
  total: number;
  metodo: string;
  cobrador: string;
}

export interface PrestamoEstadoCuenta {
  id: string;
  monto: number;
  saldo: number;
  moraAcumulada: number;
  tasaInteres: number;
  frecuencia: string;
  estado: string;
  fechaInicio: string;
  totalCuotas: number;
  cuotasPagadas: number;
  cuotasVencidas: number;
  proximaFecha: string;
  proximaMonto: number;
  cuotasPendientesDetalle: CuotaPendienteDetalle[];
  pagos: PagoEstadoCuenta[];
}

export interface EstadoCuentaResponse {
  cliente: {
    nombre: string;
    cedula: string;
    telefono: string;
    celular: string;
    email: string;
    provincia: string;
    municipio: string;
    sector: string;
    direccion: string;
    ocupacion: string;
  };
  totalPrestamos: number;
  prestamosActivos: number;
  totalPagado: number;
  totalSaldo: number;
  totalMora: number;
  fechaGenerado: string;
  prestamos: PrestamoEstadoCuenta[];
}
