import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { registrarPago,
  obtenerPagos,
  obtenerPago,
  obtenerResumenPagos,
  saldarPrestamo,
  obtenerTodosPagos } from '@/api/pagos.api';
import type {
  CreatePagoDto,
  SaldarPrestamoDto,
  Pago,
} from '@/types/prestamo.types';
import { useNetworkContext } from '@/components/providers/network-provider';
import { insertPago, getPagosByPrestamoId, getAllPagos } from '@/db/pagos-db';
import { aplicarPagoLocal, getPrestamoById, saldarPrestamoLocal } from '@/db/prestamos-db';
import { getClienteNombre } from '@/db/clientes-db';
import { useAuthStore } from '@/store/auth.store';
import { getFechaRD } from '@/utils/formatters';
import { getNetworkStatus } from '@/hooks/use-network-status';
import { generateIdempotencyKey } from '@/db/offline-queue-db';

/** Errors de red / timeout / 5xx / 408 / 429: no sabemos si el servidor aplicó el
 *  pago, así que re-encolamos con la misma idempotencyKey para que el replay
 *  del backend deduplique. */
function esFalloDeRedOIncierto(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return !status || status === 408 || status === 429 || (status >= 500 && status < 600);
}

// C1: paridad con el guard del backend (assertCajaAbierta). El backend rechaza
// pagos sin caja abierta; offline no existe esa validación, así que se replica
// leyendo la caja activa del cache de react-query (incluye la caja offline
// creada por useAbrirCaja).
function assertCajaAbiertaOffline(queryClient: QueryClient): void {
  const cajas = queryClient.getQueriesData({ queryKey: ['caja', 'activa'] });
  const abierta = cajas.some(([, data]) => {
    const c = data as { estado?: string } | null | undefined;
    return !!c && c.estado === 'ABIERTA';
  });
  if (!abierta) {
    throw new Error(
      'Debes abrir tu caja antes de registrar pagos. Ve a la sección Caja para abrirla.',
    );
  }
}

/**
 * 2.6: Aplica el pago localmente (aplicarPagoLocal + synthetic pago + cache) y
 * encola en la cola offline. Se usa tanto en el camino offline puro como en el
 * re-encolado tras fallo de red incierto durante el POST.
 *
 * @param opts.validarLocal  — false cuando re-encolamos tras fallo incierto: el
 *   servidor ya validó (caja abierta, monto ≤ saldo), así que no repetimos esas
 *   validaciones que podrían fallar con datos stale en cache.
 */
async function encolarPagoOffline(
  queryClient: QueryClient,
  addToOfflineQueue: (item: any) => Promise<any>,
  dto: CreatePagoDto,
  opts?: { validarLocal?: boolean; idempotencyKey?: string },
): Promise<Record<string, unknown>> {
  const validarLocal = opts?.validarLocal ?? true;
  if (validarLocal) {
    assertCajaAbiertaOffline(queryClient);
  }
  const usuarioId = useAuthStore.getState().user?.id || '';
  const prestamoLocal = getPrestamoById(dto.prestamoId);
  if (validarLocal && prestamoLocal && dto.montoPagado > prestamoLocal.saldoPendiente + 0.001) {
    throw new Error(
      `El monto del pago ($${dto.montoPagado.toLocaleString()}) excede el saldo pendiente ($${prestamoLocal.saldoPendiente.toLocaleString()}).`,
    );
  }
  const dtoConFecha = { ...dto, fecha: getFechaRD() };
  const tempId = `pago_temp_${Date.now()}`;
  const item = await addToOfflineQueue({
    endpoint: '/pagos',
    method: 'POST',
    data: dtoConFecha,
    snapshot: prestamoLocal ? { prestamo: prestamoLocal } : undefined,
    queryKeys: [
      ['pagos'],
      ['pagos', 'resumen'],
      ['pagos', 'todos'],
      ['pagos', 'prestamo', dto.prestamoId],
      ['prestamos', dto.prestamoId],
      ['prestamos'],
      ['caja'],
    ],
    tempId,
    tempDisplay: {
      prestamoId: dto.prestamoId,
      montoPagado: dto.montoPagado,
      metodo: dto.metodo,
      clienteNombre: prestamoLocal?.clienteId
        ? getClienteNombre(prestamoLocal.clienteId)
        : undefined,
    },
    ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
  });
  const now = new Date().toISOString();
  const distribucion = aplicarPagoLocal(dto.prestamoId, dto.cuotaId, dto.montoPagado);
  const syntheticPago: Pago = {
    id: tempId,
    montoTotal: dto.montoPagado,
    capital: distribucion.capital,
    interes: distribucion.interes,
    mora: distribucion.mora,
    metodo: dto.metodo,
    referencia: dto.referencia || null,
    observacion: dto.observacion || null,
    createdAt: now,
    usuarioId,
    prestamoId: dto.prestamoId,
    cajaId: null,
  };
  insertPago(syntheticPago);
  // C6: el historial local (['pagos','prestamo',id] y ['pagos','todos'])
  // se actualiza de inmediato para ver el pago offline al instante.
  queryClient.setQueryData<Pago[]>(
    ['pagos', 'prestamo', dto.prestamoId],
    (old) => [syntheticPago, ...(old ?? [])],
  );
  queryClient.setQueryData<Pago[]>(['pagos', 'todos'], (old) => [
    syntheticPago,
    ...(old ?? []),
  ]);
  return {
    pago: syntheticPago,
    prestamo: {
      id: dto.prestamoId,
      monto: 0,
      saldoPendiente: 0,
    },
    cliente: {
      nombre: 'Pendiente de sincronización',
      apellido: '',
      cedula: '',
    },
    cuota: null,
    usuario: { nombre: '' },
    esOffline: true,
    pendingSync: true,
  };
}

