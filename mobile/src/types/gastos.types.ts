export interface Gasto {
  id: string;
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor: string | null;
  referencia: string | null;
  observaciones: string | null;
  tipo: 'OPERATIVO' | 'CAPITAL';
  usuario: { nombre: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateGastoDto {
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
  proveedor?: string;
  referencia?: string;
  observaciones?: string;
  tipo?: 'OPERATIVO' | 'CAPITAL';
}

export interface UpdateGastoDto {
  categoria?: string;
  descripcion?: string;
  monto?: number;
  fecha?: string;
  proveedor?: string;
  referencia?: string;
  observaciones?: string;
}

export interface GastosResumen {
  totalMes: number;
  totalAno: number;
  totalGral: number;
  porCategoria: Record<string, number>;
}

export interface GastosFilters {
  desde?: string;
  hasta?: string;
  categoria?: string;
}
