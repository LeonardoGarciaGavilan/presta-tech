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
          }),
          all: () => getStore(table),
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
} from '@/db/prestamos-db';
import { prestamos, cuotas, clientes } from '@/db/schema';

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

const mockPrestamo = {
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

const mockCuota = {
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
