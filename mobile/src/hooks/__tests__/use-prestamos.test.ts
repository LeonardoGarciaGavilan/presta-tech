import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockListar = jest.fn();
const mockCrear = jest.fn();
const mockCambiarEstado = jest.fn();
const mockGetAllCachedPrestamos = jest.fn();
const mockGetPrestamoById = jest.fn();
const mockGetClienteNombre = jest.fn();
const mockGetClienteById = jest.fn();
const mockUpsertPrestamos = jest.fn();
const mockAddToOfflineQueue = jest.fn();

jest.mock('@/api/prestamos.api', () => ({
  listar: (...args: any[]) => mockListar(...args),
  crear: (...args: any[]) => mockCrear(...args),
  cambiarEstado: (...args: any[]) => mockCambiarEstado(...args),
  obtener: jest.fn(),
  actualizar: jest.fn(),
  cancelar: jest.fn(),
  desembolsar: jest.fn(),
  refinanciar: jest.fn(),
  calcularTabla: jest.fn(),
  getResumen: jest.fn(),
  getSolicitudes: jest.fn(),
}));

jest.mock('@/db/prestamos-db', () => ({
  getAllCachedPrestamos: (...args: any[]) => mockGetAllCachedPrestamos(...args),
  getPrestamoById: (...args: any[]) => mockGetPrestamoById(...args),
  upsertPrestamos: (...args: any[]) => mockUpsertPrestamos(...args),
}));

jest.mock('@/db/clientes-db', () => ({
  getClienteNombre: (...args: any[]) => mockGetClienteNombre(...args),
  getClienteById: (...args: any[]) => mockGetClienteById(...args),
}));

jest.mock('@/components/providers/network-provider', () => ({
  useNetworkContext: jest.fn(),
}));

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn(),
}));

jest.mock('@/store/auth.store', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

import { usePrestamos, useCrearPrestamo, useCambiarEstadoPrestamo } from '@/hooks/use-prestamos';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { useAuthStore } from '@/store/auth.store';

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
  (useAuthStore.getState as jest.Mock).mockReturnValue({
    user: { id: 'user_1', empresaId: 'emp_1' },
  });
});

describe('usePrestamos', () => {
  it('fetches prestamos from API when online', async () => {
    const apiData = { data: [{ id: '1', monto: 10000 }], total: 1, pagina: 1, porPagina: 20, totalPaginas: 1 };
    mockListar.mockResolvedValue(apiData);

    const { result } = await renderHook(() => usePrestamos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(apiData);
  });

  it('falls back to cached prestamos when API fails and offline', async () => {
    mockListar.mockRejectedValue(new Error('Network Error'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    const cacheData = [{ id: 'cached_1', monto: 5000 }];
    mockGetAllCachedPrestamos.mockReturnValue(cacheData);

    const { result } = await renderHook(() => usePrestamos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(cacheData);
    expect(mockGetAllCachedPrestamos).toHaveBeenCalledTimes(1);
  });

  it('re-throws error when API fails and online', async () => {
    mockListar.mockRejectedValue(new Error('Server Error'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true });

    const { result } = await renderHook(() => usePrestamos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCrearPrestamo', () => {
  const dto = { clienteId: 'cli_1', monto: 10000, tasaInteres: 5, numeroCuotas: 4, frecuenciaPago: 'SEMANAL' as const };

  it('creates prestamo via API when online', async () => {
    mockCrear.mockResolvedValue({ id: '1', ...dto });

    const { result } = await renderHook(() => useCrearPrestamo(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCrear).toHaveBeenCalledWith(dto);
  });

  it('creates synthetic prestamo offline and upserts', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'prestamo_temp_123' });
    mockGetClienteNombre.mockReturnValue('María Gómez');
    mockGetClienteById.mockReturnValue({ cedula: '001-0000000-1' });

    const { result } = await renderHook(() => useCrearPrestamo(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCrear).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/prestamos',
        method: 'POST',
        tempDisplay: expect.objectContaining({
          clienteNombre: 'María Gómez',
          clienteCedula: '001-0000000-1',
          monto: 10000,
        }),
      }),
    );
    expect(mockUpsertPrestamos).toHaveBeenCalledTimes(1);
    const synPrestamo = mockUpsertPrestamos.mock.calls[0][0][0];
    expect(synPrestamo.id).toContain('prestamo_temp_');
    expect(synPrestamo.empresaId).toBe('emp_1');
    expect(synPrestamo.estado).toBe('SOLICITADO');
    expect(synPrestamo.clienteId).toBe('cli_1');
  });
});

describe('useCambiarEstadoPrestamo', () => {
  const dto = { id: '1', data: { estado: 'APROBADO' as const } };
  const prevData = { id: '1', estado: 'SOLICITADO' };

  it('changes estado via API when online', async () => {
    mockCambiarEstado.mockResolvedValue({ id: '1', estado: 'APROBADO' });

    const { result } = await renderHook(() => useCambiarEstadoPrestamo(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCambiarEstado).toHaveBeenCalledWith('1', { estado: 'APROBADO' });
  });

  it('queues estado change when offline', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'estado_temp_123' });

    const { result } = await renderHook(() => useCambiarEstadoPrestamo(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCambiarEstado).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/prestamos/1/estado', method: 'PATCH' }),
    );
    expect(result.current.data?.estado).toBe('APROBADO');
  });

  it('rolls back optimistic update on API error', async () => {
    mockCambiarEstado.mockRejectedValue(new Error('Server Error'));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['prestamos', '1'], prevData);

    const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };

    const { result } = await renderHook(() => useCambiarEstadoPrestamo(), { wrapper });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData(['prestamos', '1']);
    expect(cached).toEqual(prevData);
  });
});
