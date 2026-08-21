import { initializeDatabase, SCHEMA_VERSION } from '@/db/migrations';

interface FakeDb {
  execAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  withExclusiveTransactionAsync: jest.Mock;
  columns: {
    offline_queue: string[];
    ruta_clientes: string[];
    configuracion: string[];
  };
  calls: string[];
}

function createFakeDb(options: { userVersion?: number } = {}): FakeDb {
  const { userVersion = 0 } = options;
  const calls: string[] = [];
  const columns: FakeDb['columns'] = {
    offline_queue: [
      'id',
      'endpoint',
      'method',
      'data',
      'query_keys',
      'created_at',
      'retry_count',
      'status',
      'temp_id',
      'temp_display',
      'last_error',
      'idempotency_key',
    ],
    ruta_clientes: [
      'id',
      'orden',
      'observacion',
      'visitado_hoy',
      'ultima_visita',
      'ruta_id',
      'cliente_id',
      'fecha_ruta',
    ],
    // Instalaciones previas a v6 no tienen las columnas de reglas de
    // refinanciamiento.
    configuracion: [
      'id',
      'tasa_interes_base',
      'mora_porcentaje_mensual',
      'dias_gracia',
      'permitir_abono_capital',
      'monto_minimo_prestamo',
      'monto_maximo_prestamo',
      'monto_maximo_pago',
      'empresa_id',
      'existe',
    ],
  };

  const execAsync = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('ALTER TABLE offline_queue ADD COLUMN retryable')) {
      columns.offline_queue.push('retryable');
    } else if (sql.includes('ALTER TABLE offline_queue ADD COLUMN snapshot')) {
      columns.offline_queue.push('snapshot');
    } else if (sql.includes('ALTER TABLE ruta_clientes ADD COLUMN eliminado')) {
      columns.ruta_clientes.push('eliminado');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN cuotas_restantes_para_renovar',
      )
    ) {
      columns.configuracion.push('cuotas_restantes_para_renovar');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN max_refinanciamientos_por_prestamo',
      )
    ) {
      columns.configuracion.push('max_refinanciamientos_por_prestamo');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN max_prestamos_activos_por_cliente',
      )
    ) {
      columns.configuracion.push('max_prestamos_activos_por_cliente');
    }
    return [] as unknown as any[];
  });

  const getAllAsync = jest.fn(async (sql: string) => {
    if (sql.includes('PRAGMA table_info(offline_queue)')) {
      return columns.offline_queue.map((name) => ({ name }));
    }
    if (sql.includes('PRAGMA table_info(ruta_clientes)')) {
      return columns.ruta_clientes.map((name) => ({ name }));
    }
    if (sql.includes('PRAGMA table_info(configuracion)')) {
      return columns.configuracion.map((name) => ({ name }));
    }
    return [];
  });

  const withExclusiveTransactionAsync = jest.fn(
    async (cb: (txn: { execAsync: jest.Mock; getAllAsync: jest.Mock }) => Promise<void>) => {
      await cb({ execAsync, getAllAsync });
    },
  );

  return {
    execAsync,
    getFirstAsync: jest.fn(async () => ({ user_version: userVersion })),
    getAllAsync,
    withExclusiveTransactionAsync,
    columns,
    calls,
  };
}

