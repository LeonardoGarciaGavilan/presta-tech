import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockRegistrarPago = jest.fn();
const mockSaldarPrestamoFn = jest.fn();
const mockInsertPago = jest.fn();
const mockGetPagosByPrestamoId = jest.fn();
const mockGetAllPagos = jest.fn();
const mockGetCuotasByPrestamoId = jest.fn();
const mockAplicarPagoLocal = jest.fn();
const mockGetPrestamoById = jest.fn();
const mockGetClienteNombre = jest.fn();
const mockSaldarPrestamoLocal = jest.fn();
const mockAddToOfflineQueue = jest.fn();
let mockIdempotencyCounter = 0;

jest.mock('@/api/pagos.api', () => ({
  registrarPago: (...args: any[]) => mockRegistrarPago(...args),
  obtenerPagos: jest.fn(),
  obtenerPago: jest.fn(),
  obtenerResumenPagos: jest.fn(),
  saldarPrestamo: (...args: any[]) => mockSaldarPrestamoFn(...args),
  obtenerTodosPagos: jest.fn(),
}));

jest.mock('@/db/pagos-db', () => ({
  insertPago: (...args: any[]) => mockInsertPago(...args),
  getPagosByPrestamoId: (...args: any[]) => mockGetPagosByPrestamoId(...args),
  getAllPagos: (...args: any[]) => mockGetAllPagos(...args),
}));

jest.mock('@/db/prestamos-db', () => ({
  getCuotasByPrestamoId: (...args: any[]) => mockGetCuotasByPrestamoId(...args),
  aplicarPagoLocal: (...args: any[]) => mockAplicarPagoLocal(...args),
  getPrestamoById: (...args: any[]) => mockGetPrestamoById(...args),
  saldarPrestamoLocal: (...args: any[]) => mockSaldarPrestamoLocal(...args),
}));

jest.mock('@/db/clientes-db', () => ({
  getClienteNombre: (...args: any[]) => mockGetClienteNombre(...args),
}));

jest.mock('@/components/providers/network-provider', () => ({
  useNetworkContext: jest.fn(),
}));

jest.mock('@/store/auth.store', () => ({
  useAuthStore: { getState: jest.fn() },
}));

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn(),
}));

jest.mock('@/db/offline-queue-db', () => ({
  generateIdempotencyKey: jest.fn(() => `idem_${++mockIdempotencyCounter}`),
}));

import { useRegistrarPago, useSaldarPrestamo, usePagosDePrestamo, useTodosPagos } from '@/hooks/use-pagos';
import { useNetworkContext } from '@/components/providers/network-provider';
import { useAuthStore } from '@/store/auth.store';
import { getNetworkStatus } from '@/hooks/use-network-status';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // C1: la caja activa vive en el cache. Por defecto los tests offline parten
  // con caja abierta; los tests de guard construyen su propio wrapper sin ella.
  queryClient.setQueryData(['caja', 'activa'], { id: 'caja_1', estado: 'ABIERTA' });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function wrapperSinCaja() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['caja', 'activa'], null);
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
  mockGetPrestamoById.mockReturnValue(null);
  mockAplicarPagoLocal.mockReturnValue({
    capital: 0,
    interes: 0,
    mora: 0,
    abonoCapital: 0,
    pagoCompleto: false,
  });
  (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true });
});

