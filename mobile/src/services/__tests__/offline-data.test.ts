import { getClientesOffline, getPrestamosOffline } from '@/services/offline-data';
import { clientes, prestamos, cuotas } from '@/db/schema';

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

const mockCliente1 = {
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

const mockCliente2 = {
  ...mockCliente1,
  id: 'cli_2',
  nombre: 'María',
  apellido: 'Gómez',
  cedula: '002-0000002-2',
  createdAt: '2025-01-02T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

const mockCliente3 = {
  ...mockCliente1,
  id: 'cli_3',
  nombre: 'Carlos',
  apellido: 'López',
  cedula: '003-0000003-3',
  activo: false,
  createdAt: '2025-01-03T00:00:00.000Z',
  updatedAt: '2025-01-03T00:00:00.000Z',
};

const mockPrestamo1 = {
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
  createdAt: '2025-01-03T00:00:00.000Z',
};

const mockPrestamo2 = {
  ...mockPrestamo1,
  id: 'prestamo_2',
  estado: 'PAGADO',
  clienteId: 'cli_2',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const mockPrestamo3 = {
  ...mockPrestamo1,
  id: 'prestamo_3',
  estado: 'ATRASADO',
  clienteId: 'cli_3',
  createdAt: '2025-01-02T00:00:00.000Z',
};

function seed(rows: [any, any[]][]) {
  const store = (global as any).__mockDbStores;
  for (const [table, items] of rows) {
    if (!store.has(table)) store.set(table, []);
    store.get(table).push(...items);
  }
}

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
  seed([
    [clientes, [mockCliente1, mockCliente2, mockCliente3]],
    [prestamos, [mockPrestamo1, mockPrestamo2, mockPrestamo3]],
    [cuotas, []],
  ]);
});

describe('getClientesOffline', () => {
  it('devuelve solo clientes activos por defecto', () => {
    const res = getClientesOffline();
    expect(res.data.map((c) => c.id)).toEqual(['cli_2', 'cli_1']);
    expect(res.total).toBe(2);
    expect(res.pagina).toBe(1);
    expect(res.totalPaginas).toBe(1);
  });

  it('incluye inactivos cuando verInactivos es true', () => {
    const res = getClientesOffline('', true);
    expect(res.data.map((c) => c.id)).toEqual(['cli_3', 'cli_2', 'cli_1']);
    expect(res.total).toBe(3);
  });

  it('filtra por nombre', () => {
    const res = getClientesOffline('maría');
    expect(res.data.map((c) => c.id)).toEqual(['cli_2']);
  });

  it('filtra por cédula', () => {
    const res = getClientesOffline('003-0000003-3', true);
    expect(res.data.map((c) => c.id)).toEqual(['cli_3']);
  });

  it('devuelve vacío cuando no hay coincidencias', () => {
    const res = getClientesOffline('inexistente');
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
    expect(res.totalPaginas).toBe(1);
  });
});

describe('getPrestamosOffline', () => {
  it('devuelve todos los préstamos sin filtro de estado', () => {
    const res = getPrestamosOffline();
    expect(res.data.map((p) => p.id)).toEqual(['prestamo_1', 'prestamo_3', 'prestamo_2']);
    expect(res.total).toBe(3);
    expect(res.totalPaginas).toBe(1);
  });

  it('filtra por estado', () => {
    const res = getPrestamosOffline('', 'ATRASADO');
    expect(res.data.map((p) => p.id)).toEqual(['prestamo_3']);
  });

  it('filtra por nombre de cliente', () => {
    const res = getPrestamosOffline('juan');
    expect(res.data.map((p) => p.id)).toEqual(['prestamo_1']);
  });

  it('devuelve vacío cuando no hay coincidencias', () => {
    const res = getPrestamosOffline('inexistente');
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
  });
});