describe('initializeDatabase', () => {
  it('instalación nueva (v0): crea todas las tablas e índices y setea la versión', async () => {
    const db = createFakeDb({ userVersion: 0 });
    await initializeDatabase(db as any);

    const sqls = db.calls.join('\n');
    for (const tabla of [
      'clientes',
      'prestamos',
      'cuotas',
      'pagos',
      'rutas',
      'ruta_clientes',
      'configuracion',
      'offline_queue',
      'sync_meta',
      'caja_activa',
    ]) {
      expect(sqls).toContain(`CREATE TABLE IF NOT EXISTS ${tabla}`);
    }
    expect(sqls).toContain('CREATE INDEX IF NOT EXISTS idx_prestamos_cliente_id');
    expect(sqls).toContain(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    // v0 migra todas las columnas incrementales.
    expect(db.columns.offline_queue).toContain('retryable');
    expect(db.columns.offline_queue).toContain('snapshot');
    expect(db.columns.ruta_clientes).toContain('eliminado');
    expect(db.columns.configuracion).toContain('cuotas_restantes_para_renovar');
    expect(db.columns.configuracion).toContain('max_refinanciamientos_por_prestamo');
    expect(db.columns.configuracion).toContain('max_prestamos_activos_por_cliente');
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('v1 → v7: agrega retryable, snapshot, eliminado, reglas y límite por cliente', async () => {
    const db = createFakeDb({ userVersion: 1 });
    await initializeDatabase(db as any);

    expect(db.columns.offline_queue).toContain('retryable');
    expect(db.columns.offline_queue).toContain('snapshot');
    expect(db.columns.ruta_clientes).toContain('eliminado');
    expect(db.columns.configuracion).toContain('cuotas_restantes_para_renovar');
    expect(db.columns.configuracion).toContain('max_refinanciamientos_por_prestamo');
    expect(db.columns.configuracion).toContain('max_prestamos_activos_por_cliente');
  });

  it('v2 → v6: NO reintenta retryable pero agrega snapshot, eliminado y reglas', async () => {
    const db = createFakeDb({ userVersion: 2 });
    db.columns.offline_queue.push('retryable');
    await initializeDatabase(db as any);

    expect(db.calls.join('\n')).not.toContain(
      'ALTER TABLE offline_queue ADD COLUMN retryable',
    );
    expect(db.columns.offline_queue).toContain('snapshot');
    expect(db.columns.ruta_clientes).toContain('eliminado');
    expect(db.columns.configuracion).toContain('cuotas_restantes_para_renovar');
  });

  it('v3 → v6: agrega snapshot, eliminado y reglas; no toca retryable', async () => {
    const db = createFakeDb({ userVersion: 3 });
    db.columns.offline_queue.push('retryable');
    db.columns.offline_queue.push('snapshot');
    await initializeDatabase(db as any);

    expect(db.calls.join('\n')).not.toContain('ALTER TABLE offline_queue');
    expect(db.columns.ruta_clientes).toContain('eliminado');
    expect(db.columns.configuracion).toContain('max_refinanciamientos_por_prestamo');
  });

  it('v4 → v6: agrega eliminado y reglas de refinanciamiento', async () => {
    const db = createFakeDb({ userVersion: 4 });
    db.columns.offline_queue.push('retryable');
    db.columns.offline_queue.push('snapshot');
    await initializeDatabase(db as any);

    expect(db.calls.join('\n')).not.toContain('ALTER TABLE offline_queue');
    expect(db.calls.join('\n')).toContain(
      'ALTER TABLE ruta_clientes ADD COLUMN eliminado INTEGER DEFAULT 0;',
    );
    expect(db.columns.configuracion).toContain('cuotas_restantes_para_renovar');
    expect(db.columns.configuracion).toContain('max_refinanciamientos_por_prestamo');
  });

  it('v5 → v7: agrega reglas de refinanciamiento y límite por cliente', async () => {
    const db = createFakeDb({ userVersion: 5 });
    db.columns.offline_queue.push('retryable');
    db.columns.offline_queue.push('snapshot');
    db.columns.ruta_clientes.push('eliminado');
    await initializeDatabase(db as any);

    expect(db.calls.join('\n')).not.toContain('ALTER TABLE offline_queue');
    expect(db.calls.join('\n')).not.toContain('ALTER TABLE ruta_clientes');
    expect(db.calls.join('\n')).toContain(
      'ALTER TABLE configuracion ADD COLUMN cuotas_restantes_para_renovar INTEGER DEFAULT 0;',
    );
    expect(db.calls.join('\n')).toContain(
      'ALTER TABLE configuracion ADD COLUMN max_refinanciamientos_por_prestamo INTEGER DEFAULT 0;',
    );
    expect(db.calls.join('\n')).toContain(
      'ALTER TABLE configuracion ADD COLUMN max_prestamos_activos_por_cliente INTEGER DEFAULT 0;',
    );
  });

  it('v6 → v7: solo agrega la columna de límite por cliente', async () => {
    const db = createFakeDb({ userVersion: 6 });
    db.columns.offline_queue.push('retryable');
    db.columns.offline_queue.push('snapshot');
    db.columns.ruta_clientes.push('eliminado');
    db.columns.configuracion.push('cuotas_restantes_para_renovar');
    db.columns.configuracion.push('max_refinanciamientos_por_prestamo');
    await initializeDatabase(db as any);

    expect(db.calls.join('\n')).not.toContain(
      'ALTER TABLE configuracion ADD COLUMN cuotas_restantes_para_renovar',
    );
    expect(db.calls.join('\n')).not.toContain(
      'ALTER TABLE configuracion ADD COLUMN max_refinanciamientos_por_prestamo',
    );
    expect(db.calls.join('\n')).toContain(
      'ALTER TABLE configuracion ADD COLUMN max_prestamos_activos_por_cliente INTEGER DEFAULT 0;',
    );
  });

  it(`v${SCHEMA_VERSION}: no hace nada (early return)`, async () => {
    const db = createFakeDb({ userVersion: SCHEMA_VERSION });
    await initializeDatabase(db as any);

    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(db.calls).not.toContain(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });

  it('columna ya existente: no ejecuta el ALTER', async () => {
    const db = createFakeDb({ userVersion: 1 });
    db.columns.offline_queue.push('retryable');
    db.columns.offline_queue.push('snapshot');
    db.columns.ruta_clientes.push('eliminado');
    db.columns.configuracion.push('cuotas_restantes_para_renovar');
    db.columns.configuracion.push('max_refinanciamientos_por_prestamo');
    db.columns.configuracion.push('max_prestamos_activos_por_cliente');
    await initializeDatabase(db as any);

    expect(db.calls.join('\n')).not.toContain('ALTER TABLE');
  });

  it('fallo de la migración es NO-fatal: warn y continúa hasta user_version', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const db = createFakeDb({ userVersion: 1 });
    db.getAllAsync.mockImplementation(async () => {
      throw new Error('DB locked');
    });

    await expect(initializeDatabase(db as any)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    expect(db.calls.join('\n')).toContain(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    warnSpy.mockRestore();
  });

  it('exporta SCHEMA_VERSION = 7', () => {
    expect(SCHEMA_VERSION).toBe(7);
  });
});