describe('useRegistrarPago', () => {
  const dto = {
    prestamoId: 'prestamo_1',
    montoPagado: 3000,
    metodo: 'EFECTIVO' as const,
    cuotaId: 'cuota_1',
  };

  it('registers payment via API when online', async () => {
    mockRegistrarPago.mockResolvedValue({ pago: { id: 'pago_1' } });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRegistrarPago).toHaveBeenCalledWith(dto, expect.any(String));
    expect(mockInsertPago).not.toHaveBeenCalled();
  });

  it('creates synthetic pago offline with proper distribution', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
  mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_123' });
  mockGetPrestamoById.mockReturnValue({
    id: 'prestamo_1',
    clienteId: 'cliente_1',
    saldoPendiente: 5000,
    montoTotal: 10000,
  });
  mockGetClienteNombre.mockReturnValue('Juan Pérez');
  mockGetCuotasByPrestamoId.mockReturnValue([
      { id: 'cuota_1', numero: 1, monto: 3000, capital: 2500, interes: 500, mora: 0, fechaVencimiento: '2025-01-08', pagada: false, prestamoId: 'prestamo_1', createdAt: '2025-01-01' },
    ]);
    mockAplicarPagoLocal.mockReturnValue({
      capital: 2500,
      interes: 500,
      mora: 0,
      abonoCapital: 0,
      pagoCompleto: true,
    });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRegistrarPago).not.toHaveBeenCalled();
    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/pagos',
        method: 'POST',
        tempDisplay: expect.objectContaining({
          prestamoId: 'prestamo_1',
          montoPagado: 3000,
          metodo: 'EFECTIVO',
          clienteNombre: 'Juan Pérez',
        }),
      }),
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
    mockAplicarPagoLocal.mockReturnValue({
      capital: 2500,
      interes: 500,
      mora: 200,
      abonoCapital: 0,
      pagoCompleto: true,
    });

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

  it('rechaza pago offline sin caja abierta (C1)', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: wrapperSinCaja() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockAddToOfflineQueue).not.toHaveBeenCalled();
    expect(mockInsertPago).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toContain('Debes abrir tu caja');
  });

  it('permite pago offline con caja offline abierta (C1)', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_abc' });
    mockGetPrestamoById.mockReturnValue({
      id: 'prestamo_1',
      clienteId: 'cliente_1',
      saldoPendiente: 5000,
      montoTotal: 10000,
    });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
  });

  // 2.6: re-encolado con idempotencyKey estable ante fallo incierto en red
  it('re-encola el cobro con la misma idempotencyKey cuando la red cae durante el POST (2.6)', async () => {
    // online por defecto
    const errorRed = { statusCode: 0, code: 'NETWORK_ERROR', message: 'Network Error' };
    mockRegistrarPago.mockRejectedValue(errorRed);
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_re_1' });
    mockGetPrestamoById.mockReturnValue({
      id: 'prestamo_1',
      clienteId: 'cliente_1',
      saldoPendiente: 5000,
      montoTotal: 10000,
    });
    mockGetClienteNombre.mockReturnValue('Juan Pérez');
    mockGetCuotasByPrestamoId.mockReturnValue([]);
    mockAplicarPagoLocal.mockReturnValue({
      capital: 3000,
      interes: 0,
      mora: 0,
      abonoCapital: 0,
      pagoCompleto: false,
    });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Se intentó la API y también se encoló localmente
    expect(mockRegistrarPago).toHaveBeenCalledWith(dto, expect.any(String));
    const keyEnviada = mockRegistrarPago.mock.calls[0][1];
    expect(typeof keyEnviada).toBe('string');
    expect(keyEnviada.length).toBeGreaterThan(0);

    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/pagos', method: 'POST', idempotencyKey: keyEnviada }),
    );

    expect(mockInsertPago).toHaveBeenCalledTimes(1);
    expect(result.current.data?.esOffline).toBe(true);
    expect(result.current.data?.pendingSync).toBe(true);
  });

  it('re-encola el cobro cuando el servidor responde 5xx durante el POST (2.6)', async () => {
    const error5xx = { statusCode: 502, message: 'Bad Gateway' };
    mockRegistrarPago.mockRejectedValue(error5xx);
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_re_5xx' });
    mockGetPrestamoById.mockReturnValue(null);
    mockGetCuotasByPrestamoId.mockReturnValue([]);
    mockAplicarPagoLocal.mockReturnValue({
      capital: 1000,
      interes: 0,
      mora: 0,
      abonoCapital: 0,
      pagoCompleto: false,
    });

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const key = mockRegistrarPago.mock.calls[0][1];
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: key }),
    );
    expect(result.current.data?.esOffline).toBe(true);
  });

  it('NO re-encola si el servidor responde con error de negocio 400 (2.6)', async () => {
    const errorNegocio = { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Monto inválido' };
    mockRegistrarPago.mockRejectedValue(errorNegocio);

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper: createWrapper() });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockRegistrarPago).toHaveBeenCalledWith(dto, expect.any(String));
    expect(mockAddToOfflineQueue).not.toHaveBeenCalled();
    expect(mockInsertPago).not.toHaveBeenCalled();
    expect((result.current.error as any).statusCode).toBe(400);
  });
});

