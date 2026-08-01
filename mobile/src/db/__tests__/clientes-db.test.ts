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
  upsertClientes,
  getClienteById,
  searchClientes,
  getAllCachedClientes,
  deleteCliente,
  clearClientes,
} from '@/db/clientes-db';
import { clientes } from '@/db/schema';

const mockCliente = {
  id: 'cliente_1',
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

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
});

describe('upsertClientes', () => {
  it('does nothing for empty list', () => {
    upsertClientes([]);
    expect(getAllCachedClientes()).toEqual([]);
  });

  it('inserts a new cliente', () => {
    upsertClientes([mockCliente]);
    const result = getClienteById('cliente_1');
    expect(result).toEqual(mockCliente);
  });

  it('updates existing cliente on conflict', () => {
    upsertClientes([mockCliente]);
    upsertClientes([{ ...mockCliente, nombre: 'Carlos' }]);
    const result = getClienteById('cliente_1');
    expect(result?.nombre).toBe('Carlos');
  });
});

describe('getClienteById', () => {
  it('returns null for non-existent id', () => {
    expect(getClienteById('no_existe')).toBeNull();
  });

  it('returns cliente when found', () => {
    upsertClientes([mockCliente]);
    expect(getClienteById('cliente_1')).toEqual(mockCliente);
  });
});

describe('searchClientes', () => {
  it('returns empty array for empty term', () => {
    expect(searchClientes('')).toEqual([]);
  });

  it('returns results by nombre pattern', () => {
    upsertClientes([mockCliente]);
    const results = searchClientes('juan');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getAllCachedClientes', () => {
  it('returns all cached clientes', () => {
    upsertClientes([mockCliente, { ...mockCliente, id: 'cliente_2', nombre: 'Ana' }]);
    const all = getAllCachedClientes();
    expect(all).toHaveLength(2);
  });
});

describe('deleteCliente', () => {
  it('removes cliente by id', () => {
    upsertClientes([mockCliente]);
    deleteCliente('cliente_1');
    expect(getClienteById('cliente_1')).toBeNull();
  });
});

describe('clearClientes', () => {
  it('removes all clientes', () => {
    upsertClientes([mockCliente]);
    clearClientes();
    expect(getAllCachedClientes()).toEqual([]);
  });
});
