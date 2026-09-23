jest.mock('@/db/index', () => {
  if (!(global as any).__mockDbStores) {
    (global as any).__mockDbStores = new Map();
  }
  const stores = (global as any).__mockDbStores;

  function getStore(table: any) {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table);
  }

  const toCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_: string, l: string) => l.toUpperCase());

  function chunkText(x: any): string {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    if (Array.isArray(x.value)) return x.value.map(String).join('');
    return '';
  }

  // Evalúa condiciones SQL de drizzle (eq, like, lte, ne, and, or, inArray)
  // contra una fila del mock. Estructura real de cada nodo:
  //   binario:   ['', {name:col}, {value:[' = ']}, <valor>, '']
  //   inArray:   ['', {name:col}, {value:[' in ']}, {0:..,1:..}, '']
  //   and/or:    ['(', <nodo anidado>, ')']  donde el nodo anidado contiene
  //              los operandos como sub-chunks separados por ' and '/' or '.
  // Las filas usan claves JS (camelCase) mientras el SQL usa nombres de
  // columna (snake_case): se compara contra ambas.
  function evalCond(cond: any, row: any): boolean {
    if (cond == null) return true;
    const q = cond.queryChunks;
    if (!Array.isArray(q)) return true;

    const isSql = (c: any) => c && typeof c === 'object' && Array.isArray(c.queryChunks);
    const isCol = (c: any) => c && typeof c === 'object' && typeof c.name === 'string' && !isSql(c);

    const colIdx = q.findIndex(isCol);
    if (colIdx >= 0) {
      const col = q[colIdx].name;
      let op = '';
      let val: any;
      let hasVal = false;
      for (let i = colIdx + 1; i < q.length; i++) {
        const c = q[i];
        if (c == null) continue;
        if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
          val = c;
          hasVal = true;
          break;
        }
        if (Array.isArray(c)) {
          val = c;
          hasVal = true;
          break;
        }
        if (typeof c === 'object') {
          if (isSql(c)) {
            val = c;
            hasVal = true;
            break;
          }
          if (Array.isArray(c.value)) {
            const t = chunkText(c).trim();
            if (t) op += ' ' + t;
          } else if (Object.keys(c).some((k) => /^\d+$/.test(k))) {
            val = c;
            hasVal = true;
            break;
          } else if ('value' in c) {
            val = c.value;
            hasVal = true;
            break;
          }
        }
      }

      if (hasVal) {
        const rowVal = (row as any)[col] ?? (row as any)[toCamel(col)];
        op = op.trim();
        if (op === 'like') {
          const pat = String(val);
          if (pat === '%' || pat === '%%') return true;
          const needle = pat.replace(/^%/, '').replace(/%$/, '');
          return String(rowVal ?? '').includes(needle);
        }
        switch (op) {
          case '=':
            return rowVal === val;
          case '!=':
          case '<>':
            return rowVal !== val;
          case '<=':
            return rowVal <= val;
          case '>=':
            return rowVal >= val;
          case '<':
            return rowVal < val;
          case '>':
            return rowVal > val;
          default:
            return true;
        }
      }
      return true;
    }

    const parts = q.filter(isSql);
    if (parts.length > 0) {
      const results = parts.map((p: any) => evalCond(p, row));
      const allText = q.map(chunkText).join(' ');
      if (/ or /i.test(allText)) return results.some(Boolean);
      return results.every(Boolean);
    }
    return true;
  }

  function filterBy(cond: any, rows: any[]) {
    return cond ? rows.filter((r) => evalCond(cond, r)) : rows;
  }

  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: (cond: any) => {
            const filtered = (rows: any[]) => filterBy(cond, rows);
            return {
              get: () => filtered(getStore(table))[0] ?? null,
              all: () => filtered(getStore(table)),
              orderBy: () => ({ all: () => filtered(getStore(table)) }),
              limit: (n: number) => ({ all: () => filtered(getStore(table)).slice(0, n) }),
            };
          },
          all: () => getStore(table),
          orderBy: () => ({
            all: () => getStore(table),
            limit: () => ({ get: () => getStore(table)[0] ?? null }),
          }),
          groupBy: () => ({
            all: () => {
              const counts = new Map<string, number>();
              for (const r of getStore(table)) {
                const key = r.status ?? 'unknown';
                counts.set(key, (counts.get(key) ?? 0) + 1);
              }
              return [...counts.entries()].map(([status, count]) => ({
                status,
                count,
              }));
            },
          }),
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
          where: (cond: any) => ({
            run: () => {
              const s = filterBy(cond, getStore(table));
              for (const row of s) Object.assign(row, data);
              return { changes: s.length };
            },
          }),
        }),
      }),
      delete: (table: any) => ({
        where: (cond: any) => ({
          run: () => {
            const s = getStore(table);
            if (cond && Array.isArray(cond.queryChunks)) {
              const listChunk = cond.queryChunks.find(
                (c: any) =>
                  c &&
                  typeof c === 'object' &&
                  !Array.isArray(c.queryChunks) &&
                  !Array.isArray(c.value) &&
                  Object.keys(c).some((k) => /^\d+$/.test(k)),
              );
              if (listChunk) {
                const vals = new Set(
                  Object.keys(listChunk).map((k) => {
                    const v = listChunk[k];
                    return v && typeof v === 'object' && v.value !== undefined ? v.value : v;
                  }),
                );
                const op = cond.queryChunks.map(chunkText).join(' ');
                for (let i = s.length - 1; i >= 0; i--) {
                  if (/not in/i.test(op) && !vals.has(s[i].id)) s.splice(i, 1);
                  else if (/in\b/i.test(op) && vals.has(s[i].id)) s.splice(i, 1);
                }
                return;
              }
            }
            s.length = 0;
          },
        }),
        run: () => { getStore(table).length = 0; },
      }),
    },
  };
});

