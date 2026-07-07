export interface Ruta {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activa?: boolean;
  empresaId: string;
  usuarioId: string;
  usuario?: {
    id: string;
    nombre: string;
  };
  clientes?: { id: string }[];
  createdAt?: string;
}

export interface RutaCliente {
  id: string;
  orden: number;
  observacion?: string | null;
  visitadoHoy: boolean;
  ultimaVisita?: string | null;
  fechaRuta?: string | null;
  rutaId: string;
  clienteId: string;
  cliente?: {
    id: string;
    nombre: string;
    apellido?: string | null;
    telefono?: string | null;
    celular?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    coordsAproximadas?: boolean;
    provincia?: string | null;
    municipio?: string | null;
    sector?: string | null;
    direccion?: string | null;
  };
}

export interface ProximaCuota {
  id: string;
  numero: number;
  monto: number;
  mora: number;
  total: number;
  fechaVencimiento: string;
  vencida: boolean;
  frecuencia: string;
}

export interface PrestamoVistaDia {
  id: string;
  monto: number;
  saldo: number;
  estado: string;
  frecuencia: string;
  cuotasPendientes: number;
  proximaCuota: ProximaCuota | null;
}

export interface CuotaAVencer {
  prestamoId: string;
  cuotaId: string;
  numero: number;
  monto: number;
  mora: number;
  total: number;
  fechaVencimiento: string;
  vencida: boolean;
  frecuencia: string;
}

export interface ClienteVistaDia {
  rutaClienteId: string;
  orden: number;
  observacion?: string | null;
  visitadoHoy: boolean;
  ultimaVisita?: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    telefono?: string | null;
    celular?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    coordsAproximadas?: boolean;
    provincia?: string | null;
    municipio?: string | null;
    sector?: string | null;
    direccion?: string | null;
  };
  prestamos: PrestamoVistaDia[];
  cuotasAVencer: CuotaAVencer[];
  debeVisitar: boolean;
  tieneAtrasados: boolean;
  tienePrestamos: boolean;
  totalACobrar: number;
}

export interface ResumenVistaDia {
  totalClientes: number;
  aVisitarHoy: number;
  visitadosHoy: number;
  conAtrasados: number;
  totalACobrarHoy: number;
}

export interface VistaDiaResponse {
  rutaId: string;
  fecha: string;
  esSubRuta: boolean;
  clientes: ClienteVistaDia[];
  resumen: ResumenVistaDia;
}

export interface CreateRutaRequest {
  nombre: string;
  descripcion?: string;
}

export interface UpdateRutaRequest {
  nombre?: string;
  descripcion?: string;
  activa?: boolean;
}

export interface AddClienteRutaRequest {
  clienteId: string;
  observacion?: string;
}

export interface ReordenRequest {
  orden: { id: string; orden: number }[];
}

export interface GenerarDiaRequest {
  rutaClienteIds: string[];
  fecha: string;
}

export interface UsuarioEmpresa {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export interface ResumenRuta {
  rutaId: string;
  nombre: string;
  cobrador: string;
  clientesActivos: number;
  totalCobrado: number;
  totalInteres: number;
  capitalRecuperado: number;
  dineroEnCalle: number;
  prestamosActivos: number;
}

export interface TotalesRutas {
  totalCobrado: number;
  totalInteres: number;
  capitalRecuperado: number;
  dineroEnCalle: number;
  clientesActivos: number;
  prestamosActivos: number;
}

export interface ResumenRutasResponse {
  rutas: ResumenRuta[];
  totales: TotalesRutas;
  timestamp: string;
}