describe('useSaldarPrestamo', () => {
  const saldarArgs = {
    prestamoId: 'prestamo_1',
    dto: {
      montoCierre: 5000,
      metodo: 'EFECTIVO' as const,
    },
  };

  it('rechaza saldar offline sin caja abierta (C1)', async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });

    const { result } = await renderHook(() => useSaldarPrestamo(), { wrapper: wrapperSinCaja() });

    result.current.mutate(saldarArgs);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockAddToOfflineQueue).not.toHaveBeenCalled();
    expect(mockSaldarPrestamoLocal).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toContain('Debes abrir tu caja');
  });

  // 2.6: re-encolado con idempotencyKey estable para saldar
  it('re-encola saldar con la misma idempotencyKey cuando la red cae durante el POST (2.6)', async () => {
    // online por defecto
    const errorRed = { statusCode: 0, code: 'NETWORK_ERROR', message: 'Network Error' };
    mockSaldarPrestamoFn.mockRejectedValue(errorRed);
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'saldar_temp_re_1' });
    mockGetPrestamoById.mockReturnValue({
      id: 'prestamo_1',
      clienteId: 'cliente_1',
      saldoPendiente: 5000,
      montoTotal: 10000,
    });
    mockGetClienteNombre.mockReturnValue('Juan Pérez');

    const { result } = await renderHook(() => useSaldarPrestamo(), { wrapper: createWrapper() });

    result.current.mutate(saldarArgs);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSaldarPrestamoFn).toHaveBeenCalledWith('prestamo_1', saldarArgs.dto, expect.any(String));
    const key = mockSaldarPrestamoFn.mock.calls[0][2];
    expect(key.length).toBeGreaterThan(0);

    expect(mockAddToOfflineQueue).toHaveBeenCalledTimes(1);
    expect(mockAddToOfflineQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/pagos/saldar/prestamo_1',
        idempotencyKey: key,
      }),
    );
    expect(mockSaldarPrestamoLocal).toHaveBeenCalledWith('prestamo_1');
    expect(result.current.data?.esOffline).toBe(true);
  });
});