jest.mock('@/db/pagos-db', () => ({
  deletePago: jest.fn(),
}));

jest.mock('@/db/prestamos-db', () => ({
  upsertPrestamos: jest.fn(),
  deletePrestamo: jest.fn(),
}));

jest.mock('@/db/clientes-db', () => ({
  deleteCliente: jest.fn(),
}));

import { addToQueue, findDuplicate, getQueue, getPagosPendientesDePrestamo, isPaymentEndpoint, updateQueueItem, restoreSnapshot, clearFailedItems, markStaleAsFailed, getQueueStats, getQueueItemsReferencingTempId, recoverSyncingItems, discardExpiredItem } from '@/db/offline-queue-db';
import { upsertPrestamos, deletePrestamo } from '@/db/prestamos-db';
import { deletePago } from '@/db/pagos-db';
import { prestamos } from '@/db/schema';
import type { OfflineQueueItem } from '@/types/offline.types';

const mockUpsertPrestamos = upsertPrestamos as jest.Mock;
const mockDeletePago = deletePago as jest.Mock;
const mockDeletePrestamo = deletePrestamo as jest.Mock;

function makeItem(overrides: Partial<OfflineQueueItem> = {}): OfflineQueueItem {
  return {
    id: 'item_1',
    endpoint: '/pagos',
    method: 'POST',
    data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
    queryKeys: [['prestamos']],
    createdAt: Date.now(),
    retryCount: 0,
    status: 'failed',
    tempId: 'pago_temp_1',
    retryable: false,
    ...overrides,
  };
}

const prestamoSnapshot = {
  prestamo: {
    id: 'prestamo_1',
    saldoPendiente: 5000,
    monto: 10000,
    cuotas: [],
  },
};

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

describe('isPaymentEndpoint', () => {
  it('reconoce POST /pagos y /pagos/saldar/:id como endpoints de pago', () => {
    expect(isPaymentEndpoint('/pagos', 'POST')).toBe(true);
    expect(isPaymentEndpoint('/pagos/saldar/prestamo_1', 'POST')).toBe(true);
  });

  it('no reconoce como pago otros métodos o endpoints', () => {
    expect(isPaymentEndpoint('/pagos', 'GET')).toBe(false);
    expect(isPaymentEndpoint('/clientes', 'POST')).toBe(false);
    expect(isPaymentEndpoint('/prestamos', 'POST')).toBe(false);
  });
});

describe('dedupe: los pagos nunca se colapsan', () => {  const pagoData = { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' };

  it('findDuplicate devuelve null para endpoints de pago', () => {
    expect(findDuplicate('/pagos', 'POST', pagoData)).toBeNull();
    expect(findDuplicate('/pagos/saldar/prestamo_1', 'POST', pagoData)).toBeNull();
  });

  it('addToQueue encola dos pagos idénticos sin colapsarlos', () => {
    const first = addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: pagoData,
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    const second = addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: pagoData,
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_2',
    });

    expect(second.id).not.toBe(first.id);
    expect(getQueue()).toHaveLength(2);
  });

  it('sigue deduplicando creaciones de cliente con payload idéntico', () => {
    const data = { nombre: 'Juan', cedula: '001-0000001-1' };
    const first = addToQueue({
      endpoint: '/clientes',
      method: 'POST',
      data,
      queryKeys: [['clientes']],
      tempId: 'temp_1',
    });
    const second = addToQueue({
      endpoint: '/clientes',
      method: 'POST',
      data,
      queryKeys: [['clientes']],
      tempId: 'temp_2',
    });

    expect(second.id).toBe(first.id);
    expect(getQueue()).toHaveLength(1);
  });
});

