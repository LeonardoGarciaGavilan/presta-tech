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
            limit: (n: number) => ({ all: () => getStore(table).slice(0, n) }),
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

import { insertPago, getPagosByPrestamoId, upsertPagos, clearPagos } from '@/db/pagos-db';

const mockPago = {
  id: 'pago_1',
  montoTotal: 3000,
  capital: 2500,
  interes: 500,
  mora: 0,
  metodo: 'EFECTIVO' as const,
  referencia: null,
  observacion: null,
  prestamoId: 'prestamo_1',
  usuarioId: 'user_1',
  cajaId: null,
  createdAt: '2025-01-08T00:00:00.000Z',
};

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
});

describe('insertPago', () => {
  it('inserts a new pago', () => {
    insertPago(mockPago);
    const pagos = getPagosByPrestamoId('prestamo_1');
    expect(pagos).toHaveLength(1);
    expect(pagos[0].id).toBe('pago_1');
  });

  it('upserts on conflict', () => {
    insertPago(mockPago);
    insertPago({ ...mockPago, montoTotal: 3500 });
    const pagos = getPagosByPrestamoId('prestamo_1');
    expect(pagos).toHaveLength(1);
    expect(pagos[0].montoTotal).toBe(3500);
  });
});

describe('getPagosByPrestamoId', () => {
  it('returns empty array when no pagos', () => {
    const pagos = getPagosByPrestamoId('no_existe');
    expect(pagos).toEqual([]);
  });

  it('returns pagos for the given prestamo', () => {
    insertPago(mockPago);
    insertPago({ ...mockPago, id: 'pago_2', montoTotal: 5000 });
    const pagos = getPagosByPrestamoId('prestamo_1');
    expect(pagos).toHaveLength(2);
  });
});

describe('upsertPagos', () => {
  it('inserts multiple pagos', () => {
    upsertPagos([mockPago, { ...mockPago, id: 'pago_2' }]);
    const pagos = getPagosByPrestamoId('prestamo_1');
    expect(pagos).toHaveLength(2);
  });

  it('does nothing for empty list', () => {
    upsertPagos([]);
    expect(getPagosByPrestamoId('prestamo_1')).toEqual([]);
  });
});

describe('clearPagos', () => {
  it('removes all pagos', () => {
    insertPago(mockPago);
    clearPagos();
    expect(getPagosByPrestamoId('prestamo_1')).toEqual([]);
  });
});
