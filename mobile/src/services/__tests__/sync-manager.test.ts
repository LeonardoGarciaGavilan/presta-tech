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
            orderBy: () => ({ all: () => getStore(table) }),
          }),
          all: () => getStore(table),
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

jest.mock('@/api/client', () => {
  const mockClient = jest.fn();
  return { __esModule: true, default: mockClient };
});

jest.mock('@/db/offline-queue-db', () => ({
  getPendingItems: jest.fn(),
  getFailedItems: jest.fn(),
  updateQueueItem: jest.fn(),
  removeFromQueue: jest.fn(),
  findDuplicate: jest.fn(),
  getQueueStats: jest.fn(),
  getQueue: jest.fn(() => []),
  getQueueItemsReferencingTempId: jest.fn(() => []),
}));

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn(),
}));

jest.mock('@/db/clientes-db', () => ({
  upsertClientes: jest.fn(),
  deleteCliente: jest.fn(),
}));

jest.mock('@/db/prestamos-db', () => ({
  upsertPrestamos: jest.fn(),
  deletePrestamo: jest.fn(),
}));

jest.mock('@/db/pagos-db', () => ({
  upsertPagos: jest.fn(),
  deletePago: jest.fn(),
}));

jest.mock('@/store/auth.store', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user_1' } }) },
}));

import client from '@/api/client';
import { QueryClient } from '@tanstack/react-query';
import {
  getPendingItems, getFailedItems, updateQueueItem, removeFromQueue, findDuplicate,
} from '@/db/offline-queue-db';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { upsertClientes, deleteCliente } from '@/db/clientes-db';
import { upsertPrestamos, deletePrestamo } from '@/db/prestamos-db';
import { upsertPagos, deletePago } from '@/db/pagos-db';
import { syncNow, processItem, isSyncing, onSyncItemEvent } from '@/services/sync-manager';
import type { OfflineQueueItem } from '@/types/offline.types';

const mockClient = client as unknown as jest.Mock;
const mockGetPending = getPendingItems as jest.Mock;
const mockUpdateQueue = updateQueueItem as jest.Mock;
const mockRemoveQueue = removeFromQueue as jest.Mock;
const mockFindDuplicate = findDuplicate as jest.Mock;
const mockGetNetwork = getNetworkStatus as jest.Mock;
const mockUpsertClientes = upsertClientes as jest.Mock;
const mockUpsertPrestamos = upsertPrestamos as jest.Mock;
const mockUpsertPagos = upsertPagos as jest.Mock;
const mockDeleteCliente = deleteCliente as jest.Mock;
const mockDeletePrestamo = deletePrestamo as jest.Mock;
const mockDeletePago = deletePago as jest.Mock;

function makeItem(overrides: Partial<OfflineQueueItem> = {}): OfflineQueueItem {
  return {
    id: 'item_1',
    endpoint: '/clientes',
    method: 'POST',
    data: { nombre: 'Juan', cedula: '001-0000001-1' },
    queryKeys: [['clientes']],
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
    tempId: 'temp_123',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockGetNetwork.mockReturnValue({ isOnline: true });
  mockClient.mockResolvedValue({ data: { id: 'server_1', nombre: 'Juan' }, status: 201 });
  mockFindDuplicate.mockResolvedValue(null);
  mockUpdateQueue.mockResolvedValue(undefined);
  mockRemoveQueue.mockResolvedValue(undefined);

  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
});

