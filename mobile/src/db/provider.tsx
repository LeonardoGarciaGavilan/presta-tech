import { type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_NAME } from './index';

const SCHEMA_VERSION = 1;

async function onInit(database: SQLiteDatabase) {
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
        fecha_ruta TEXT
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
        idempotency_key TEXT
      );
    `);

    await txn.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

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

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={onInit}
      useSuspense={true}
    >
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </SQLiteProvider>
  );
}
