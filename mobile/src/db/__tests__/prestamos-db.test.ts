jest.mock('@/db/index', () => {
  if (!(global as any).__mockDbStores) {
    (global as any).__mockDbStores = new Map();
  }
  const stores = (global as any).__mockDbStores;

  function getStore(table: any) {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table);
  }

  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: () => ({
            get: () => getStore(table)[0] ?? null,
            all: () => getStore(table),
            limit: (n: number) => ({ all: () => getStore(table).slice(0, n) }),
            orderBy: () => ({ all: () => getStore(table), get: () => getStore(table)[0] ?? null }),
          }),
          all: () => getStore(table),
          orderBy: () => ({ all: () => getStore(table) }),
        }),
      }),
      insert: (table: any) => ({
        values: (data: any) => ({
          onConflictDoUpdate: () => ({
            run: () => {
              const s = getStore(table);
              const idx = s.findIndex((r: any) => r.id === data.id);
              if (idx >= 0) s[idx] = { ...s[idx], ...data };
              else s.push(data);
            },
          }),
          run: () => { getStore(table).push(data); },
        }),
      }),
      delete: (table: any) => ({
        where: () => ({ run: () => { getStore(table).length = 0; } }),
        run: () => { getStore(table).length = 0; },
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: () => ({ run: () => { Object.assign(getStore(table)[0] || {}, data); } }),
        }),
      }),
    },
  };
});

import {
  upsertPrestamos,
  getPrestamoById,
  upsertCuotas,
  getCuotasByPrestamoId,
  getAllCachedPrestamos,
  clearPrestamos,
  aplicarPagoLocal,
  saldarPrestamoLocal,
} from '@/db/prestamos-db';
import { prestamos, cuotas, clientes } from '@/db/schema';
import { getPagosByPrestamoId } from '@/db/pagos-db';
import type { Prestamo, Cuota } from '@/types/prestamo.types';

const mockCliente = {
  id: 'cli_1',
  nombre: 'Juan',
  apellido: 'Pérez',
  cedula: '001-0000001-1',
  telefono: '809-555-0101',
  celular: null,
  email: null,
  provincia: null,
  municipio: null,
  sector: null,
  direccion: null,
  ocupacion: null,
  empresaLaboral: null,
  ingresos: 0,
  observaciones: null,
  activo: true,
  empresaId: 'emp_1',
  latitud: null,
  longitud: null,
  coordsAproximadas: false,
  cedulaFrontalPath: null,
  cedulaTraseraPath: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockPrestamo: Prestamo = {
  id: 'prestamo_1',
  monto: 10000,
  tasaInteres: 5,
  numeroCuotas: 4,
  montoTotal: 12000,
  saldoPendiente: 10000,
  cuotaMensual: 3000,
  frecuenciaPago: 'SEMANAL',
  fechaInicio: '2025-01-01',
  fechaVencimiento: '2025-02-01',
  moraAcumulada: 0,
  estado: 'ACTIVO',
  refinanciado: false,
  vecesRefinanciado: 0,
  historialRefinanciamiento: null,
  motivoRechazo: null,
  solicitadoPor: null,
  aprobadoPor: null,
  fechaAprobacion: null,
  fechaDesembolso: null,
  modoRapido: false,
  clienteId: 'cli_1',
  garanteId: null,
  empresaId: 'emp_1',
  createdAt: '2025-01-01T00:00:00.000Z',
  cliente: { id: 'cli_1', nombre: 'Juan', apellido: 'Pérez', cedula: '001-0000001-1', telefono: '809-555-0101', celular: null },
  cuotas: [],
  pagos: [],
};

const mockCuota: Cuota = {
  id: 'cuota_1',
  numero: 1,
  monto: 3000,
  capital: 2500,
  interes: 500,
  mora: 0,
  fechaVencimiento: '2025-01-08',
  pagada: false,
  fechaPago: null,
  prestamoId: 'prestamo_1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
  const store = (global as any).__mockDbStores;
  if (!store.has(clientes)) store.set(clientes, []);
  store.get(clientes).push(mockCliente);
});

