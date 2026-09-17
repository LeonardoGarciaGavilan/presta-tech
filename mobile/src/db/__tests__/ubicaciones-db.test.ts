jest.mock('@/db/index', () => {
  if (!(global as any).__mockUbicacionesStores) {
    (global as any).__mockUbicacionesStores = new Map();
  }
  const stores = (global as any).__mockUbicacionesStores;

  function getStore(table: any) {
    const key = table?.name ?? table;
    if (!stores.has(key)) stores.set(key, []);
    return stores.get(key);
  }

  const db: any = {
    transaction: (cb: (tx: any) => void) => cb(db),
    select: () => ({
      from: (table: any) => {
        const chain: any = {
          _rows: getStore(table),
          where: () => chain,
          orderBy: () => chain,
          limit: () => chain,
          get: () => chain._rows[0] ?? null,
          all: () => chain._rows,
        };
        return chain;
      },
    }),
    insert: (table: any) => ({
      values: (data: any) => ({
        onConflictDoUpdate: () => ({
          run: () => {
            const s = getStore(table);
            const ids = Array.isArray(data) ? data.map((r: any) => r.id) : [data.id];
            for (let i = 0; i < (Array.isArray(data) ? data.length : 1); i++) {
              const idx = s.findIndex((r: any) => r.id === ids[i]);
              if (idx >= 0) {
                const item = Array.isArray(data) ? data[i] : data;
                s[idx] = { ...s[idx], ...item };
              } else {
                const item = Array.isArray(data) ? data[i] : data;
                s.push(item);
              }
            }
          },
        }),
        run: () => {
          const s = getStore(table);
          if (Array.isArray(data)) s.push(...data);
          else s.push(data);
        },
      }),
    }),
    delete: (table: any) => ({
      where: () => ({ run: () => { getStore(table).length = 0; } }),
      run: () => { getStore(table).length = 0; },
    }),
  };
  return { db };
});

import {
  syncUbicacionesToDb,
  getProvincias,
  getUnidades,
  getSectores,
  getUbicacionesVersion,
  getCatalogoDesdeDb,
  hayCatalogo,
  invalidarCacheUbicaciones,
} from '@/db/ubicaciones-db';
import type { NodoUbicacion, UbicacionCatalogo } from '@/types/ubicaciones.types';

function nodo(id: string, nombre: string, tipo: NodoUbicacion['tipo'], extra: Partial<NodoUbicacion> = {}): NodoUbicacion {
  return {
    id,
    codigoOrigen: 1,
    nombre,
    tipo,
    padreId: null,
    unidadPadreId: null,
    provinciaId: null,
    municipioId: null,
    municipioNombre: null,
    orden: 0,
    ...extra,
  };
}

const catalogo: UbicacionCatalogo = {
  version: 'abc123',
  conteos: { provincias: 2, municipios: 3, distritos: 1, secciones: 2, barrios: 2, subBarrios: 1 },
  provincias: [
    nodo('PROVINCIA:22', 'San Juan', 'PROVINCIA'),
    nodo('PROVINCIA:1', 'Azua', 'PROVINCIA'),
  ],
  municipios: [
    nodo('MUNICIPIO:2', 'Padre Las Casas', 'MUNICIPIO', { provinciaId: 'PROVINCIA:1' }),
    nodo('MUNICIPIO:1', 'Azua', 'MUNICIPIO', { provinciaId: 'PROVINCIA:1' }),
    nodo('MUNICIPIO:33', 'Bohechío', 'MUNICIPIO', { provinciaId: 'PROVINCIA:22' }),
  ],
  distritos: [
    nodo('DISTRITO_MUNICIPAL:1', 'Vegas Abajo', 'DISTRITO_MUNICIPAL', {
      provinciaId: 'PROVINCIA:1',
      unidadPadreId: 'MUNICIPIO:2',
      municipioNombre: 'Padre Las Casas',
    }),
  ],
  secciones: [
    nodo('SECCION:1', 'La Bombita', 'SECCION', { unidadPadreId: 'DISTRITO_MUNICIPAL:1' }),
    nodo('SECCION:2', 'Zona 1', 'SECCION', { unidadPadreId: 'MUNICIPIO:1' }),
  ],
  barrios: [
    nodo('BARRIO:1', 'El Naranjo', 'BARRIO', { unidadPadreId: 'MUNICIPIO:1' }),
    nodo('BARRIO:2', 'Buenos Aires', 'BARRIO', { unidadPadreId: 'DISTRITO_MUNICIPAL:1' }),
  ],
  subBarrios: [
    nodo('SUB_BARRIO:1', 'La Granja', 'SUB_BARRIO', { unidadPadreId: 'MUNICIPIO:1' }),
  ],
};

beforeEach(() => {
  const s = (global as any).__mockUbicacionesStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
  invalidarCacheUbicaciones();
});

describe('syncUbicacionesToDb', () => {
  it('persiste todas las filas y la versión', () => {
    syncUbicacionesToDb(catalogo);

    expect(getUbicacionesVersion()).toBe('abc123');
    expect(hayCatalogo()).toBe(true);
    expect(getProvincias().map((p) => p.nombre)).toEqual(['Azua', 'San Juan']);
    expect(getCatalogoDesdeDb()?.conteos).toEqual(catalogo.conteos);
  });

  it('misma versión ya sincronizada: no reescribe nada', () => {
    syncUbicacionesToDb(catalogo);
    syncUbicacionesToDb(catalogo);

    expect(getUbicacionesVersion()).toBe('abc123');
    expect(hayCatalogo()).toBe(true);
  });

  it('versión nueva: reemplaza el catálogo', () => {
    syncUbicacionesToDb(catalogo);
    syncUbicacionesToDb({ ...catalogo, version: 'def456' });

    expect(getUbicacionesVersion()).toBe('def456');
    expect(getCatalogoDesdeDb()?.version).toBe('def456');
  });
});

describe('getUnidades', () => {
  it('lista municipios primero y después distritos, A-Z', () => {
    syncUbicacionesToDb(catalogo);

    const unidades = getUnidades('PROVINCIA:1');
    expect(unidades.map((u) => [u.nombre, u.tipo])).toEqual([
      ['Azua', 'MUNICIPIO'],
      ['Padre Las Casas', 'MUNICIPIO'],
      ['Vegas Abajo', 'DISTRITO_MUNICIPAL'],
    ]);
  });

  it('no mezcla provincias distintas', () => {
    syncUbicacionesToDb(catalogo);
    expect(getUnidades('PROVINCIA:22')).toHaveLength(1);
  });
});

describe('getSectores', () => {
  it('ordena barrios, sub-barrios y secciones en ese orden', () => {
    syncUbicacionesToDb(catalogo);

    const sectores = getSectores('MUNICIPIO:1');
    expect(sectores.map((s) => s.nombre)).toEqual(['El Naranjo', 'La Granja', 'Zona 1']);
  });

  it('filtra por tipo (secciones de un distrito)', () => {
    syncUbicacionesToDb(catalogo);

    const secciones = getSectores('DISTRITO_MUNICIPAL:1', 'SECCION');
    expect(secciones.map((s) => s.nombre)).toEqual(['La Bombita']);
    const barrios = getSectores('DISTRITO_MUNICIPAL:1', 'BARRIO');
    expect(barrios.map((s) => s.nombre)).toEqual(['Buenos Aires']);
  });
});

describe('catálogo vacío', () => {
  it('hayCatalogo false y getCatalogoDesdeDb null sin datos', () => {
    expect(hayCatalogo()).toBe(false);
    expect(getCatalogoDesdeDb()).toBeNull();
  });
});