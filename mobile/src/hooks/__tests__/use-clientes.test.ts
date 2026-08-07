import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockListar = jest.fn();
const mockCrear = jest.fn();
const mockEliminar = jest.fn();
const mockReactivar = jest.fn();
const mockGetAllCachedClientes = jest.fn();
const mockGetClienteById = jest.fn();
const mockGetClienteNombre = jest.fn();
const mockUpsertClientes = jest.fn();
const mockAddToOfflineQueue = jest.fn();
const mockSetQueryData = jest.fn();

jest.mock('@/api/clientes.api', () => ({
  listar: (...args: any[]) => mockListar(...args),
  crear: (...args: any[]) => mockCrear(...args),
  eliminar: (...args: any[]) => mockEliminar(...args),
  reactivar: (...args: any[]) => mockReactivar(...args),
  obtener: jest.fn(),
  actualizar: jest.fn(),
  uploadCedula: jest.fn(),
  getCedulaSignedUrl: jest.fn(),
}));

jest.mock('@/db/clientes-db', () => ({
  getAllCachedClientes: (...args: any[]) => mockGetAllCachedClientes(...args),
  getClienteById: (...args: any[]) => mockGetClienteById(...args),
  getClienteNombre: (...args: any[]) => mockGetClienteNombre(...args),
  upsertClientes: (...args: any[]) => mockUpsertClientes(...args),
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

import { useClientes, useCrearCliente, useEliminarCliente, useReactivarCliente } from '@/hooks/use-clientes';
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

describe('useClientes', () => {
  it('fetches clientes from API when online', async () => {
    const apiData = { data: [{ id: '1', nombre: 'Juan' }], total: 1, pagina: 1, porPagina: 20, totalPaginas: 1 };
    mockListar.mockResolvedValue(apiData);

    const { result } = await renderHook(() => useClientes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(apiData);
    expect(mockListar).toHaveBeenCalledTimes(1);
  });

  it('falls back to cached clientes when API fails and offline', async () => {
    mockListar.mockRejectedValue(new Error('Network Error'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    const cacheData = [{ id: 'cached_1', nombre: 'Ana' }];
    mockGetAllCachedClientes.mockReturnValue(cacheData);

    const { result } = await renderHook(() => useClientes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toEqual(cacheData);
    expect(mockGetAllCachedClientes).toHaveBeenCalledTimes(1);
  });

  it('re-throws error when API fails and online', async () => {
    mockListar.mockRejectedValue(new Error('Server Error'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true });

    const { result } = await renderHook(() => useClientes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCrearCliente', () => {
  const dto = { nombre: 'Juan', apellido: 'Pérez', cedula: '001-0000001-1', celular: null, email: null, provincia: null, municipio: null, sector: null, direccion: null, ocupacion: null, empresaLaboral: null, ingresos: 0, telefono: '', latitud: null, longitud: null, tipo: 'NORMAL' as const };

  it('creates cliente via API when online', async () => {
    mockCrear.mockResolvedValue({ id: '1', ...dto });

    const { result } = await renderHook(() => useCrearCliente(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCrear).toHaveBeenCalledWith(dto);
  });

  it('creates synthetic cliente offline and adds to queue', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'cliente_temp_123' });

    const { result } = await renderHook(() => useCrearCliente(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCrear).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/clientes', method: 'POST' }),
    );
    expect(mockUpsertClientes).toHaveBeenCalledTimes(1);
    const synCliente = mockUpsertClientes.mock.calls[0][0][0];
    expect(synCliente.id).toContain('cliente_temp_');
    expect(synCliente.empresaId).toBe('emp_1');
    expect(synCliente.nombre).toBe('Juan');
  });
});

describe('useEliminarCliente', () => {
  it('deletes via API when online', async () => {
    mockEliminar.mockResolvedValue({ id: '1' });

    const { result } = await renderHook(() => useEliminarCliente(), { wrapper: createWrapper() });

    result.current.mutate('1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockEliminar).toHaveBeenCalledWith('1');
  });

  it('queues delete when offline', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'del_temp' });

    const { result } = await renderHook(() => useEliminarCliente(), { wrapper: createWrapper() });

    result.current.mutate('1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockEliminar).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/clientes/1', method: 'DELETE' }),
    );
  });
});

describe('useReactivarCliente', () => {
  it('reactivates via API when online', async () => {
    mockReactivar.mockResolvedValue({ id: '1', activo: true });

    const { result } = await renderHook(() => useReactivarCliente(), { wrapper: createWrapper() });

    result.current.mutate('1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockReactivar).toHaveBeenCalledWith('1');
  });

  it('queues reactivation when offline', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'reac_temp' });

    const { result } = await renderHook(() => useReactivarCliente(), { wrapper: createWrapper() });

    result.current.mutate('1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockReactivar).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/clientes/1/reactivar', method: 'PATCH' }),
    );
  });
});