describe('usePagosDePrestamo (C6 - fallback offline)', () => {
  const mockPago = {
    id: 'pago_1',
    prestamoId: 'prestamo_1',
    montoPagado: 3000,
    capital: 2500,
    interes: 500,
    mora: 0,
    metodo: 'EFECTIVO' as const,
    estado: 'PAGADO' as const,
    fecha: '2025-01-08',
    createdAt: '2025-01-08',
    cajaId: 'caja_1',
    montoTotal: 3000,
    clienteNombre: 'Juan Pérez',
  };

  it('usa la API cuando hay conexión', async () => {
    const mockObtenerPagos = require('@/api/pagos.api').obtenerPagos as jest.Mock;
    mockObtenerPagos.mockResolvedValue([mockPago]);

    const { result } = await renderHook(() => usePagosDePrestamo('prestamo_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual([mockPago]));
    expect(mockGetPagosByPrestamoId).not.toHaveBeenCalled();
  });

  it('lee el historial local cuando la API falla y no hay conexión', async () => {
    const mockObtenerPagos = require('@/api/pagos.api').obtenerPagos as jest.Mock;
    mockObtenerPagos.mockRejectedValue(new Error('Network request failed'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    mockGetPagosByPrestamoId.mockReturnValue([mockPago]);

    const { result } = await renderHook(() => usePagosDePrestamo('prestamo_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual([mockPago]));
    expect(mockGetPagosByPrestamoId).toHaveBeenCalledWith('prestamo_1');
  });

  it('propaga el error si no hay historial local offline', async () => {
    const mockObtenerPagos = require('@/api/pagos.api').obtenerPagos as jest.Mock;
    mockObtenerPagos.mockRejectedValue(new Error('Network request failed'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    mockGetPagosByPrestamoId.mockReturnValue([]);

    const { result } = await renderHook(() => usePagosDePrestamo('prestamo_1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTodosPagos (C6 - fallback offline)', () => {
  const mockPago = {
    id: 'pago_1',
    prestamoId: 'prestamo_1',
    montoPagado: 3000,
    capital: 2500,
    interes: 500,
    mora: 0,
    metodo: 'EFECTIVO' as const,
    estado: 'PAGADO' as const,
    fecha: '2025-01-08',
    createdAt: '2025-01-08',
    cajaId: 'caja_1',
    montoTotal: 3000,
    clienteNombre: 'Juan Pérez',
  };

  it('usa la API cuando hay conexión', async () => {
    const mockObtenerTodosPagos = require('@/api/pagos.api').obtenerTodosPagos as jest.Mock;
    mockObtenerTodosPagos.mockResolvedValue([mockPago]);

    const { result } = await renderHook(() => useTodosPagos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([mockPago]));
    expect(mockGetAllPagos).not.toHaveBeenCalled();
  });

  it('lee el historial local completo cuando la API falla y no hay conexión', async () => {
    const mockObtenerTodosPagos = require('@/api/pagos.api').obtenerTodosPagos as jest.Mock;
    mockObtenerTodosPagos.mockRejectedValue(new Error('Network request failed'));
    (getNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false });
    mockGetAllPagos.mockReturnValue([mockPago]);

    const { result } = await renderHook(() => useTodosPagos(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([mockPago]));
    expect(mockGetAllPagos).toHaveBeenCalledTimes(1);
  });
});

describe('useRegistrarPago offline actualiza historial en cache (C6)', () => {
  const dto = {
    prestamoId: 'prestamo_1',
    montoPagado: 3000,
    metodo: 'EFECTIVO' as const,
    cuotaId: 'cuota_1',
  };

  it(`setQueryData de ['pagos','prestamo',id] y ['pagos','todos']`, async () => {
    (useNetworkContext as jest.Mock).mockReturnValue({
      network: { isOnline: false },
      addToOfflineQueue: mockAddToOfflineQueue,
    });
    mockAddToOfflineQueue.mockResolvedValue({ tempId: 'pago_temp_c6' });
    mockGetPrestamoById.mockReturnValue({
      id: 'prestamo_1',
      clienteId: 'cliente_1',
      saldoPendiente: 5000,
      montoTotal: 10000,
    });
    mockGetClienteNombre.mockReturnValue('Juan Pérez');
    mockGetCuotasByPrestamoId.mockReturnValue([]);
    mockAplicarPagoLocal.mockReturnValue({
      capital: 0,
      interes: 0,
      mora: 0,
      abonoCapital: 3000,
      pagoCompleto: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['caja', 'activa'], { id: 'caja_1', estado: 'ABIERTA' });
    queryClient.setQueryData(['pagos', 'prestamo', 'prestamo_1'], []);
    queryClient.setQueryData(['pagos', 'todos'], []);
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = await renderHook(() => useRegistrarPago(), { wrapper });

    result.current.mutate(dto);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachePrestamo = queryClient.getQueryData(['pagos', 'prestamo', 'prestamo_1']);
    const cacheTodos = queryClient.getQueryData(['pagos', 'todos']);
    expect(cachePrestamo).toHaveLength(1);
    expect(cacheTodos).toHaveLength(1);
    expect((cachePrestamo as any[])[0].id).toContain('pago_temp_');
    expect((cacheTodos as any[])[0].id).toContain('pago_temp_');
  });
});
