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
          orderBy: () => ({ all: () => getStore(table) }),
        }),
      }),
      insert: (table: any) => ({
        values: (data: any) => ({
          onConflictDoUpdate: () => ({ run: () => {} }),
          run: () => { getStore(table).push(data); },
        }),
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: () => ({
            run: () => {
              const s = getStore(table);
              if (s.length > 0) Object.assign(s[0], data);
            },
          }),
        }),
      }),
      delete: (table: any) => ({
        where: () => ({ run: () => { getStore(table).length = 0; } }),
        run: () => { getStore(table).length = 0; },
      }),
    },
  };
});

import { addToQueue, getPagosPendientesDePrestamo, updateQueueItem } from '@/db/offline-queue-db';

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
});

describe('getPagosPendientesDePrestamo', () => {
  it('returns empty when the queue has no payment for the prestamo', () => {
    expect(getPagosPendientesDePrestamo('prestamo_1')).toEqual([]);
  });

  it('finds pending POST /pagos items for the prestamo', () => {
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_2', montoPagado: 1000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_2',
    });

    const result = getPagosPendientesDePrestamo('prestamo_1');
    expect(result).toHaveLength(1);
    expect(result[0].tempId).toBe('pago_temp_1');
  });

  it('finds pending saldar items for the prestamo by endpoint', () => {
    addToQueue({
      endpoint: '/pagos/saldar/prestamo_1',
      method: 'POST',
      data: { metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
    });

    expect(getPagosPendientesDePrestamo('prestamo_1')).toHaveLength(1);
    expect(getPagosPendientesDePrestamo('prestamo_9')).toHaveLength(0);
  });

  it('finds failed payment items too', () => {
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 500, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
    });
    const item = getPagosPendientesDePrestamo('prestamo_1')[0];
    updateQueueItem(item.id, {
      status: 'failed',
      lastError: 'Debes abrir tu caja antes de registrar pagos',
    });

    const result = getPagosPendientesDePrestamo('prestamo_1');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('failed');
    expect(result[0].lastError).toBe('Debes abrir tu caja antes de registrar pagos');
  });
});