describe('processItem', () => {
  it('emite el evento por item: syncing y synced en éxito', async () => {
    const events: { id: string; status: string }[] = [];
    const unsub = onSyncItemEvent((e) => events.push(e));
    try {
      const result = await processItem(makeItem());
      expect(result).toBe(true);
    } finally {
      unsub();
    }
    expect(events.map((e) => e.status)).toEqual(['syncing', 'synced']);
    expect(events[0].id).toBe('item_1');
  });

  it('emite el evento failed cuando el item falla de forma permanente', async () => {
    mockClient.mockRejectedValue({ statusCode: 400, message: 'Bad Request' });
    const events: { id: string; status: string }[] = [];
    const unsub = onSyncItemEvent((e) => events.push(e));
    try {
      const result = await processItem(makeItem());
      expect(result).toBe(false);
    } finally {
      unsub();
    }
    expect(events.map((e) => e.status)).toEqual(['syncing', 'failed']);
  });

  it('emite el evento failed cuando un reintentable no agota los intentos', async () => {
    mockClient.mockRejectedValue({ statusCode: 500, message: 'Server Error' });
    const events: { id: string; status: string }[] = [];
    const unsub = onSyncItemEvent((e) => events.push(e));
    try {
      const result = await processItem(makeItem({ retryCount: 0 }));
      expect(result).toBe(false);
    } finally {
      unsub();
    }
    expect(events.map((e) => e.status)).toEqual(['syncing', 'failed']);
  });

  it('removes duplicate items', async () => {
    mockFindDuplicate.mockResolvedValue({ id: 'existing_item', endpoint: '/clientes', method: 'POST' });
    const result = await processItem(makeItem());
    expect(result).toBe(true);
    expect(mockRemoveQueue).toHaveBeenCalledWith('item_1');
    expect(mockClient).not.toHaveBeenCalled();
  });

  it('sends request via client and removes from queue on success', async () => {
    const result = await processItem(makeItem());
    expect(result).toBe(true);
    expect(mockUpdateQueue).toHaveBeenCalledWith('item_1', { status: 'syncing' });
    expect(mockClient).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: '/clientes' }),
    );
    expect(mockRemoveQueue).toHaveBeenCalledWith('item_1');
  });

  it('uses empty data for DELETE requests', async () => {
    mockClient.mockResolvedValue({ data: null, status: 204 });
    const item = makeItem({ method: 'DELETE', data: { id: 'cli_1' } });
    await processItem(item);
    expect(mockClient).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', data: undefined, params: { id: 'cli_1' } }),
    );
  });

  it('upserts response data for POST /clientes on success', async () => {
    mockClient.mockResolvedValue({ data: { id: 'server_1', nombre: 'Juan', empresaId: 'emp_1' } });
    await processItem(makeItem({ endpoint: '/clientes', method: 'POST' }));
    expect(mockUpsertClientes).toHaveBeenCalledWith([{ id: 'server_1', nombre: 'Juan', empresaId: 'emp_1' }]);
    expect(mockDeleteCliente).toHaveBeenCalledWith('temp_123');
  });

  it('upserts response data for POST /prestamos on success', async () => {
    mockClient.mockResolvedValue({ data: { id: 'server_1', monto: 10000 } });
    await processItem(makeItem({ endpoint: '/prestamos', method: 'POST' }));
    expect(mockUpsertPrestamos).toHaveBeenCalledWith([{ id: 'server_1', monto: 10000 }]);
    expect(mockDeletePrestamo).toHaveBeenCalledWith('temp_123');
  });

  it('upserts response data for POST /pagos on success', async () => {
    mockClient.mockResolvedValue({
      data: {
        pago: {
          id: 'server_1',
          montoTotal: 3000,
          capital: 2700,
          interes: 200,
          mora: 100,
          abonoCapital: 50,
          metodo: 'EFECTIVO',
          referencia: null,
          observacion: null,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        prestamo: { id: 'prestamo_1', saldoPendiente: 0 },
        cliente: { nombre: 'Juan', apellido: '', cedula: '' },
        cuota: null,
        usuario: { nombre: 'Test' },
      },
      status: 201,
    });
    await processItem(makeItem({
      endpoint: '/pagos',
      method: 'POST',
      data: { prestamoId: 'prestamo_1', montoPagado: 3000, metodo: 'EFECTIVO' },
    }));
    expect(mockUpsertPagos).toHaveBeenCalledWith([{
      id: 'server_1',
      montoTotal: 3000,
      capital: 2750,
      interes: 200,
      mora: 100,
      metodo: 'EFECTIVO',
      referencia: null,
      observacion: null,
      prestamoId: 'prestamo_1',
      usuarioId: 'user_1',
      cajaId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    }]);
    expect(mockDeletePago).toHaveBeenCalledWith('temp_123');
  });

  it('retries on network error if retryCount < max', async () => {
    jest.useFakeTimers();
    mockClient.mockRejectedValue({ statusCode: 500, message: 'Server Error' });
    const item = makeItem({ retryCount: 0 });
    const promise = processItem(item);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    jest.advanceTimersByTime(100000);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    const result = await promise;
    expect(result).toBe(false);
    expect(mockUpdateQueue).toHaveBeenCalledWith('item_1', {
      status: 'pending', retryCount: 1, lastError: 'Error temporal del servidor', retryable: true,
    });
  });

  it('marks as failed when retries exhausted', async () => {
    mockClient.mockRejectedValue({ statusCode: 500, message: 'Server Error' });
    const item = makeItem({ retryCount: 5 });
    const result = await processItem(item);
    expect(result).toBe(false);
    expect(mockUpdateQueue).toHaveBeenCalledWith('item_1', {
      status: 'failed', retryCount: 6, lastError: 'Error temporal del servidor', retryable: true,
    });
  });

  it('marks as failed immediately for non-retryable errors', async () => {
    mockClient.mockRejectedValue({ statusCode: 400, message: 'Bad Request' });
    const result = await processItem(makeItem());
    expect(result).toBe(false);
    expect(mockUpdateQueue).toHaveBeenCalledWith('item_1', expect.objectContaining({ status: 'failed' }));
  });

  describe('regresión: no re-sella queries cuyo data no cambió', () => {
    function makePagoItem(): OfflineQueueItem {
      return makeItem({
        id: 'item_pago',
        endpoint: '/pagos',
        method: 'POST',
        data: {
          prestamoId: 'prestamo_1',
          montoTotal: 1000,
          capital: 900,
          interes: 100,
          metodo: 'EFECTIVO',
          fecha: '2026-08-02',
        },
        queryKeys: [
          ['pagos'],
          ['pagos', 'resumen'],
          ['pagos', 'todos'],
          ['pagos', 'prestamo', 'prestamo_1'],
          ['prestamos'],
          ['prestamos', 'prestamo_1'],
          ['caja', 'activa', '2026-08-02'],
        ],
        tempId: 'pago_temp_1',
      });
    }

    beforeEach(() => {
      mockClient.mockResolvedValue({
        data: {
          id: 'pago_server_1',
          montoTotal: 1000,
          capital: 900,
          abonoCapital: 0,
          interes: 100,
          mora: 0,
          metodo: 'EFECTIVO',
          cajaId: 'caja_1',
          createdAt: '2026-08-02T12:00:00.000Z',
        },
        status: 201,
      });
    });

    it('no borra la invalidación ni estampa dataUpdatedAt en queries sin tempId', async () => {
      const qc = new QueryClient({
        defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
      });

      qc.setQueryData(['prestamos', 'prestamo_1'], {
        id: 'prestamo_1',
        saldoPendiente: 5000,
        cuotas: [{ id: 'cuota_1', pagada: false }],
      });
      qc.setQueryData(['caja', 'activa', '2026-08-02'], {
        id: 'caja_1',
        totalIngresos: 0,
      });

      const statePrestamo = qc.getQueryState(['prestamos', 'prestamo_1'])!;
      const stateCaja = qc.getQueryState(['caja', 'activa', '2026-08-02'])!;
      const prestamoUpdatedAt = statePrestamo.dataUpdatedAt;
      const cajaUpdatedAt = stateCaja.dataUpdatedAt;

      const result = await processItem(makePagoItem(), qc);
      expect(result).toBe(true);

      const afterPrestamo = qc.getQueryState(['prestamos', 'prestamo_1'])!;
      const afterCaja = qc.getQueryState(['caja', 'activa', '2026-08-02'])!;

      expect(afterPrestamo.isInvalidated).toBe(true);
      expect(afterCaja.isInvalidated).toBe(true);
      expect(afterPrestamo.dataUpdatedAt).toBe(prestamoUpdatedAt);
      expect(afterCaja.dataUpdatedAt).toBe(cajaUpdatedAt);
    });

    it('sigue reemplazando el tempId en queries que sí lo contienen', async () => {
      const qc = new QueryClient();

      qc.setQueryData(['pagos', 'prestamo', 'prestamo_1'], [
        { id: 'pago_temp_1', montoTotal: 1000, prestamoId: 'prestamo_1' },
      ]);
      qc.setQueryData(['pagos'], {
        pages: [{ data: [{ id: 'pago_temp_1' }, { id: 'pago_x' }] }],
      });
      qc.setQueryData(['pagos', 'todos'], { data: [{ id: 'pago_temp_1' }] });

      const result = await processItem(makePagoItem(), qc);
      expect(result).toBe(true);

      const pagosPrestamo = qc.getQueryData(['pagos', 'prestamo', 'prestamo_1']) as any[];
      expect(pagosPrestamo).toHaveLength(1);
      expect(pagosPrestamo[0].id).toBe('pago_server_1');

      const pagosPaginados = qc.getQueryData(['pagos']) as any;
      expect(pagosPaginados.pages[0].data[0].id).toBe('pago_server_1');
      expect(pagosPaginados.pages[0].data[1].id).toBe('pago_x');

      const pagosPlanos = qc.getQueryData(['pagos', 'todos']) as any;
      expect(pagosPlanos.data[0].id).toBe('pago_server_1');
    });
  });
});

describe('syncNow', () => {
  beforeEach(() => {
    mockGetPending.mockResolvedValue([]);
  });

  it('returns early if offline', async () => {
    mockGetNetwork.mockReturnValue({ isOnline: false });
    const result = await syncNow();
    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Sin conexión a internet');
  });

  it('processes all pending items', async () => {
    mockGetPending
      .mockResolvedValueOnce([makeItem({ id: 'item_1' })])
      .mockResolvedValueOnce([makeItem({ id: 'item_2' })])
      .mockResolvedValueOnce([]);
    mockClient.mockResolvedValue({ data: { id: 'server_1' }, status: 201 });

    const result = await syncNow();
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('stops syncing if connection lost mid-sync', async () => {
    mockGetPending
      .mockResolvedValueOnce([makeItem({ id: 'item_1' })])
      .mockResolvedValueOnce([]);
    mockClient.mockRejectedValue({ statusCode: 500, message: 'Error' });
    mockGetNetwork
      .mockReturnValueOnce({ isOnline: true })
      .mockReturnValueOnce({ isOnline: false });

    const result = await syncNow();
    expect(result.synced).toBe(0);
    expect(result.errors).toContain('Conexión perdida durante sincronización');
  });
});
