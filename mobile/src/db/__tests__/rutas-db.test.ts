import { upsertRutas, getRutas, getRutaById, upsertRutaClientes, getRutaClientes, updateVisitado, upsertVistaDiaCache, getVistaDiaCache, getRutaClienteByClienteId, clearRutas, deleteRutaClientesExcept, deleteRutas, getRutaClienteById } from '@/db/rutas-db';
import type { VistaDiaResponse } from '@/types/rutas.types';

jest.mock('@/db/index', () => {
  if (!(global as any).__mockDbStores) {
    (global as any).__mockDbStores = new Map();
  }
  const stores = (global as any).__mockDbStores;

  function getStore(table: any) {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table);
  }

  // Evalúa condiciones SQL de drizzle (solo lo que usa rutas-db: eq suelto y
  // and(eq, eq)). Cada eq se serializa como queryChunks de 5: ["", columna, " = ", valor, ""].
  // Las filas del mock usan claves JS (camelCase) mientras el SQL usa nombres
  // de columna (snake_case): se compara contra ambas.
  function evalCond(cond: any, row: any): boolean {
    if (!cond || typeof cond !== 'object' || !Array.isArray(cond.queryChunks)) {
      return true;
    }
    const binaries: { col: string; val: any }[] = [];
    const isBinary = (q: any[]) =>
      q.length >= 5 &&
      q[1] &&
      typeof q[1] === 'object' &&
      typeof q[1].name === 'string' &&
      q[3] &&
      typeof q[3] === 'object' &&
      'value' in q[3];
    const scan = (node: any) => {
      if (!node || typeof node !== 'object' || !Array.isArray(node.queryChunks)) {
        return;
      }
      const q = node.queryChunks;
      if (isBinary(q)) {
        binaries.push({ col: q[1].name, val: q[3].value });
      }
      for (const c of q) {
        if (c && typeof c === 'object' && Array.isArray(c.queryChunks)) {
          scan(c);
        }
      }
    };
    scan(cond);
    const toCamel = (s: string) =>
      s.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
    return binaries.every((b) => {
      const v = (row as any)[b.col] ?? (row as any)[toCamel(b.col)];
      return v === b.val;
    });
  }

  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: (cond: any) => {
            const filtered = (rows: any[]) => rows.filter((r) => evalCond(cond, r));
            return {
              get: () => filtered(getStore(table))[0] ?? null,
              all: () => filtered(getStore(table)),
              limit: (n: number) => ({ all: () => filtered(getStore(table)).slice(0, n) }),
            };
          },
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
        where: (cond: any) => ({
          run: () => {
            const s = getStore(table);
            // Interpreta notInArray/inArray: chunk[2] operador, chunk array de
            // valores (cada uno envuelto en Param por drizzle).
            const chunks = cond?.queryChunks;
            if (cond && Array.isArray(chunks)) {
              const arrChunk = chunks.find((c: any) => Array.isArray(c));
              const vals = new Set(
                (arrChunk ?? []).map((v: any) =>
                  v && typeof v === 'object' && v.value !== undefined ? v.value : v,
                ),
              );
              const op = chunks[2]?.value?.[0]?.trim();
              for (let i = s.length - 1; i >= 0; i--) {
                if (op === 'not in' && !vals.has(s[i].id)) s.splice(i, 1);
                else if (op === 'in' && vals.has(s[i].id)) s.splice(i, 1);
              }
              return;
            }
            s.length = 0;
          },
        }),
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
  const data: VistaDiaResponse = {
    rutaId: 'ruta_1',
    fecha: '2025-01-08',
    esSubRuta: false,
    resumen: {
      totalClientes: 0,
      aVisitarHoy: 0,
      visitadosHoy: 0,
      conAtrasados: 0,
      totalACobrarHoy: 0,
    },
    clientes: [],
  };

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

describe('deleteRutaClientesExcept', () => {
  it('borra solo las rutaClientes ausentes de keepIds', () => {
    upsertRutaClientes([
      mockRutaCliente,
      { ...mockRutaCliente, id: 'rc_2', clienteId: 'cli_2' },
    ]);
    deleteRutaClientesExcept(['rc_1']);
    expect(getRutaClientes('ruta_1').map((rc) => rc.id)).toEqual(['rc_1']);
  });

  it('borra todo si keepIds está vacío', () => {
    upsertRutaClientes([mockRutaCliente]);
    deleteRutaClientesExcept([]);
    expect(getRutaClientes('ruta_1')).toEqual([]);
  });

  it('no borra nada si keepIds incluye todo', () => {
    upsertRutaClientes([
      mockRutaCliente,
      { ...mockRutaCliente, id: 'rc_2', clienteId: 'cli_2' },
    ]);
    deleteRutaClientesExcept(['rc_1', 'rc_2']);
    expect(getRutaClientes('ruta_1')).toHaveLength(2);
  });

  it('trocea por chunks de 400 ids', () => {
    const ids = Array.from({ length: 900 }, (_, i) => `rc_${i + 1}`);
    upsertRutaClientes(ids.map((id, i) => ({ ...mockRutaCliente, id, clienteId: `cli_${i + 1}` })));
    deleteRutaClientesExcept(ids.slice(0, 500));
    const restantes = getRutaClientes('ruta_1').map((rc) => rc.id);
    expect(restantes).toEqual(ids.slice(0, 500));
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

describe('C8: soft-delete de RutaCliente', () => {
  const eliminado = { ...mockRutaCliente, id: 'rc_del', eliminado: true };

  it('upsert persiste el flag eliminado', () => {
    upsertRutaClientes([eliminado]);
    const store = (global as any).__mockDbStores;
    let saved: any = null;
    for (const [, arr] of store) {
      const found = arr.find((r: any) => r.id === 'rc_del');
      if (found) saved = found;
    }
    expect(saved.eliminado).toBe(true);
  });

  it('getRutaClientes excluye los clientes eliminados', () => {
    upsertRutaClientes([mockRutaCliente, eliminado]);
    const list = getRutaClientes('ruta_1');
    expect(list.map((rc) => rc.id)).toEqual(['rc_1']);
  });

  it('getRutaClienteByClienteId no devuelve clientes eliminados', () => {
    upsertRutaClientes([eliminado]);
    expect(getRutaClienteByClienteId('cli_1')).toBeNull();
    expect(getRutaClienteById('rc_del')).toBeNull();
  });

  it('getRutaClienteById devuelve los no eliminados', () => {
    upsertRutaClientes([mockRutaCliente]);
    const rc = getRutaClienteById('rc_1');
    expect(rc).not.toBeNull();
    expect(rc?.eliminado).toBe(false);
  });

  it('un cliente re-agregado vuelve a aparecer (eliminado:false)', () => {
    upsertRutaClientes([eliminado]);
    upsertRutaClientes([{ ...mockRutaCliente, eliminado: false }]);
    expect(getRutaClientes('ruta_1')).toHaveLength(1);
  });

  it('deleteRutas borra rutas y sus rutaClientes', () => {
    upsertRutas([mockRuta]);
    upsertRutas([{ ...mockRuta, id: 'ruta_2' }]);
    upsertRutaClientes([mockRutaCliente]);
    upsertRutaClientes([{ ...mockRutaCliente, id: 'rc_2', rutaId: 'ruta_2', clienteId: 'cli_2' }]);

    deleteRutas(['ruta_2']);

    expect(getRutaById('ruta_2')).toBeNull();
    expect(getRutaById('ruta_1')).not.toBeNull();
    expect(getRutaClientes('ruta_1').map((rc) => rc.id)).toEqual(['rc_1']);
  });

  it('deleteRutas con lista vacía es un no-op', () => {
    upsertRutas([mockRuta]);
    deleteRutas([]);
    expect(getRutas()).toHaveLength(1);
  });
});