describe('restoreSnapshot (C3)', () => {
  beforeEach(() => {
    mockUpsertPrestamos.mockClear();
  });

  it('restaura el préstamo del snapshot a través de upsertPrestamos', () => {
    restoreSnapshot(makeItem({ snapshot: prestamoSnapshot }));
    expect(mockUpsertPrestamos).toHaveBeenCalledWith([prestamoSnapshot.prestamo]);
  });

  it('es no-op si el item no tiene snapshot', () => {
    restoreSnapshot(makeItem({ snapshot: undefined }));
    expect(mockUpsertPrestamos).not.toHaveBeenCalled();
  });
});

describe('clearFailedItems (C3)', () => {
  beforeEach(() => {
    mockUpsertPrestamos.mockClear();
    mockDeletePago.mockClear();
  });

  it('restaura el snapshot y borra el pago sintético al limpiar un pago fallido', () => {
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
      snapshot: prestamoSnapshot,
    });
    updateQueueItem(getQueue()[0].id, {
      status: 'failed',
      retryable: false,
      lastError: 'Debes abrir tu caja antes de registrar pagos',
    });
    const failedItem = getQueue()[0];
    mockUpsertPrestamos.mockClear();

    const cleared = clearFailedItems([failedItem.id]);
    expect(cleared).toBe(1);
    expect(mockUpsertPrestamos).toHaveBeenCalledWith([prestamoSnapshot.prestamo]);
    expect(mockDeletePago).toHaveBeenCalledWith('pago_temp_1');
    expect(getQueue()).toHaveLength(0);
  });
});

describe('markStaleAsFailed (C3)', () => {
  beforeEach(() => {
    mockUpsertPrestamos.mockClear();
    mockDeletePago.mockClear();
  });

  it('marca como expired los items viejos de operaciones críticas, NO hace rollback', () => {
    // /pagos es una operación crítica -> debe marcarse como expired, NO failed
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
      snapshot: prestamoSnapshot,
    });
    const stores = (global as any).__mockDbStores;
    for (const [, arr] of stores) {
      if (arr[0]?.id === getQueue()[0].id) {
        arr[0].createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      }
    }
    mockUpsertPrestamos.mockClear();
    mockDeletePago.mockClear();

    const changed = markStaleAsFailed();
    expect(changed).toBe(1);
    expect(getQueue()[0].status).toBe('expired');
    expect(getQueue()[0].retryable).toBe(true);
    // NO debe llamar restoreSnapshot ni limpiarSinteticos para operaciones críticas
    expect(mockUpsertPrestamos).not.toHaveBeenCalled();
    expect(mockDeletePago).not.toHaveBeenCalled();
  });

  it('marca como failed los items viejos de operaciones no críticas, SÍ hace rollback', () => {
    // /clientes no es operación crítica -> debe marcarse como failed con rollback
    addToQueue({
      endpoint: '/clientes',
      method: 'POST',
      data: { nombre: 'Juan', cedula: '001-0000001-1' },
      queryKeys: [['clientes']],
      tempId: 'cliente_temp_1',
      snapshot: { prestamo: { id: 'prestamo_1', saldoPendiente: 5000 } },
    });
    const stores = (global as any).__mockDbStores;
    for (const [, arr] of stores) {
      if (arr[0]?.id === getQueue()[0].id) {
        arr[0].createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      }
    }
    mockUpsertPrestamos.mockClear();
    mockDeletePago.mockClear();

    const changed = markStaleAsFailed();
    expect(changed).toBe(1);
    expect(getQueue()[0].status).toBe('failed');
    expect(getQueue()[0].retryable).toBe(false);
    // SÍ debe llamar restoreSnapshot y limpiarSinteticos para operaciones no críticas
    expect(mockUpsertPrestamos).toHaveBeenCalled();
  });
});

