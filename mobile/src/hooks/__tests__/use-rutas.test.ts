import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockListarRutas = jest.fn();
const mockObtenerVistaDia = jest.fn();
const mockMarcarVisitadoApi = jest.fn();
const mockResetVisitadosApi = jest.fn();
const mockGetRutas = jest.fn();
const mockGetRutaClienteById = jest.fn();
const mockGetClienteNombre = jest.fn();
const mockGetVistaDiaCache = jest.fn();
const mockUpsertVistaDiaCache = jest.fn();
const mockAddToOfflineQueue = jest.fn();

jest.mock('@/api/rutas.api', () => ({
  listarRutas: (...args: any[]) => mockListarRutas(...args),
  obtenerVistaDia: (...args: any[]) => mockObtenerVistaDia(...args),
  marcarVisitado: (...args: any[]) => mockMarcarVisitadoApi(...args),
  resetVisitados: (...args: any[]) => mockResetVisitadosApi(...args),
  obtenerRuta: jest.fn(),
  crearRuta: jest.fn(),
  actualizarRuta: jest.fn(),
  eliminarRuta: jest.fn(),
  generarRutaDia: jest.fn(),
  agregarClienteRuta: jest.fn(),
  quitarClienteRuta: jest.fn(),
  reordenarRuta: jest.fn(),
  listarUsuarios: jest.fn(),
  asignarUsuarioRuta: jest.fn(),
  obtenerResumenRutas: jest.fn(),
}));

jest.mock('@/db/rutas-db', () => ({
  getRutas: (...args: any[]) => mockGetRutas(...args),
  getRutaClienteById: (...args: any[]) => mockGetRutaClienteById(...args),
  getVistaDiaCache: (...args: any[]) => mockGetVistaDiaCache(...args),
  upsertVistaDiaCache: (...args: any[]) => mockUpsertVistaDiaCache(...args),
}));

jest.mock('@/db/clientes-db', () => ({
  getClienteNombre: (...args: any[]) => mockGetClienteNombre(...args),
}));

jest.mock('@/components/providers/network-provider', () => ({
  useNetworkContext: jest.fn(),
}));

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn(),
}));

import { useRutas, useVistaDia, useMarcarVisitado, useResetVisitados } from '@/hooks/use-rutas';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getNetworkStatus } from '@/hooks/use-network-status';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (useNetworkContext as jest.Mock).mockReturnValue({
    network: { isOnline: true },
    addToOfflineQueue: mockAddToOfflineQueue,
  });
});

describe('useRutas', () => {
  it('fetches rutas from API when online', async () => {
    const apiData = [{ id: 'ruta_1', nombre: 'Ruta Norte' }];
    mockListarRutas.mockResolvedValue(apiData);

    const { result } = await renderHook(() => useRutas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(apiData);
  });

  it('returns cached rutas when offline', async () => {
    mockListarRutas.mockRejectedValue(new Error('Network Error'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    mockGetRutas.mockReturnValue([{ id: 'ruta_1', nombre: 'Ruta Cache' }]);

    const { result } = await renderHook(() => useRutas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'ruta_1', nombre: 'Ruta Cache' }]);
    expect(mockGetRutas).toHaveBeenCalledTimes(1);
  });
});

describe('useVistaDia', () => {
  it('fetches vista dia from API and caches it', async () => {
    const apiData = { clientes: [{ id: 'cli_1', nombre: 'Juan', visitado: false }] };
    mockObtenerVistaDia.mockResolvedValue(apiData);

    const { result } = await renderHook(() => useVistaDia('ruta_1', '2025-01-08'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(apiData);
    expect(mockUpsertVistaDiaCache).toHaveBeenCalledWith('ruta_1', '2025-01-08', apiData);
  });

  it('falls back to cached vista dia when offline', async () => {
    mockObtenerVistaDia.mockRejectedValue(new Error('Network Error'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    const cacheData = { clientes: [{ id: 'cli_1', nombre: 'Ana', visitado: false }] };
    mockGetVistaDiaCache.mockReturnValue(cacheData);

    const { result } = await renderHook(() => useVistaDia('ruta_1', '2025-01-08'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(cacheData);
    expect(mockGetVistaDiaCache).toHaveBeenCalledWith('ruta_1', '2025-01-08');
  });
});

describe('useMarcarVisitado', () => {
  const params = { rcId: 'rc_1', visitado: true, rutaId: 'ruta_1', fecha: '2025-01-08' };

  it('marks visitado via API when online', async () => {
    mockMarcarVisitadoApi.mockResolvedValue({ success: true });

    const { result } = await renderHook(() => useMarcarVisitado(), { wrapper: createWrapper() });

    result.current.mutate(params);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMarcarVisitadoApi).toHaveBeenCalledWith('rc_1', true);
  });

  it('queues marcarVisitado when offline', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'visita_temp_123' });
    mockGetRutaClienteById.mockReturnValue({ clienteId: 'cli_1' });
    mockGetClienteNombre.mockReturnValue('Ana Pérez');

    const { result } = await renderHook(() => useMarcarVisitado(), { wrapper: createWrapper() });

    result.current.mutate(params);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockMarcarVisitadoApi).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/rutas/clientes/rc_1/visita',
        method: 'PATCH',
        tempDisplay: expect.objectContaining({
          rcId: 'rc_1',
          visitado: true,
          clienteNombre: 'Ana Pérez',
        }),
      }),
    );
    expect(result.current.data?.esOffline).toBe(true);
  });
});

describe('useResetVisitados', () => {
  it('resets visitados via API when online', async () => {
    mockResetVisitadosApi.mockResolvedValue({ success: true });

    const { result } = await renderHook(() => useResetVisitados(), { wrapper: createWrapper() });

    result.current.mutate({ rutaId: 'ruta_1', fecha: '2025-01-08' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockResetVisitadosApi).toHaveBeenCalled();
  });

  it('queues resetVisitados when offline', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'reset_temp_123' });

    const { result } = await renderHook(() => useResetVisitados(), { wrapper: createWrapper() });

    result.current.mutate({ rutaId: 'ruta_1', fecha: '2025-01-08' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockResetVisitadosApi).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/rutas/reset-visitados', method: 'POST' }),
    );
    expect(result.current.data?.esOffline).toBe(true);
  });
});
