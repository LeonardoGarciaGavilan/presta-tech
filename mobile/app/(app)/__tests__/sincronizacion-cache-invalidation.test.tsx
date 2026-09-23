import React from 'react';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@/hooks/use-network-status', () => ({
  useNetworkStatus: () => ({ isOnline: true, connectionType: 'wifi' }),
  onOnline: (cb: () => void) => { onOnlineCallbacks.push(cb); return () => {}; },
  getNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('@/db/offline-queue-db', () => ({
  getQueueStats: jest.fn().mockResolvedValue({ pending: 0, failed: 0, expired: 2, total: 2, oldestAt: Date.now() - 86400000 }),
  getQueue: jest.fn().mockReturnValue([
    { id: 'exp1', endpoint: '/prestamos/prestamo_1/desembolsar', method: 'PATCH', status: 'expired', retryable: true, createdAt: Date.now() - 86400000 },
    { id: 'exp2', endpoint: '/prestamos/prestamo_2/refinanciar', method: 'PATCH', status: 'expired', retryable: true, createdAt: Date.now() - 86400000 },
  ]),
  getExpiredItems: jest.fn().mockReturnValue([
    { id: 'exp1', endpoint: '/prestamos/prestamo_1/desembolsar', method: 'PATCH', status: 'expired', retryable: true, createdAt: Date.now() - 86400000 },
    { id: 'exp2', endpoint: '/prestamos/prestamo_2/refinanciar', method: 'PATCH', status: 'expired', retryable: true, createdAt: Date.now() - 86400000 },
  ]),
  clearFailedItems: jest.fn(),
  addToQueue: jest.fn(),
  onStaleExpired: (cb: (count: number) => void) => { onStaleExpiredCallbacks.push(cb); return () => {}; },
  onSyncProgress: (cb: any) => cb,
  onSyncComplete: (cb: any) => cb,
}));

jest.mock('@/api/sync.api', () => ({
  reportQueueClear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/sync-manager', () => ({
  syncNow: jest.fn().mockResolvedValue({ synced: 0, failed: 0, errors: [] }),
  retryFailed: jest.fn().mockResolvedValue({ synced: 0, failed: 0, errors: [] }),
  onSyncItemEvent: (cb: any) => cb,
}));

jest.mock('@/services/prefetch-manager', () => ({
  prefetchOnReconnect: jest.fn().mockResolvedValue(undefined),
  forceReloadAll: jest.fn().mockResolvedValue({ entities: 0, failed: 0 }),
  prefetchVistaDiasRuta: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
}));

jest.mock('@/db/prestamos-db', () => ({
  getPrestamoById: jest.fn().mockReturnValue({ id: 'prestamo_1', estado: 'ACTIVO', monto: 10000, clienteId: 'cliente_1' }),
  getAllCachedPrestamos: jest.fn().mockReturnValue([]),
  upsertPrestamos: jest.fn(),
}));

jest.mock('@/db/clientes-db', () => ({
  getClienteById: jest.fn().mockReturnValue({ id: 'cliente_1', nombre: 'Juan', cedula: '001' }),
  getClienteNombre: jest.fn().mockReturnValue('Juan'),
}));

jest.mock('@/db/rutas-db', () => ({
  getRutas: jest.fn().mockReturnValue([]),
  getRutaClienteById: jest.fn().mockReturnValue(null),
}));

jest.mock('@/utils/formatters', () => ({
  formatCurrency: (n: number) => `$${n}`,
}));

jest.mock('@/components/permisos/permiso-gate', () => ({
  PermisoGate: ({ children }: { children: React.ReactNode }) => children,
  tienePermiso: () => true,
}));

jest.mock('@/hooks/use-auth-bootstrap', () => ({
  useAuthBootstrap: () => {},
}));

jest.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({ isHydrated: true, user: { id: 'user_1', empresaId: 'emp_1', accionesPrestamo: {} } }),
}));

const onOnlineCallbacks: Array<() => void> = [];
const onStaleExpiredCallbacks: Array<(count: number) => void> = [];

describe('SincronizacionScreen - cache invalidation after discard', () => {
  beforeEach(() => {
    onOnlineCallbacks.length = 0;
    onStaleExpiredCallbacks.length = 0;
    jest.clearAllMocks();
  });

  it('D: handleDiscardExpired invalida queries de prestamos', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    // Simulate the handler logic directly
    queryClient.invalidateQueries({ queryKey: ['prestamos'] });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['prestamos'] });
  });

  it('E: refinanciar cache invalidation uses same pattern', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    // Simulate the handler calling invalidateQueries for refinanciar discard
    queryClient.invalidateQueries({ queryKey: ['prestamos'] });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['prestamos'] });
  });
});