describe('getQueueStats', () => {
  it('cola vacía: todo en cero y oldestAt null', () => {
    expect(getQueueStats()).toEqual({ pending: 0, failed: 0, expired: 0, total: 0, oldestAt: null });
  });

  it('cuenta pending/failed/expired/total y el item más antiguo', () => {
    addToQueue({
      endpoint: '/clientes',
      method: 'POST',
      data: { nombre: 'A' },
      queryKeys: [['clientes']],
      tempId: 'temp_1',
    });
    const first = getQueue()[0];
    updateQueueItem(first.id, { status: 'failed', retryable: false });
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    // El pago es operación crítica, si estuviera viejo sería 'expired', no 'failed'
    // Aquí lo forzamos a failed para testear el conteo
    const pagoId = getQueue().find((i) => i.endpoint === '/pagos')!.id;
    updateQueueItem(pagoId, { status: 'failed', retryable: false });

    const stats = getQueueStats();
    expect(stats.pending).toBe(0);
    expect(stats.failed).toBe(2);
    expect(stats.expired).toBe(0);
    expect(stats.total).toBe(2);
    expect(stats.oldestAt).toBe(first.createdAt);
  });

  it('cuenta items expirados correctamente', () => {
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    const pagoId = getQueue()[0].id;
    // Forzar estado expired
    updateQueueItem(pagoId, { status: 'expired', retryable: true });

    const stats = getQueueStats();
    expect(stats.pending).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.expired).toBe(1);
    expect(stats.total).toBe(1);
  });
});

describe('getQueueItemsReferencingTempId', () => {
  it('no-op con tempId vacío', () => {
    expect(getQueueItemsReferencingTempId('')).toEqual([]);
  });

  it('encuentra items cuyo data referencie el tempId', () => {
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO', pagoTempId: 'pago_temp_1' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_2', montoPagado: 1000, metodo: 'EFECTIVO', pagoTempId: 'pago_temp_2' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_2',
    });

    const result = getQueueItemsReferencingTempId('pago_temp_1');
    expect(result).toHaveLength(1);
    expect(result[0].tempId).toBe('pago_temp_1');
  });

  it('encuentra items cuyo endpoint referencie el tempId', () => {
    addToQueue({
      endpoint: '/prestamos/ref-prestamo_temp_9',
      method: 'PUT',
      data: { prestamoId: 'ref-prestamo_temp_9' },
      queryKeys: [['prestamos']],
    });

    const result = getQueueItemsReferencingTempId('prestamo_temp_9');
    expect(result).toHaveLength(1);
    expect(result[0].endpoint).toBe('/prestamos/ref-prestamo_temp_9');
  });
});

describe('updateQueueItem', () => {
  it('actualiza status, retryCount, lastError y retryable', () => {
    const item = addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });

    updateQueueItem(item.id, {
      status: 'syncing',
      retryCount: 2,
      lastError: 'timeout',
      retryable: false,
    });

    const updated = getQueue()[0];
    expect(updated.status).toBe('syncing');
    expect(updated.retryCount).toBe(2);
    expect(updated.lastError).toBe('timeout');
    expect(updated.retryable).toBe(false);
  });

  it('no-op si no hay campos que actualizar', () => {
    const item = addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    const before = { ...getQueue()[0] };

    updateQueueItem(item.id, {});
    expect(getQueue()[0]).toEqual(before);
  });
});

describe('recoverSyncingItems', () => {
  it('recoloca los items syncing a pending', () => {
    const item = addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    updateQueueItem(item.id, { status: 'syncing' });

    expect(recoverSyncingItems()).toBe(1);
    expect(getQueue()[0].status).toBe('pending');
  });

  it('devuelve 0 cuando no hay items syncing', () => {
    addToQueue({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
      queryKeys: [['prestamos']],
      tempId: 'pago_temp_1',
    });
    expect(recoverSyncingItems()).toBe(0);
  });
});

