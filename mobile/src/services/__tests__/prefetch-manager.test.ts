import { QueryClient } from '@tanstack/react-query';

import { getCambios } from '@/api/sync.api';
import { getSyncCursor } from '@/db/sync-meta-db';
import { deleteRutaClientesExcept, deleteRutas } from '@/db/rutas-db';
import { forceReloadAll, prefetchIncremental } from '@/services/prefetch-manager';
import { syncClientesToDb, syncPrestamosToDb } from '@/services/data-sync';
import { getEntitiesWithPendingMutations } from '@/services/sync-manager';

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn(() => ({ isOnline: true, isOffline: false })),
}));

jest.mock('@/api/sync.api', () => ({
  getCambios: jest.fn(),
}));

jest.mock('@/db/sync-meta-db', () => ({
  getSyncCursor: jest.fn(),
  setSyncCursor: jest.fn(),
  getLastSyncAt: jest.fn(),
  setLastSyncAt: jest.fn(),
}));

jest.mock('@/services/sync-manager', () => ({
  getEntitiesWithPendingMutations: jest.fn(() => ({
    prestamos: new Set<string>(),
    clientes: new Set<string>(),
  })),
}));

jest.mock('@/services/data-sync', () => ({
  syncClientesToDb: jest.fn(),
  syncPrestamosToDb: jest.fn(),
  syncRutasToDb: jest.fn(),
  syncConfigToDb: jest.fn(),
}));

jest.mock('@/db/rutas-db', () => ({
  getRutas: jest.fn(() => []),
  upsertVistaDiaCache: jest.fn(),
  upsertRutaClientes: jest.fn(),
  deleteRutaClientesExcept: jest.fn(),
  deleteRutas: jest.fn(),
}));

jest.mock('@/db/purge', () => ({
  purgeAllTables: jest.fn(),
}));

const snapshot = {
  serverTime: '2025-01-10T12:00:00.000Z',
  clientes: [],
  prestamos: [],
  rutas: [{ id: 'ruta_1', clientes: [{ id: 'rc_anidado' }] }],
  rutaClientes: [{ id: 'rc_plano' }],
  rutasAjenas: [],
  configuracion: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (getCambios as jest.Mock).mockResolvedValue(snapshot);
  (getEntitiesWithPendingMutations as jest.Mock).mockReturnValue({
    prestamos: new Set<string>(),
    clientes: new Set<string>(),
  });
});

describe('reconciliación rutaClientes (C4-B1)', () => {
  it('en full reload reconcilia con ids planos + anidados en rutas', async () => {
    (getSyncCursor as jest.Mock).mockReturnValue(null);
    await forceReloadAll();
    expect(deleteRutaClientesExcept).toHaveBeenCalledTimes(1);
    const keepIds = (deleteRutaClientesExcept as jest.Mock).mock.calls[0][0];
    expect(keepIds).toHaveLength(2);
    expect(keepIds).toEqual(expect.arrayContaining(['rc_plano', 'rc_anidado']));
  });

  it('en incremental (con cursor) NO reconcilia', async () => {
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    await prefetchIncremental();
    expect(deleteRutaClientesExcept).not.toHaveBeenCalled();
  });

  it('en full reload sin rutaClientes ni rutas llama con lista vacía', async () => {
    (getSyncCursor as jest.Mock).mockReturnValue(null);
    (getCambios as jest.Mock).mockResolvedValue({ ...snapshot, rutaClientes: [], rutas: [] });
    await forceReloadAll();
    expect(deleteRutaClientesExcept).toHaveBeenCalledWith([]);
  });
});

describe('C8: rutasAjenas del delta', () => {
  it('retira las rutas ajenas de SQLite', async () => {
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    (getCambios as jest.Mock).mockResolvedValue({
      ...snapshot,
      rutasAjenas: ['ruta_ajena_1', 'ruta_ajena_2'],
    });
    await prefetchIncremental();
    expect(deleteRutas).toHaveBeenCalledWith(['ruta_ajena_1', 'ruta_ajena_2']);
  });

  it('no llama a deleteRutas si no hay rutas ajenas', async () => {
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    await prefetchIncremental();
    expect(deleteRutas).not.toHaveBeenCalled();
  });

  it('con queryClient actualiza el cache de rutas', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['rutas'], [
      { id: 'ruta_1' },
      { id: 'ruta_ajena_1' },
    ]);
    queryClient.setQueryData(['rutas', 'ruta_ajena_1', 'dia', '2026-08-14'], {});
    queryClient.setQueryData(['rutas', 'ruta_1'], {});

    (getSyncCursor as jest.Mock).mockReturnValue(123);
    (getCambios as jest.Mock).mockResolvedValue({
      ...snapshot,
      rutasAjenas: ['ruta_ajena_1'],
    });
    await prefetchIncremental(queryClient);

    const cache = queryClient.getQueryData(['rutas']);
    expect(cache).toEqual([{ id: 'ruta_1' }]);
    expect(queryClient.getQueryData(['rutas', 'ruta_ajena_1', 'dia', '2026-08-14'])).toBeUndefined();
    expect(queryClient.getQueryData(['rutas', 'ruta_1'])).toBeDefined();
  });
});

describe('1.5: pull no sobrescribe cambios locales pendientes', () => {
  it('persiste préstamos/clientes sin mutaciones pendientes', async () => {
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    (getCambios as jest.Mock).mockResolvedValue({
      ...snapshot,
      clientes: [{ id: 'c1' }, { id: 'c2' }],
      prestamos: [{ id: 'p1' }, { id: 'p2' }],
    });
    await prefetchIncremental();
    expect(syncClientesToDb).toHaveBeenCalledWith([{ id: 'c1' }, { id: 'c2' }]);
    expect(syncPrestamosToDb).toHaveBeenCalledWith([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('excluye del upsert los préstamos con items pendientes en la cola', async () => {
    (getEntitiesWithPendingMutations as jest.Mock).mockReturnValue({
      prestamos: new Set(['p1']),
      clientes: new Set<string>(),
    });
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    (getCambios as jest.Mock).mockResolvedValue({
      ...snapshot,
      prestamos: [{ id: 'p1' }, { id: 'p2' }],
    });
    await prefetchIncremental();
    expect(syncPrestamosToDb).toHaveBeenCalledWith([{ id: 'p2' }]);
  });

  it('excluye del upsert los clientes con items pendientes en la cola', async () => {
    (getEntitiesWithPendingMutations as jest.Mock).mockReturnValue({
      prestamos: new Set<string>(),
      clientes: new Set(['c1']),
    });
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    (getCambios as jest.Mock).mockResolvedValue({
      ...snapshot,
      clientes: [{ id: 'c1' }, { id: 'c2' }],
    });
    await prefetchIncremental();
    expect(syncClientesToDb).toHaveBeenCalledWith([{ id: 'c2' }]);
  });

  it('no llama a syncPrestamosToDb si todos los préstamos tienen mutaciones pendientes', async () => {
    (getEntitiesWithPendingMutations as jest.Mock).mockReturnValue({
      prestamos: new Set(['p1']),
      clientes: new Set<string>(),
    });
    (getSyncCursor as jest.Mock).mockReturnValue(123);
    (getCambios as jest.Mock).mockResolvedValue({
      ...snapshot,
      prestamos: [{ id: 'p1' }],
    });
    await prefetchIncremental();
    expect(syncPrestamosToDb).not.toHaveBeenCalled();
  });
});
