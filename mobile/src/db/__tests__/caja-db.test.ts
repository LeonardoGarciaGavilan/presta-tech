jest.mock('@/db/index', () => {
  if (!(global as any).__mockDbStores) {
    (global as any).__mockDbStores = new Map();
  }
  const stores = (global as any).__mockDbStores;

  function getStore(table: any) {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table);
  }

  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: () => ({
            get: () => getStore(table)[0] ?? null,
            all: () => getStore(table),
          }),
          all: () => getStore(table),
        }),
      }),
      insert: (table: any) => ({
        values: (data: any) => ({
          onConflictDoUpdate: () => ({
            run: () => {
              const s = getStore(table);
              const idx = s.findIndex((r: any) => r.id === data.id);
              if (idx >= 0) s[idx] = { ...s[idx], ...data };
              else s.push(data);
            },
          }),
          run: () => { getStore(table).push(data); },
        }),
      }),
      delete: (table: any) => ({
        where: () => ({ run: () => { getStore(table).length = 0; } }),
        run: () => { getStore(table).length = 0; },
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: () => ({ run: () => { Object.assign(getStore(table)[0] || {}, data); } }),
        }),
      }),
    },
  };
});

import { saveCajaActiva, getCajaActivaCache } from '@/db/caja-db';

const mockCaja = {
  id: 'caja_1',
  estado: 'ABIERTA',
  montoInicial: 5000,
  fecha: '2025-01-10T00:00:00.000Z',
  horaApertura: '2025-01-10T08:00:00.000Z',
  totalIngresos: 0,
  totalEgresos: 0,
  cantidadMovimientos: 0,
  esOffline: true,
};

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
});

describe('caja-db (C2)', () => {
  it('persiste y lee la caja activa', () => {
    expect(getCajaActivaCache()).toBeNull();
    saveCajaActiva(mockCaja);
    expect(getCajaActivaCache()).toEqual(mockCaja);
  });

  it('actualiza la caja persistida en un solo renglón', () => {
    saveCajaActiva(mockCaja);
    saveCajaActiva({ ...mockCaja, montoInicial: 8000 });
    const caja = getCajaActivaCache();
    expect(caja?.montoInicial).toBe(8000);
  });

  it('saveCajaActiva(null) borra la caja persistida', () => {
    saveCajaActiva(mockCaja);
    saveCajaActiva(null);
    expect(getCajaActivaCache()).toBeNull();
  });
});