describe('discardExpiredItem', () => {
  beforeEach(() => {
    mockUpsertPrestamos.mockClear();
    mockDeletePago.mockClear();
    mockDeletePrestamo.mockClear();
  });

  it('B: stale disbursement → expired sin rollback', () => {
    const prestamoSnapshot = {
      prestamo: {
        id: 'prestamo_1',
        estado: 'APROBADO',
        saldoPendiente: 5000,
        montoTotal: 10000,
      },
    };

    addToQueue({
      endpoint: '/prestamos/prestamo_1/desembolsar',
      method: 'PATCH',
      data: {},
      queryKeys: [['prestamos', 'prestamo_1'], ['prestamos']],
      tempId: 'desembolso_temp_1',
      tempDisplay: { prestamoId: 'prestamo_1', monto: 10000 },
    });

    const stores = (global as any).__mockDbStores;
    for (const [, arr] of stores) {
      if (arr[0]?.id === getQueue()[0].id) {
        arr[0].createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      }
    }

    const changed = markStaleAsFailed();
    expect(changed).toBe(1);
    expect(getQueue()[0].status).toBe('expired');
    expect(getQueue()[0].retryable).toBe(true);
    expect(mockUpsertPrestamos).not.toHaveBeenCalled();
  });

  it('C: stale refinanciar → expired sin rollback', () => {
    const prestamoSnapshot = {
      prestamo: {
        id: 'prestamo_1',
        estado: 'ACTIVO',
        saldoPendiente: 5000,
        montoTotal: 10000,
        tasaInteres: 24,
        numeroCuotas: 12,
      },
    };

    addToQueue({
      endpoint: '/prestamos/prestamo_1/refinanciar',
      method: 'PATCH',
      data: { nuevasCuotas: 18, nuevaTasa: 30 },
      queryKeys: [['prestamos', 'prestamo_1'], ['prestamos']],
      tempId: 'refinanciar_temp_1',
      tempDisplay: { prestamoId: 'prestamo_1', nuevasCuotas: 18, nuevaTasa: 30 },
      snapshot: prestamoSnapshot,
    });

    const stores = (global as any).__mockDbStores;
    for (const [, arr] of stores) {
      if (arr[0]?.id === getQueue()[0].id) {
        arr[0].createdAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      }
    }

    const changed = markStaleAsFailed();
    expect(changed).toBe(1);
    expect(getQueue()[0].status).toBe('expired');
    expect(getQueue()[0].retryable).toBe(true);
    expect(mockUpsertPrestamos).not.toHaveBeenCalled();
  });

  it('H: discard disbursement → ACTIVO → APROBADO', () => {
    // Usar ID numérico para que la normalización de endpoint funcione correctamente
    // La regex en discardExpiredItem reemplaza /\d+/ por :id, así que el ID no debe contener dígitos sueltos
    addToQueue({
      endpoint: '/prestamos/123/desembolsar',
      method: 'PATCH',
      data: {},
      queryKeys: [['prestamos', '123'], ['prestamos']],
      tempId: 'desembolso_temp_1',
      tempDisplay: { prestamoId: '123', monto: 10000 },
    });

    const item = getQueue()[0];
    updateQueueItem(item.id, { status: 'expired', retryable: true });
    const expiredItem = getQueue()[0];

    // Configurar préstamo en ACTIVO en el mock store usando la tabla prestamos
    const stores = (global as any).__mockDbStores;
    if (!stores.has(prestamos)) stores.set(prestamos, []);
    const prestamosStore = stores.get(prestamos);
    prestamosStore.push({ id: '123', estado: 'ACTIVO', monto: 10000 });

    discardExpiredItem(expiredItem);

    // Verificar que el préstamo se actualizó a APROBADO en el mock store
    const updatedPrestamo = prestamosStore?.find((p: any) => p.id === '123');
    expect(updatedPrestamo).toBeDefined();
    expect(updatedPrestamo?.estado).toBe('APROBADO');
  });

  it('N: refinanciar conserva snapshot para descarte seguro', () => {
    const prestamoSnapshot = {
      prestamo: {
        id: 'prestamo_1',
        estado: 'ACTIVO',
        saldoPendiente: 5000,
        montoTotal: 10000,
        tasaInteres: 24,
        numeroCuotas: 12,
      },
    };

    addToQueue({
      endpoint: '/prestamos/prestamo_1/refinanciar',
      method: 'PATCH',
      data: { nuevasCuotas: 18, nuevaTasa: 30 },
      queryKeys: [['prestamos', 'prestamo_1'], ['prestamos']],
      tempId: 'refinanciar_temp_1',
      tempDisplay: { prestamoId: 'prestamo_1', nuevasCuotas: 18, nuevaTasa: 30 },
      snapshot: prestamoSnapshot,
    });

    const item = getQueue()[0];
    updateQueueItem(item.id, { status: 'expired', retryable: true });
    const expiredItem = getQueue()[0];

    mockUpsertPrestamos.mockClear();
    discardExpiredItem(expiredItem);

    expect(mockUpsertPrestamos).toHaveBeenCalledWith([prestamoSnapshot.prestamo]);
  });
});