describe('upsertPrestamos', () => {
  it('does nothing for empty list', () => {
    upsertPrestamos([]);
    expect(getAllCachedPrestamos()).toEqual([]);
  });

  it('inserts a new prestamo with cuotas', () => {
    upsertPrestamos([{ ...mockPrestamo, cuotas: [mockCuota] }]);
    const result = getPrestamoById('prestamo_1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('prestamo_1');
    expect(result?.cuotas).toHaveLength(1);
  });

  it('updates existing prestamo on conflict', () => {
    upsertPrestamos([mockPrestamo]);
    upsertPrestamos([{ ...mockPrestamo, estado: 'PAGADO' }]);
    const result = getPrestamoById('prestamo_1');
    expect(result?.estado).toBe('PAGADO');
  });

  it('hidrata los pagos anidados del servidor en la tabla local (2.2)', () => {
    upsertPrestamos([
      {
        ...mockPrestamo,
        pagos: [
          {
            id: 'pago_1',
            montoTotal: 3000,
            capital: 2700,
            interes: 200,
            mora: 100,
            metodo: 'EFECTIVO' as const,
            referencia: null,
            observacion: null,
            createdAt: '2025-01-02T00:00:00.000Z',
            usuarioId: 'user_1',
            usuario: { id: 'user_1', nombre: 'Ana' },
            prestamoId: 'prestamo_1',
            cajaId: 'caja_1',
          },
        ],
      },
    ]);
    const pagos = getPagosByPrestamoId('prestamo_1');
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({
      id: 'pago_1',
      montoTotal: 3000,
      capital: 2700,
      usuarioId: 'user_1',
      prestamoId: 'prestamo_1',
      cajaId: 'caja_1',
    });
  });

  it('usa createdAt real de la cuota (2.4)', () => {
    upsertPrestamos([
      { ...mockPrestamo, cuotas: [{ ...mockCuota, createdAt: '2025-01-05T00:00:00.000Z' }] },
    ]);
    expect(getPrestamoById('prestamo_1')?.cuotas[0].createdAt).toBe('2025-01-05T00:00:00.000Z');
  });

  it('crea createdAt actual cuando la cuota no lo trae, no la fecha de vencimiento (2.4)', () => {
    const sinCreatedAt: Cuota = { ...mockCuota, createdAt: undefined as unknown as string };
    upsertPrestamos([{ ...mockPrestamo, cuotas: [sinCreatedAt] }]);
    const stored = getPrestamoById('prestamo_1')?.cuotas[0].createdAt;
    expect(stored).toBeDefined();
    expect(stored).not.toBe('2025-01-08');
    expect(new Date(stored as string).getTime()).toBeGreaterThan(0);
  });
});

describe('upsertCuotas', () => {
  it('inserts cuotas and retrieves them', () => {
    upsertCuotas([mockCuota]);
    const cuotasResult = getCuotasByPrestamoId('prestamo_1');
    expect(cuotasResult).toHaveLength(1);
    expect(cuotasResult[0].id).toBe('cuota_1');
  });
});

describe('getPrestamoById', () => {
  it('returns null for non-existent id', () => {
    expect(getPrestamoById('no_existe')).toBeNull();
  });
});

describe('getAllCachedPrestamos', () => {
  it('returns all prestamos', () => {
    upsertPrestamos([mockPrestamo]);
    const all = getAllCachedPrestamos();
    expect(all).toHaveLength(1);
  });
});

describe('clearPrestamos', () => {
  it('removes all prestamos and cuotas', () => {
    upsertPrestamos([{ ...mockPrestamo, cuotas: [mockCuota] }]);
    clearPrestamos();
    expect(getAllCachedPrestamos()).toEqual([]);
    expect(getCuotasByPrestamoId('prestamo_1')).toEqual([]);
  });
});

describe('restore del snapshot (C3)', () => {
  it('upsert con el snapshot previo revierte el saldo mutado localmente', () => {
    // Estado ANTES de la mutación offline (snapshot capturado por use-pagos).
    const snapshotPrestamo = { ...mockPrestamo, saldoPendiente: 10000, cuotas: [mockCuota] };
    // La mutación offline del pago reduce el saldo (10000 → 7000).
    upsertPrestamos([{ ...snapshotPrestamo, saldoPendiente: 7000, cuotas: [{ ...mockCuota, pagada: true }] }]);
    expect(getPrestamoById('prestamo_1')?.saldoPendiente).toBe(7000);

    // Fallo permanente → se restaura el snapshot (idempotente, overwrite total).
    upsertPrestamos([snapshotPrestamo]);
    const restored = getPrestamoById('prestamo_1');
    expect(restored?.saldoPendiente).toBe(10000);
    expect(restored?.cuotas[0].pagada).toBe(false);
  });
});

function cuota(n: number, extra: Partial<Cuota> = {}): Cuota {
  return {
    id: `cuota_${n}`,
    numero: n,
    monto: 3000,
    capital: 2500,
    interes: 500,
    mora: 0,
    fechaVencimiento: '2025-01-08',
    pagada: false,
    fechaPago: null,
    prestamoId: 'prestamo_1',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...extra,
  };
}

function seedConCuotas() {
  upsertPrestamos([
    {
      ...mockPrestamo,
      saldoPendiente: 12000,
      cuotas: [cuota(1), cuota(2), cuota(3), cuota(4)],
    },
  ]);
}

describe('aplicarPagoLocal (offline)', () => {
  it('paga una cuota completa: mora 0, interés y capital, saldo recalculado', () => {
    seedConCuotas();
    const res = aplicarPagoLocal('prestamo_1', 'cuota_1', 3000, '2025-01-08T00:00:00.000Z');
    expect(res).toEqual({
      capital: 2500,
      interes: 500,
      mora: 0,
      abonoCapital: 0,
      pagoCompleto: true,
    });
    const p = getPrestamoById('prestamo_1')!;
    expect(p.saldoPendiente).toBe(9000);
    expect(p.cuotas.find((c) => c.id === 'cuota_1')?.pagada).toBe(true);
  });

  it('pago parcial reduce la cuota sin marcarla pagada', () => {
    seedConCuotas();
    const res = aplicarPagoLocal('prestamo_1', 'cuota_1', 1000);
    expect(res.pagoCompleto).toBe(false);
    expect(res.capital).toBe(500);
    const cuota1 = getPrestamoById('prestamo_1')!.cuotas.find((c) => c.id === 'cuota_1')!;
    expect(cuota1.pagada).toBe(false);
    expect(cuota1.capital).toBe(2000);
    expect(cuota1.interes).toBe(0);
    expect(cuota1.monto).toBe(2000);
    expect(getPrestamoById('prestamo_1')!.saldoPendiente).toBe(11000);
  });

  it('cubre mora → interés → capital en ese orden', () => {
    seedConCuotas();
    upsertCuotas([{ ...cuota(1), mora: 200 }]);
    const res = aplicarPagoLocal('prestamo_1', 'cuota_1', 3200);
    expect(res).toEqual({
      capital: 2500,
      interes: 500,
      mora: 200,
      abonoCapital: 0,
      pagoCompleto: true,
    });
    expect(getPrestamoById('prestamo_1')!.cuotas.find((c) => c.id === 'cuota_1')?.pagada).toBe(true);
  });

  it('excedente cubre interés de cuotas siguientes antes que capital (paridad backend)', () => {
    seedConCuotas();
    const res = aplicarPagoLocal('prestamo_1', 'cuota_1', 3500);
    expect(res.abonoCapital).toBe(500);
    const p = getPrestamoById('prestamo_1')!;
    const cuota2 = p.cuotas.find((c) => c.id === 'cuota_2')!;
    expect(cuota2.interes).toBe(0);
    expect(cuota2.capital).toBe(2500);
    expect(cuota2.monto).toBe(2500);
    expect(p.saldoPendiente).toBe(8500);
  });

  it('excedente cubre mora → interés → capital de cuotas siguientes (paridad backend)', () => {
    seedConCuotas();
    upsertCuotas([{ ...cuota(2), mora: 100 }]);
    const res = aplicarPagoLocal('prestamo_1', 'cuota_1', 3700);
    expect(res).toEqual({
      capital: 2500,
      interes: 500,
      mora: 0,
      abonoCapital: 700,
      pagoCompleto: true,
    });
    const p = getPrestamoById('prestamo_1')!;
    const cuota2 = p.cuotas.find((c) => c.id === 'cuota_2')!;
    expect(cuota2.mora).toBe(0);
    expect(cuota2.interes).toBe(0);
    expect(cuota2.capital).toBe(2400);
    expect(cuota2.monto).toBe(2400);
    expect(p.saldoPendiente).toBe(8400);
  });

  it('devuelve vacío si no quedan cuotas pendientes', () => {
    upsertPrestamos([
      { ...mockPrestamo, cuotas: [{ ...cuota(1), pagada: true }] },
    ]);
    const res = aplicarPagoLocal('prestamo_1', 'cuota_1', 3000);
    expect(res.pagoCompleto).toBe(false);
    expect(res.capital).toBe(0);
  });
});

describe('saldarPrestamoLocal (offline)', () => {
  it('marca todas las cuotas pagadas, saldo 0 y estado PAGADO', () => {
    upsertPrestamos([
      { ...mockPrestamo, saldoPendiente: 12000, moraAcumulada: 100, cuotas: [cuota(1), cuota(2)] },
    ]);
    saldarPrestamoLocal('prestamo_1');
    const p = getPrestamoById('prestamo_1')!;
    expect(p.saldoPendiente).toBe(0);
    expect(p.moraAcumulada).toBe(0);
    expect(p.estado).toBe('PAGADO');
    expect(p.cuotas.every((c) => c.pagada)).toBe(true);
    expect(p.cuotas.every((c) => !!c.fechaPago)).toBe(true);
  });

  it('no-op si el préstamo no existe', () => {
    expect(() => saldarPrestamoLocal('no_existe')).not.toThrow();
  });
});
