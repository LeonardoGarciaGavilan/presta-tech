export type TipoUbicacion =
  | 'PROVINCIA'
  | 'MUNICIPIO'
  | 'DISTRITO_MUNICIPAL'
  | 'SECCION'
  | 'BARRIO'
  | 'SUB_BARRIO';

export interface NodoUbicacion {
  id: string;
  codigoOrigen: number;
  nombre: string;
  tipo: TipoUbicacion;
  padreId: string | null;
  unidadPadreId: string | null;
  provinciaId: string | null;
  municipioId: string | null;
  municipioNombre: string | null;
  orden: number;
}

export interface ConteosUbicaciones {
  provincias: number;
  municipios: number;
  distritos: number;
  secciones: number;
  barrios: number;
  subBarrios: number;
}

export interface UbicacionCatalogo {
  version: string;
  conteos: ConteosUbicaciones;
  provincias: NodoUbicacion[];
  municipios: NodoUbicacion[];
  distritos: NodoUbicacion[];
  secciones: NodoUbicacion[];
  barrios: NodoUbicacion[];
  subBarrios: NodoUbicacion[];
}

// Retrocompatibilidad: antes de la Fase 2 el picker recibía `string[]`; ahora
// acepta también objetos { label, value, badge } (los ids del catálogo RD).
export type OpcionPicker = string | { label: string; value: string; badge?: string };

// Etiqueta corta de cada tipo, usada como chip en los pickers.
export const PICKER_TIPO_BADGE: Record<TipoUbicacion, string> = {
  PROVINCIA: 'Provincia',
  MUNICIPIO: 'Municipio',
  DISTRITO_MUNICIPAL: 'Distrito',
  SECCION: 'Sección',
  BARRIO: 'Barrio',
  SUB_BARRIO: 'Sub-barrio',
};