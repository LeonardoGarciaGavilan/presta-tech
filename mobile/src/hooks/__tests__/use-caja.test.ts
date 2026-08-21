import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockObtenerCajaActiva = jest.fn();
const mockAbrirCaja = jest.fn();
const mockCerrarCaja = jest.fn();
const mockAddToOfflineQueue = jest.fn();
const mockSaveCajaActiva = jest.fn();
const mockGetCajaActivaCache = jest.fn();

jest.mock('@/api/caja.api', () => ({
  obtenerCajaActiva: (...args: any[]) => mockObtenerCajaActiva(...args),
  abrirCaja: (...args: any[]) => mockAbrirCaja(...args),
  cerrarCaja: (...args: any[]) => mockCerrarCaja(...args),
  obtenerHistorialCajas: jest.fn(),
  obtenerResumenCaja: jest.fn(),
  obtenerAuditoriaCaja: jest.fn(),
  obtenerCajas: jest.fn(),
}));

jest.mock('@/components/providers/network-provider', () => ({
  useNetworkContext: jest.fn(),
}));

jest.mock('@/db/caja-db', () => ({
  saveCajaActiva: (...args: any[]) => mockSaveCajaActiva(...args),
  getCajaActivaCache: (...args: any[]) => mockGetCajaActivaCache(...args),
}));

import { useAbrirCaja, useCerrarCaja, useCajaActiva } from '@/hooks/use-caja';
import { useNetworkContext } from '@/components/providers/network-provider';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createWrapperConCajaAbierta() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['caja', 'activa'], { id: 'caja_1', estado: 'ABIERTA' });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (useNetworkContext as jest.Mock).mockReturnValue({
    network: { isOnline: false },
    addToOfflineQueue: mockAddToOfflineQueue,
  });
  mockGetCajaActivaCache.mockReturnValue(null);
  mockAddToOfflineQueue.mockResolvedValue({ tempId: 'caja_temp_123' });
});

describe('useCajaActiva (C1)', () => {
  it('usa la clave fija ["caja","activa"]: una caja sembrada por hydrateFromDb es visible aunque la pantalla pase fecha', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['caja', 'activa'], { id: 'caja_hidratada', estado: 'ABIERTA' });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = await renderHook(() => useCajaActiva('2026-08-14'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe('caja_hidratada');
    expect(mockObtenerCajaActiva).not.toHaveBeenCalled();
  });
});

describe('useAbrirCaja (C2)', () => {
  const dto = { montoInicial: 5000 };

  it('rechaza abrir offline si ya hay caja abierta en el cache', async () => {
    const { result } = await renderHook(() => useAbrirCaja(), {
      wrapper: createWrapperConCajaAbierta(),
    });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockAddToOfflineQueue).not.toHaveBeenCalled();
    expect(mockSaveCajaActiva).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toBe('Ya tienes una caja abierta para este día');
  });

  it('rechaza abrir offline si hay caja abierta persistida en SQLite', async () => {
    mockGetCajaActivaCache.mockReturnValue({ id: 'caja_db', estado: 'ABIERTA', montoInicial: 0 });

    const { result } = await renderHook(() => useAbrirCaja(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockAddToOfflineQueue).not.toHaveBeenCalled();
  });

  it('permite abrir offline sin caja previa y persiste la caja temp', async () => {
    const { result } = await renderHook(() => useAbrirCaja(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockSaveCajaActiva).toHaveBeenCalledTimes(1);
    const persisted = mockSaveCajaActiva.mock.calls[0][0];
    expect(persisted.id).toContain('caja_temp_');
    expect(persisted.estado).toBe('ABIERTA');
    expect(persisted.montoInicial).toBe(5000);
  });
});

describe('useCerrarCaja (C2)', () => {
  const dto = { montoCierre: 5000 };

  it('encola cierre de caja temp offline (cadena tempId) sin lanzar CAJA_TEMP_OFFLINE', async () => {
    const { result } = await renderHook(() => useCerrarCaja(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'caja_temp_456', dto });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/caja/caja_temp_456/cerrar',
        method: 'PATCH',
        queryKeys: expect.arrayContaining([['caja', 'caja_temp_456']]),
      }),
    );
    expect(mockSaveCajaActiva).toHaveBeenCalledWith(null);
  });

  it('encola cierre de caja real offline', async () => {
    const { result } = await renderHook(() => useCerrarCaja(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'caja_real_1', dto });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/caja/caja_real_1/cerrar' }),
    );
    expect(mockSaveCajaActiva).toHaveBeenCalledWith(null);
  });
});
