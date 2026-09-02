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
    prestamos: string[];
  };
  calls: string[];
}

function createFakeDb(options: { userVersion?: number } = {}): FakeDb {
  const { userVersion = 0 } = options;
  const calls: string[] = [];
  const columns: FakeDb['columns'] = {
    prestamos: [
      'id',
      'monto',
      'tasa_interes',
      'numero_cuotas',
      'monto_total',
      'saldo_pendiente',
      'cuota_mensual',
      'frecuencia_pago',
      'fecha_inicio',
      'fecha_vencimiento',
      'mora_acumulada',
      'estado',
      'refinanciado',
      'veces_refinanciado',
      'motivo_rechazo',
      'solicitado_por',
      'aprobado_por',
      'fecha_aprobacion',
      'fecha_desembolso',
      'modo_rapido',
      'cliente_id',
      'garante_id',
      'empresa_id',
      'historial_refinanciamiento',
      'created_at',
    ],
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
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN permitir_refinanciamiento',
      )
    ) {
      columns.configuracion.push('permitir_refinanciamiento');
    } else if (sql.includes('ALTER TABLE prestamos ADD COLUMN origen')) {
      columns.prestamos.push('origen');
    } else if (
      sql.includes('ALTER TABLE prestamos ADD COLUMN renovacion_de_id')
    ) {
      columns.prestamos.push('renovacion_de_id');
    } else if (
      sql.includes(
        'ALTER TABLE prestamos ADD COLUMN cadena_renovaciones',
      )
    ) {
      columns.prestamos.push('cadena_renovaciones');
    } else if (
      sql.includes(
        'ALTER TABLE prestamos ADD COLUMN historial_renovacion',
      )
    ) {
      columns.prestamos.push('historial_renovacion');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN permitir_renovacion',
      )
    ) {
      columns.configuracion.push('permitir_renovacion');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN max_cuotas_restantes_para_renovacion',
      )
    ) {
      columns.configuracion.push('max_cuotas_restantes_para_renovacion');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN incluir_interes_en_renovacion',
      )
    ) {
      columns.configuracion.push('incluir_interes_en_renovacion');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN porcentaje_maximo_saldo_aplicado',
      )
    ) {
      columns.configuracion.push('porcentaje_maximo_saldo_aplicado');
    } else if (
      sql.includes(
        'ALTER TABLE configuracion ADD COLUMN max_renovaciones_consecutivas',
      )
    ) {
      columns.configuracion.push('max_renovaciones_consecutivas');
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
    if (sql.includes('PRAGMA table_info(prestamos)')) {
      return columns.prestamos.map((name) => ({ name }));
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
    // v8: columnas de renovación en prestamos y reglas en configuracion
    expect(db.columns.prestamos).toContain('origen');
    expect(db.columns.prestamos).toContain('renovacion_de_id');
    expect(db.columns.prestamos).toContain('cadena_renovaciones');
    expect(db.columns.prestamos).toContain('historial_renovacion');
    expect(db.columns.configuracion).toContain('permitir_renovacion');
    expect(db.columns.configuracion).toContain('max_cuotas_restantes_para_renovacion');
    expect(db.columns.configuracion).toContain('incluir_interes_en_renovacion');
    expect(db.columns.configuracion).toContain('porcentaje_maximo_saldo_aplicado');
    expect(db.columns.configuracion).toContain('max_renovaciones_consecutivas');
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

  it('v7 → v8: agrega columnas de renovación en prestamos y reglas en configuracion', async () => {
    const db = createFakeDb({ userVersion: 7 });
    await initializeDatabase(db as any);

    const sqls = db.calls.join('\n');
    expect(sqls).toContain("ALTER TABLE prestamos ADD COLUMN origen TEXT DEFAULT 'NORMAL';");
    expect(sqls).toContain('ALTER TABLE prestamos ADD COLUMN renovacion_de_id TEXT;');
    expect(sqls).toContain(
      'ALTER TABLE prestamos ADD COLUMN cadena_renovaciones INTEGER DEFAULT 0;',
    );
    expect(sqls).toContain(
      'ALTER TABLE prestamos ADD COLUMN historial_renovacion TEXT;',
    );
    expect(sqls).toContain(
      'ALTER TABLE configuracion ADD COLUMN permitir_renovacion INTEGER DEFAULT 0;',
    );
    expect(sqls).toContain(
      'ALTER TABLE configuracion ADD COLUMN max_cuotas_restantes_para_renovacion INTEGER DEFAULT 0;',
    );
    expect(sqls).toContain(
      'ALTER TABLE configuracion ADD COLUMN incluir_interes_en_renovacion INTEGER DEFAULT 1;',
    );
    expect(sqls).toContain(
      'ALTER TABLE configuracion ADD COLUMN porcentaje_maximo_saldo_aplicado INTEGER DEFAULT 100;',
    );
    expect(sqls).toContain(
      'ALTER TABLE configuracion ADD COLUMN max_renovaciones_consecutivas INTEGER DEFAULT 0;',
    );
  });

  it('v8 → v9: agrega el switch maestro de refinanciamiento en configuracion', async () => {
    const db = createFakeDb({ userVersion: 8 });
    await initializeDatabase(db as any);

    const sqls = db.calls.join('\n');
    expect(sqls).toContain(
      'ALTER TABLE configuracion ADD COLUMN permitir_refinanciamiento INTEGER DEFAULT 1;',
    );
    // La columna nueva entra por table_info, no por el CREATE TABLE.
    expect(db.columns.configuracion).toContain('permitir_refinanciamiento');
  });

  it('v9 → v10 (B2): reconstruye las tablas money a céntimos enteros con CAST(ROUND(x*100))', async () => {
    const db = createFakeDb({ userVersion: 9 });
    await initializeDatabase(db as any);

    const sqls = db.calls.join('\n');
    // Cada tabla con dinero se reconstruye: rename → create → insert → drop.
    for (const tabla of ['clientes', 'prestamos', 'cuotas', 'pagos', 'configuracion']) {
      expect(sqls).toContain(`ALTER TABLE ${tabla} RENAME TO ${tabla}_v9;`);
      expect(sqls).toMatch(new RegExp(`DROP TABLE ${tabla}_v9;`));
    }
    // Conversión tolerante al ruido de coma flotante.
    expect(sqls).toContain(
      'CAST(ROUND(ingresos * 100) AS INTEGER)',
    );
    expect(sqls).toContain(
      'CAST(ROUND(monto_total * 100) AS INTEGER)',
    );
    expect(sqls).toContain(
      'CAST(ROUND(monto_minimo_prestamo * 100) AS INTEGER)',
    );
    // Tasas/porcentajes/coordenadas siguen REAL (no se tocan).
    expect(sqls).toContain('tasa_interes REAL NOT NULL');
    expect(sqls).toContain('tasa_interes_base REAL NOT NULL');
    // offline_queue no se reconstruye (data/snapshot siguen en pesos).
    expect(sqls).not.toContain('ALTER TABLE offline_queue RENAME');
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
    db.columns.offline_queue.push('retryable', 'snapshot');
    db.columns.prestamos.push(
      'origen',
      'renovacion_de_id',
      'cadena_renovaciones',
      'historial_renovacion',
    );
    db.columns.configuracion.push(
      'permitir_renovacion',
      'max_cuotas_restantes_para_renovacion',
      'incluir_interes_en_renovacion',
      'porcentaje_maximo_saldo_aplicado',
      'max_renovaciones_consecutivas',
      'permitir_refinanciamiento',
    );
    await initializeDatabase(db as any);

    // Las columnas ya existen: no se ejecuta ningún ADD COLUMN. El rebuild
    // v9→v10 sí usa ALTER TABLE ... RENAME (reconstrucción de tablas money).
    expect(db.calls.join('\n')).not.toContain('ADD COLUMN');
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

  it('exporta SCHEMA_VERSION = 10', () => {
    expect(SCHEMA_VERSION).toBe(10);
  });
});
