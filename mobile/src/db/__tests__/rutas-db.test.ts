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

import { upsertRutas, getRutas, getRutaById, upsertRutaClientes, getRutaClientes, updateVisitado, upsertVistaDiaCache, getVistaDiaCache, getRutaClienteByClienteId, clearRutas } from '@/db/rutas-db';

const mockRuta = {
  id: 'ruta_1',
  nombre: 'Ruta Norte',
  descripcion: null,
  activa: true,
  empresaId: 'emp_1',
  usuarioId: 'user_1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const mockRutaCliente = {
  id: 'rc_1',
  orden: 1,
  observacion: null,
  visitadoHoy: false,
  ultimaVisita: null,
  fechaRuta: null,
  rutaId: 'ruta_1',
  clienteId: 'cli_1',
};

beforeEach(() => {
  const s = (global as any).__mockDbStores;
  if (s) {
    for (const [, arr] of s) arr.length = 0;
  }
});

describe('upsertRutas / getRutas / getRutaById', () => {
  it('inserts and retrieves rutas', () => {
    upsertRutas([mockRuta]);
    const all = getRutas();
    expect(all).toHaveLength(1);
    expect(all[0].nombre).toBe('Ruta Norte');
  });

  it('updates on conflict', () => {
    upsertRutas([mockRuta]);
    upsertRutas([{ ...mockRuta, nombre: 'Ruta Sur' }]);
    expect(getRutaById('ruta_1')?.nombre).toBe('Ruta Sur');
  });

  it('returns null for non-existent ruta', () => {
    expect(getRutaById('no_existe')).toBeNull();
  });

  it('does nothing for empty list', () => {
    upsertRutas([]);
    expect(getRutas()).toEqual([]);
  });
});

describe('upsertRutaClientes / getRutaClientes', () => {
  it('inserts and retrieves ruta clientes', () => {
    upsertRutaClientes([mockRutaCliente]);
    const all = getRutaClientes('ruta_1');
    expect(all).toHaveLength(1);
    expect(all[0].clienteId).toBe('cli_1');
  });

  it('does nothing for empty list', () => {
    upsertRutaClientes([]);
    expect(getRutaClientes('ruta_1')).toEqual([]);
  });
});

describe('updateVisitado', () => {
  it('updates visitado flag', () => {
    upsertRutaClientes([mockRutaCliente]);
    updateVisitado('rc_1', true);
    const all = getRutaClientes('ruta_1');
    expect(all[0].visitadoHoy).toBe(true);
  });
});

describe('vistaDiaCache', () => {
  const data = { clientes: [{ id: 'cli_1', nombre: 'Juan', visitado: false }] };

  it('stores and retrieves cache', () => {
    upsertVistaDiaCache('ruta_1', '2025-01-08', data);
    const cached = getVistaDiaCache('ruta_1', '2025-01-08');
    expect(cached).toEqual(data);
  });

  it('returns null for missing cache', () => {
    expect(getVistaDiaCache('ruta_1', '2025-01-01')).toBeNull();
  });
});

describe('getRutaClienteByClienteId', () => {
  it('returns rutaCliente for a given cliente', () => {
    upsertRutaClientes([mockRutaCliente]);
    const rc = getRutaClienteByClienteId('cli_1');
    expect(rc).not.toBeNull();
    expect(rc?.rutaId).toBe('ruta_1');
  });

  it('returns null if not found', () => {
    expect(getRutaClienteByClienteId('no_existe')).toBeNull();
  });
});

describe('clearRutas', () => {
  it('removes all rutas and ruta clientes', () => {
    upsertRutas([mockRuta]);
    upsertRutaClientes([mockRutaCliente]);
    clearRutas();
    expect(getRutas()).toEqual([]);
    expect(getRutaClientes('ruta_1')).toEqual([]);
  });
});