export function useRegistrarPago() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (dto: CreatePagoDto) => {
      if (!network.isOnline) {
        return encolarPagoOffline(queryClient, addToOfflineQueue, dto);
      }
      // 2.6: generamos la key ANTES de intentar; si la red cae a mitad del
      // POST y re-encolamos, usamos la misma key para que el backend deduplique
      // si el pago ya se aplicó en el servidor.
      const idempotencyKey = generateIdempotencyKey();
      try {
        return await registrarPago(dto, idempotencyKey);
      } catch (error) {
        if (esFalloDeRedOIncierto(error)) {
          return encolarPagoOffline(queryClient, addToOfflineQueue, dto, {
            validarLocal: false,
            idempotencyKey,
          });
        }
        throw error;
      }
    },
    onSuccess: (_data, dto) => {
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['offline-queue', 'pagos', dto.prestamoId] });
    },
  });
}

export function usePagosDePrestamo(prestamoId: string) {
  return useQuery({
    queryKey: ['pagos', 'prestamo', prestamoId],
    queryFn: async () => {
      try {
        return await obtenerPagos(prestamoId);
      } catch {
        // C6: sin conexión se lee el historial local (incluye los pagos
        // offline sintéticos encolados).
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getPagosByPrestamoId(prestamoId);
          if (local.length > 0) return local;
        }
        throw new Error('Error al cargar los pagos del préstamo');
      }
    },
    enabled: !!prestamoId,
  });
}

export function usePago(id: string) {
  return useQuery({
    queryKey: ['pagos', id],
    queryFn: () => obtenerPago(id),
    enabled: !!id,
  });
}

export function useResumenPagos() {
  return useQuery({
    queryKey: ['pagos', 'resumen'],
    queryFn: () => obtenerResumenPagos(),
  });
}

export function useSaldarPrestamo() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({
      prestamoId,
      dto,
    }: {
      prestamoId: string;
      dto: SaldarPrestamoDto;
    }) => {
      if (!network.isOnline) {
        assertCajaAbiertaOffline(queryClient);
        const dtoConFecha = { ...dto, fecha: getFechaRD() };
        const prestamoLocal = getPrestamoById(prestamoId);
        const item = await addToOfflineQueue({
          endpoint: `/pagos/saldar/${prestamoId}`,
          method: 'POST',
          data: dtoConFecha,
          snapshot: prestamoLocal ? { prestamo: prestamoLocal } : undefined,
          queryKeys: [
            ['prestamos', prestamoId],
            ['prestamos'],
            ['pagos', 'prestamo', prestamoId],
            ['pagos', 'resumen'],
            ['pagos', 'todos'],
            ['caja'],
          ],
          tempId: `saldar_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId,
            metodo: dto.metodo,
            montoTotal: prestamoLocal?.montoTotal,
            clienteNombre: prestamoLocal?.clienteId
              ? getClienteNombre(prestamoLocal.clienteId)
              : undefined,
          },
        });
        saldarPrestamoLocal(prestamoId);
        return {
          cajaId: null,
          esperado: 0,
          montoCierre: 0,
          diferencia: 0,
          estado: 'PAGADO',
          esOffline: true,
          tempId: item.tempId,
        };
      }
      // 2.6: re-encolado con la misma key ante fallo incierto en red.
      const idempotencyKey = generateIdempotencyKey();
      try {
        return await saldarPrestamo(prestamoId, dto, idempotencyKey);
      } catch (error) {
        if (!esFalloDeRedOIncierto(error)) throw error;
        assertCajaAbiertaOffline(queryClient);
        const dtoConFecha = { ...dto, fecha: getFechaRD() };
        const prestamoLocal = getPrestamoById(prestamoId);
        const item = await addToOfflineQueue({
          endpoint: `/pagos/saldar/${prestamoId}`,
          method: 'POST',
          data: dtoConFecha,
          snapshot: prestamoLocal ? { prestamo: prestamoLocal } : undefined,
          queryKeys: [
            ['prestamos', prestamoId],
            ['prestamos'],
            ['pagos', 'prestamo', prestamoId],
            ['pagos', 'resumen'],
            ['pagos', 'todos'],
            ['caja'],
          ],
          tempId: `saldar_temp_${Date.now()}`,
          tempDisplay: {
            prestamoId,
            metodo: dto.metodo,
            montoTotal: prestamoLocal?.montoTotal,
            clienteNombre: prestamoLocal?.clienteId
              ? getClienteNombre(prestamoLocal.clienteId)
              : undefined,
          },
          idempotencyKey,
        });
        saldarPrestamoLocal(prestamoId);
        return {
          cajaId: null,
          esperado: 0,
          montoCierre: 0,
          diferencia: 0,
          estado: 'PAGADO',
          esOffline: true,
          tempId: item.tempId,
        };
      }
    },
    onSuccess: (_data, { prestamoId }) => {
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['caja'] });
      queryClient.invalidateQueries({ queryKey: ['offline-queue', 'pagos', prestamoId] });
    },
  });
}

export function useTodosPagos() {
  return useQuery({
    queryKey: ['pagos', 'todos'],
    queryFn: async () => {
      try {
        return await obtenerTodosPagos();
      } catch {
        // C6: sin conexión se lee el historial local completo.
        const network = getNetworkStatus();
        if (!network.isOnline) {
          const local = getAllPagos();
          if (local.length > 0) return local;
        }
        throw new Error('Error al cargar los pagos');
      }
    },
  });
}
