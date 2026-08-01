import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockRegistrarPago = jest.fn();
const mockInsertPago = jest.fn();
const mockGetCuotasByPrestamoId = jest.fn();
const mockAddToOfflineQueue = jest.fn();

jest.mock('@/api/pagos.api', () => ({
  registrarPago: (...args: any[]) => mockRegistrarPago(...args),
  obtenerPagos: jest.fn(),
  obtenerPago: jest.fn(),
  obtenerResumenPagos: jest.fn(),
  saldarPrestamo: jest.fn(),
  obtenerTodosPagos: jest.fn(),
}));

jest.mock('@/db/pagos-db', () => ({
  insertPago: (...args: any[]) => mockInsertPago(...args),
}));

jest.mock('@/db/prestamos-db', () => ({
  getCuotasByPrestamoId: (...args: any[]) => mockGetCuotasByPrestamoId(...args),
}));

jest.mock('@/components/providers/network-provider', () => ({
  useNetworkContext: jest.fn(),
}));

jest.mock('@/store/auth.store', () => ({
  useAuthStore: { getState: jest.fn() },
}));

import { useRegistrarPago } from '@/hooks/use-pagos';
import { useNetworkContext } from '@/components/providers/network-provider';
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

describe('useRegistrarPago', () => {
  const dto = {
    prestamoId: 'prestamo_1',
    montoPagado: 3000,
    metodo: 'EFECTIVO' as const,
    cuotaId: 'cuota_1',
    referencia: null,
    observacion: null,
  };

  it('registers payment via API when online', async () => {
    mockRegistrarPago.mockResolvedValue({ pago: { id: 'pago_1' } });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRegistrarPago).toHaveBeenCalledWith(dto);
    expect(mockInsertPago).not.toHaveBeenCalled();
  });

  it('creates synthetic pago offline with proper distribution', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_123' });
    mockGetCuotasByPrestamoId.mockReturnValue([
      { id: 'cuota_1', numero: 1, monto: 3000, capital: 2500, interes: 500, mora: 0, fechaVencimiento: '2025-01-08', pagada: false, prestamoId: 'prestamo_1', createdAt: '2025-01-01' },
    ]);

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRegistrarPago).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/pagos', method: 'POST' }),
    );

    expect(mockInsertPago).toHaveBeenCalledTimes(1);
    const synPago = mockInsertPago.mock.calls[0][0];
    expect(synPago.id).toContain('pago_temp_');
    expect(synPago.prestamoId).toBe('prestamo_1');
    expect(synPago.interes).toBe(500);
    expect(synPago.capital).toBe(2500);
    expect(synPago.mora).toBe(0);
    expect(synPago.montoTotal).toBe(3000);
  });

  it('handles offline payment with mora deduction', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_456' });
    mockGetCuotasByPrestamoId.mockReturnValue([
      { id: 'cuota_2', numero: 2, monto: 3000, capital: 2500, interes: 500, mora: 200, fechaVencimiento: '2025-01-08', pagada: false, prestamoId: 'prestamo_1', createdAt: '2025-01-01' },
    ]);

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate({ ...dto, montoPagado: 3200, cuotaId: 'cuota_2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const synPago = mockInsertPago.mock.calls[0][0];
    expect(synPago.mora).toBe(200);
    expect(synPago.interes).toBe(500);
    expect(synPago.capital).toBe(2500);
    expect(synPago.montoTotal).toBe(3200);
  });

  it('returns offline metadata in response', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_789' });
    mockGetCuotasByPrestamoId.mockReturnValue([]);

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.esOffline).toBe(true);
    expect(result.current.data?.pendingSync).toBe(true);
  });
});
