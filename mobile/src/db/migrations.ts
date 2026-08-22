import type { SQLiteDatabase } from 'expo-sqlite';

export const SCHEMA_VERSION = 8;

// Inicializa el esquema de la base y aplica las migraciones incrementales de
// forma tolerante: cada ALTER solo se intenta si la columna no existe y, si
// falla, se registra un warning y la app sigue operando (nunca se rompe el
// arranque por una migración).
export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`PRAGMA journal_mode = WAL;`);
  await database.execAsync(`PRAGMA foreign_keys = ON;`);

  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        apellido TEXT,
        cedula TEXT NOT NULL,
        telefono TEXT,
        celular TEXT,
        email TEXT,
        provincia TEXT,
        municipio TEXT,
        sector TEXT,
        direccion TEXT,
        ocupacion TEXT,
        empresa_laboral TEXT,
        ingresos REAL,
        observaciones TEXT,
        activo INTEGER NOT NULL DEFAULT 1,
        empresa_id TEXT NOT NULL,
        latitud REAL,
        longitud REAL,
        coords_aproximadas INTEGER DEFAULT 0,
        cedula_frontal_path TEXT,
        cedula_trasera_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS prestamos (
        id TEXT PRIMARY KEY NOT NULL,
        monto REAL NOT NULL,
        tasa_interes REAL NOT NULL,
        numero_cuotas INTEGER NOT NULL,
        monto_total REAL NOT NULL,
        saldo_pendiente REAL NOT NULL,
        cuota_mensual REAL NOT NULL,
        frecuencia_pago TEXT NOT NULL,
        fecha_inicio TEXT NOT NULL,
        fecha_vencimiento TEXT NOT NULL,
        mora_acumulada REAL DEFAULT 0,
        estado TEXT NOT NULL,
        refinanciado INTEGER DEFAULT 0,
        veces_refinanciado INTEGER DEFAULT 0,
        motivo_rechazo TEXT,
        solicitado_por TEXT,
        aprobado_por TEXT,
        fecha_aprobacion TEXT,
        fecha_desembolso TEXT,
        modo_rapido INTEGER DEFAULT 0,
        cliente_id TEXT NOT NULL,
        garante_id TEXT,
        empresa_id TEXT NOT NULL,
        historial_refinanciamiento TEXT,
        origen TEXT DEFAULT 'NORMAL',
        renovacion_de_id TEXT,
        cadena_renovaciones INTEGER DEFAULT 0,
        historial_renovacion TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS cuotas (
        id TEXT PRIMARY KEY NOT NULL,
        numero INTEGER NOT NULL,
        monto REAL NOT NULL,
        capital REAL NOT NULL,
        interes REAL NOT NULL,
        mora REAL DEFAULT 0,
        fecha_vencimiento TEXT NOT NULL,
        pagada INTEGER DEFAULT 0,
        fecha_pago TEXT,
        prestamo_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS pagos (
        id TEXT PRIMARY KEY NOT NULL,
        monto_total REAL NOT NULL,
        capital REAL NOT NULL,
        interes REAL NOT NULL,
        mora REAL DEFAULT 0,
        metodo TEXT NOT NULL,
        referencia TEXT,
        observacion TEXT,
        prestamo_id TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        caja_id TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS rutas (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        activa INTEGER DEFAULT 1,
        empresa_id TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        created_at TEXT
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS ruta_clientes (
        id TEXT PRIMARY KEY NOT NULL,
        orden INTEGER NOT NULL,
        observacion TEXT,
        visitado_hoy INTEGER DEFAULT 0,
        ultima_visita TEXT,
        ruta_id TEXT NOT NULL,
        cliente_id TEXT NOT NULL,
        fecha_ruta TEXT,
        eliminado INTEGER DEFAULT 0
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS configuracion (
        id TEXT PRIMARY KEY NOT NULL,
        tasa_interes_base REAL NOT NULL,
        mora_porcentaje_mensual REAL NOT NULL,
        dias_gracia INTEGER NOT NULL,
        permitir_abono_capital INTEGER DEFAULT 1,
        monto_minimo_prestamo REAL DEFAULT 0,
        monto_maximo_prestamo REAL,
        monto_maximo_pago REAL,
        cuotas_restantes_para_renovar INTEGER DEFAULT 0,
        max_refinanciamientos_por_prestamo INTEGER DEFAULT 0,
        max_prestamos_activos_por_cliente INTEGER DEFAULT 0,
        permitir_renovacion INTEGER DEFAULT 0,
        max_cuotas_restantes_para_renovacion INTEGER DEFAULT 0,
        incluir_interes_en_renovacion INTEGER DEFAULT 1,
        porcentaje_maximo_saldo_aplicado INTEGER DEFAULT 100,
        max_renovaciones_consecutivas INTEGER DEFAULT 0,
        empresa_id TEXT NOT NULL,
        existe INTEGER DEFAULT 1
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        data TEXT NOT NULL,
        query_keys TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        temp_id TEXT,
        temp_display TEXT,
        last_error TEXT,
        idempotency_key TEXT,
        retryable INTEGER DEFAULT 1
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS caja_activa (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Migración v1 → v2: columna `retryable` en offline_queue. Para instalaciones
    // existentes (v1) la tabla ya existe sin la columna. Se agrega con ALTER solo
    // si no está, y el fallo es NO-fatal: el código tolera su ausencia
    // (tratando el item como reintentable por defecto) para nunca romper el
    // arranque de la app.
    if (currentVersion < 2) {
      try {
        const columns = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(offline_queue)',
        );
        if (!columns.some((c) => c.name === 'retryable')) {
          await txn.execAsync(
            'ALTER TABLE offline_queue ADD COLUMN retryable INTEGER DEFAULT 1;',
          );
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudo migrar la columna retryable; se asumirá reintentable por defecto.',
          error,
        );
      }
    }

    // Migración v3 → v4 (C3): columna `snapshot` en offline_queue para poder
    // revertir la mutación local (saldo/cuotas) cuando una operación encolada
    // falla de forma permanente. Mismo patrón tolerante que la v2: si la
    // columna ya existe no se toca, y si el ALTER falla la app sigue operando
    // (simplemente sin capacidad de rollback para los nuevos items).
    if (currentVersion < 4) {
      try {
        const columns = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(offline_queue)',
        );
        if (!columns.some((c) => c.name === 'snapshot')) {
          await txn.execAsync(
            'ALTER TABLE offline_queue ADD COLUMN snapshot TEXT;',
          );
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudo migrar la columna snapshot; sin rollback para items nuevos.',
          error,
        );
      }
    }

    // Migración v4 → v5 (C8): columna `eliminado` en ruta_clientes para el
    // soft-delete de clientes en rutas. El servidor ya no borra la fila; marca
    // eliminado=true y el móvil la filtra al leer. Mismo patrón tolerante: si
    // la columna ya existe no se toca y si el ALTER falla la app sigue
    // operando (los rutaClientes simplemente no se ocultan al leer).
    if (currentVersion < 5) {
      try {
        const columns = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(ruta_clientes)',
        );
        if (!columns.some((c) => c.name === 'eliminado')) {
          await txn.execAsync(
            'ALTER TABLE ruta_clientes ADD COLUMN eliminado INTEGER DEFAULT 0;',
          );
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudo migrar la columna eliminado de ruta_clientes; los clientes retirados se seguirán viendo.',
          error,
        );
      }
    }

    // Migración v5 → v6: reglas parametrizables de refinanciamiento en
    // configuracion (0 = desactivada). Patrón tolerante: si las columnas ya
    // existen no se tocan; si el ALTER falla, el modal trata la ausencia como
    // regla desactivada.
    if (currentVersion < 6) {
      try {
        const columns = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(configuracion)',
        );
        if (columns.length > 0) {
          if (!columns.some((c) => c.name === 'cuotas_restantes_para_renovar')) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN cuotas_restantes_para_renovar INTEGER DEFAULT 0;',
            );
          }
          if (!columns.some((c) => c.name === 'max_refinanciamientos_por_prestamo')) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN max_refinanciamientos_por_prestamo INTEGER DEFAULT 0;',
            );
          }
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudieron migrar las columnas de reglas de refinanciamiento; se tratarán como desactivadas.',
          error,
        );
      }
    }

    // Migración v6 → v7: límite de préstamos activos (ACTIVO/ATRASADO) por
    // cliente en configuracion (0 = sin límite). Patrón tolerante: si la
    // columna ya existe no se toca; si el ALTER falla, la app trata la
    // ausencia como sin límite.
    if (currentVersion < 7) {
      try {
        const columns = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(configuracion)',
        );
        if (columns.length > 0) {
          if (!columns.some((c) => c.name === 'max_prestamos_activos_por_cliente')) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN max_prestamos_activos_por_cliente INTEGER DEFAULT 0;',
            );
          }
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudo migrar la columna max_prestamos_activos_por_cliente; se tratará como sin límite.',
          error,
        );
      }
    }

    // Migración v7 → v8: renovación de préstamos. Nuevas columnas en
    // prestamos (origen/vínculo/snapshot) y reglas parametrizables en
    // configuracion (0 = sin restricción). Patrón tolerante: si la columna ya
    // existe no se toca; si el ALTER falla, la app trata la ausencia como
    // valores por defecto (renovación desactivada, sin límites).
    if (currentVersion < 8) {
      try {
        const colsPrestamos = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(prestamos)',
        );
        if (colsPrestamos.length > 0) {
          if (!colsPrestamos.some((c) => c.name === 'origen')) {
            await txn.execAsync(
              "ALTER TABLE prestamos ADD COLUMN origen TEXT DEFAULT 'NORMAL';",
            );
          }
          if (!colsPrestamos.some((c) => c.name === 'renovacion_de_id')) {
            await txn.execAsync(
              'ALTER TABLE prestamos ADD COLUMN renovacion_de_id TEXT;',
            );
          }
          if (!colsPrestamos.some((c) => c.name === 'cadena_renovaciones')) {
            await txn.execAsync(
              'ALTER TABLE prestamos ADD COLUMN cadena_renovaciones INTEGER DEFAULT 0;',
            );
          }
          if (!colsPrestamos.some((c) => c.name === 'historial_renovacion')) {
            await txn.execAsync(
              'ALTER TABLE prestamos ADD COLUMN historial_renovacion TEXT;',
            );
          }
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudieron migrar las columnas de renovación en prestamos.',
          error,
        );
      }
      try {
        const colsConfig = await txn.getAllAsync<{ name: string }>(
          'PRAGMA table_info(configuracion)',
        );
        if (colsConfig.length > 0) {
          if (!colsConfig.some((c) => c.name === 'permitir_renovacion')) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN permitir_renovacion INTEGER DEFAULT 0;',
            );
          }
          if (
            !colsConfig.some(
              (c) => c.name === 'max_cuotas_restantes_para_renovacion',
            )
          ) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN max_cuotas_restantes_para_renovacion INTEGER DEFAULT 0;',
            );
          }
          if (
            !colsConfig.some((c) => c.name === 'incluir_interes_en_renovacion')
          ) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN incluir_interes_en_renovacion INTEGER DEFAULT 1;',
            );
          }
          if (
            !colsConfig.some(
              (c) => c.name === 'porcentaje_maximo_saldo_aplicado',
            )
          ) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN porcentaje_maximo_saldo_aplicado INTEGER DEFAULT 100;',
            );
          }
          if (
            !colsConfig.some((c) => c.name === 'max_renovaciones_consecutivas')
          ) {
            await txn.execAsync(
              'ALTER TABLE configuracion ADD COLUMN max_renovaciones_consecutivas INTEGER DEFAULT 0;',
            );
          }
        }
      } catch (error) {
        console.warn(
          '[DB] No se pudieron migrar las columnas de reglas de renovación; se tratarán como desactivadas.',
          error,
        );
      }
    }

    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_prestamos_cliente_id ON prestamos(cliente_id);`);
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_prestamos_empresa_id ON prestamos(empresa_id);`);
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_cuotas_prestamo_id ON cuotas(prestamo_id);`);
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_pagos_prestamo_id ON pagos(prestamo_id);`);
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_pagos_created_at ON pagos(created_at);`);
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_ruta_clientes_ruta_id ON ruta_clientes(ruta_id);`);
    await txn.execAsync(`CREATE INDEX IF NOT EXISTS idx_ruta_clientes_cliente_id ON ruta_clientes(cliente_id);`);

    await txn.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
}
