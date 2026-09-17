import type { NodoUbicacion, TipoUbicacion, UbicacionCatalogo } from '@/types/ubicaciones.types';
import { db } from './index';
import { ubicaciones } from './schema';
import { getSyncMeta, setSyncMeta } from './sync-meta-db';

const KEY_UBICACIONES_VERSION = 'ubicaciones_version';
const INSERT_CHUNK = 500;

type FilaUbicacion = typeof ubicaciones.$inferSelect;

function filaToNodo(fila: FilaUbicacion): NodoUbicacion {
  return {
    id: fila.id,
    codigoOrigen: fila.codigoOrigen,
    nombre: fila.nombre,
    tipo: fila.tipo as TipoUbicacion,
    padreId: fila.padreId,
    unidadPadreId: fila.unidadPadreId,
    provinciaId: fila.provinciaId,
    municipioId: fila.municipioId,
    municipioNombre: fila.municipioNombre,
    orden: fila.orden,
  };
}

function nodoToFila(nodo: NodoUbicacion) {
  return {
    id: nodo.id,
    codigoOrigen: nodo.codigoOrigen,
    nombre: nodo.nombre,
    tipo: nodo.tipo,
    padreId: nodo.padreId,
    unidadPadreId: nodo.unidadPadreId,
    provinciaId: nodo.provinciaId,
    municipioId: nodo.municipioId,
    municipioNombre: nodo.municipioNombre,
    orden: nodo.orden,
  };
}

// El catálogo es de solo lectura durante la sesión: se carga una vez desde
// SQLite y se cachea en memoria. `syncUbicacionesToDb` invalida el caché.
let cache: { filas: NodoUbicacion[]; version: string } | null = null;

function snapshot(): { filas: NodoUbicacion[]; version: string } {
  if (cache) return cache;
  const filas = db.select().from(ubicaciones).all().map(filaToNodo);
  cache = { filas, version: getUbicacionesVersion() };
  return cache;
}

export function invalidarCacheUbicaciones(): void {
  cache = null;
}

function compararNombres(a: string, b: string): number {
  return a.localeCompare(b, 'es');
}

export function getUbicacionesVersion(): string {
  return getSyncMeta(KEY_UBICACIONES_VERSION) ?? '';
}

function setUbicacionesVersion(version: string): void {
  setSyncMeta(KEY_UBICACIONES_VERSION, version);
  invalidarCacheUbicaciones();
}

export function hayCatalogo(): boolean {
  return snapshot().filas.length > 0;
}

export function getProvincias(): NodoUbicacion[] {
  return snapshot()
    .filas.filter((f) => f.tipo === 'PROVINCIA')
    .sort((a, b) => compararNombres(a.nombre, b.nombre));
}

export interface OpcionUnidad {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
  municipioNombre: string | null;
}

// Municipios y distritos municipales de una provincia, juntos y A-Z. Los
// distritos se listan con su nodo (se eligen aparte de su municipio cabecera).
export function getUnidades(provinciaId: string): OpcionUnidad[] {
  return snapshot()
    .filas.filter(
      (f) =>
        f.provinciaId === provinciaId &&
        (f.tipo === 'MUNICIPIO' || f.tipo === 'DISTRITO_MUNICIPAL'),
    )
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'MUNICIPIO' ? -1 : 1;
      return compararNombres(a.nombre, b.nombre);
    })
    .map((f) => ({
      id: f.id,
      nombre: f.nombre,
      tipo: f.tipo,
      municipioNombre: f.municipioNombre,
    }));
}

export interface OpcionSector {
  id: string;
  nombre: string;
  tipo: TipoUbicacion;
}

// Orden del picker de sector: barrios primero, luego sub-barrios, luego
// secciones. Las secciones son unidades censales (no división en sector real).
const ORDEN_SECTOR: Record<TipoUbicacion, number> = {
  BARRIO: 0,
  SUB_BARRIO: 1,
  SECCION: 2,
  PROVINCIA: 3,
  MUNICIPIO: 3,
  DISTRITO_MUNICIPAL: 3,
};

export function getSectores(unidadId: string, tipo?: TipoUbicacion): OpcionSector[] {
  return snapshot()
    .filas.filter(
      (f) => f.unidadPadreId === unidadId && (tipo ? f.tipo === tipo : true),
    )
    .sort((a, b) => {
      const oa = ORDEN_SECTOR[a.tipo] ?? 3;
      const ob = ORDEN_SECTOR[b.tipo] ?? 3;
      if (oa !== ob) return oa - ob;
      return compararNombres(a.nombre, b.nombre);
    })
    .map((f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo }));
}

// Reconstruye el catálogo desde SQLite para servir de fallback offline del
// hook (misma forma que GET /ubicaciones/catalogo).
export function getCatalogoDesdeDb(): UbicacionCatalogo | null {
  const { filas, version } = snapshot();
  if (filas.length === 0) return null;
  const de = (tipo: TipoUbicacion) => filas.filter((f) => f.tipo === tipo);
  return {
    version,
    conteos: {
      provincias: de('PROVINCIA').length,
      municipios: de('MUNICIPIO').length,
      distritos: de('DISTRITO_MUNICIPAL').length,
      secciones: de('SECCION').length,
      barrios: de('BARRIO').length,
      subBarrios: de('SUB_BARRIO').length,
    },
    provincias: de('PROVINCIA'),
    municipios: de('MUNICIPIO'),
    distritos: de('DISTRITO_MUNICIPAL'),
    secciones: de('SECCION'),
    barrios: de('BARRIO'),
    subBarrios: de('SUB_BARRIO'),
  };
}

// Reemplaza el catálogo local. Si la versión ya está sincronizada no
// reescribe nada (la tabla es estática; el reescrito solo ocurre cuando el
// servidor cambia su versión). La escritura es transaccional: si falla a
// medias se revierte y se conserva el catálogo anterior.
export function syncUbicacionesToDb(catalogo: UbicacionCatalogo): void {
  const versionLocal = getUbicacionesVersion();
  if (versionLocal === catalogo.version && hayCatalogo()) return;

  const filas = [
    catalogo.provincias,
    catalogo.municipios,
    catalogo.distritos,
    catalogo.secciones,
    catalogo.barrios,
    catalogo.subBarrios,
  ].flat();

  db.transaction((tx) => {
    tx.delete(ubicaciones).run();
    for (let i = 0; i < filas.length; i += INSERT_CHUNK) {
      tx.insert(ubicaciones).values(filas.slice(i, i + INSERT_CHUNK).map(nodoToFila)).run();
    }
  });

  setUbicacionesVersion(catalogo.version);
  invalidarCacheUbicaciones();
}