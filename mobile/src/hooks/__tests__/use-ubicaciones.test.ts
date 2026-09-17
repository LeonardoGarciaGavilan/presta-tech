import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { UbicacionCatalogo } from '@/types/ubicaciones.types';

const mockGetCatalogo = jest.fn();
const mockGetVersion = jest.fn();
const mockGetVersionLocal = jest.fn();
const mockGetLocal = jest.fn();
const mockSync = jest.fn();

jest.mock('@/api/ubicaciones.api', () => ({
  getUbicacionesCatalogo: (...args: any[]) => mockGetCatalogo(...args),
  getUbicacionesVersion: (...args: any[]) => mockGetVersion(...args),
}));

jest.mock('@/db/ubicaciones-db', () => ({
  getCatalogoDesdeDb: (...args: any[]) => mockGetLocal(...args),
  getUbicacionesVersion: (...args: any[]) => mockGetVersionLocal(...args),
  syncUbicacionesToDb: (...args: any[]) => mockSync(...args),
}));

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn(),
}));

import { useUbicaciones } from '@/hooks/use-ubicaciones';
import { getNetworkStatus } from '@/hooks/use-network-status';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const catalogo = { version: 'abc123', conteos: {}, provincias: [], municipios: [], distritos: [], secciones: [], barrios: [], subBarrios: [] } as unknown as UbicacionCatalogo;

beforeEach(() => {
  jest.clearAllMocks();
  (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true });
});

describe('useUbicaciones', () => {
  it('online con versión distinta: descarga el catálogo y lo persiste', async () => {
    mockGetVersion.mockResolvedValue({ version: 'abc123' });
    mockGetVersionLocal.mockReturnValue('old');
    mockGetCatalogo.mockResolvedValue(catalogo);

    const { result } = await renderHook(() => useUbicaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetCatalogo).toHaveBeenCalled();
    expect(mockSync).toHaveBeenCalledWith(catalogo);
    expect(result.current.data).toEqual(catalogo);
  });

  it('online con versión ya sincronizada: sirve la copia local sin descargar', async () => {
    mockGetVersion.mockResolvedValue({ version: 'abc123' });
    mockGetVersionLocal.mockReturnValue('abc123');
    mockGetLocal.mockReturnValue(catalogo);

    const { result } = await renderHook(() => useUbicaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetCatalogo).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(catalogo);
  });

  it('offline con copia local: devuelve el catálogo SQLite', async () => {
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    mockGetLocal.mockReturnValue(catalogo);

    const { result } = await renderHook(() => useUbicaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetLocal).toHaveBeenCalled();
    expect(result.current.data).toEqual(catalogo);
  });

  it('offline sin copia local: lanza error', async () => {
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    mockGetLocal.mockReturnValue(null);

    const { result } = await renderHook(() => useUbicaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('online pero servidor inalcanzable: cae a la copia local', async () => {
    mockGetVersion.mockRejectedValue(new Error('network'));
    mockGetLocal.mockReturnValue(catalogo);

    const { result } = await renderHook(() => useUbicaciones(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(catalogo);
  });
});