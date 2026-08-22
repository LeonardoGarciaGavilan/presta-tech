import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Clientes ─────────────────────────────────────────────────
export const clientes = sqliteTable('clientes', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  apellido: text('apellido'),
  cedula: text('cedula').notNull(),
  telefono: text('telefono'),
  celular: text('celular'),
  email: text('email'),
  provincia: text('provincia'),
  municipio: text('municipio'),
  sector: text('sector'),
  direccion: text('direccion'),
  ocupacion: text('ocupacion'),
  empresaLaboral: text('empresa_laboral'),
  ingresos: real('ingresos'),
  observaciones: text('observaciones'),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  empresaId: text('empresa_id').notNull(),
  latitud: real('latitud'),
  longitud: real('longitud'),
  coordsAproximadas: integer('coords_aproximadas', { mode: 'boolean' }).default(false),
  cedulaFrontalPath: text('cedula_frontal_path'),
  cedulaTraseraPath: text('cedula_trasera_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Préstamos ────────────────────────────────────────────────
export const prestamos = sqliteTable('prestamos', {
  id: text('id').primaryKey(),
  monto: real('monto').notNull(),
  tasaInteres: real('tasa_interes').notNull(),
  numeroCuotas: integer('numero_cuotas').notNull(),
  montoTotal: real('monto_total').notNull(),
  saldoPendiente: real('saldo_pendiente').notNull(),
  cuotaMensual: real('cuota_mensual').notNull(),
  frecuenciaPago: text('frecuencia_pago').notNull(),
  fechaInicio: text('fecha_inicio').notNull(),
  fechaVencimiento: text('fecha_vencimiento').notNull(),
  moraAcumulada: real('mora_acumulada').default(0),
  estado: text('estado').notNull(),
  refinanciado: integer('refinanciado', { mode: 'boolean' }).default(false),
  vecesRefinanciado: integer('veces_refinanciado').default(0),
  motivoRechazo: text('motivo_rechazo'),
  solicitadoPor: text('solicitado_por'),
  aprobadoPor: text('aprobado_por'),
  fechaAprobacion: text('fecha_aprobacion'),
  fechaDesembolso: text('fecha_desembolso'),
  modoRapido: integer('modo_rapido', { mode: 'boolean' }).default(false),
  clienteId: text('cliente_id').notNull(),
  garanteId: text('garante_id'),
  empresaId: text('empresa_id').notNull(),
  historialRefinanciamiento: text('historial_refinanciamiento'),
  // Renovación de préstamos (v8)
  origen: text('origen').default('NORMAL'),
  renovacionDeId: text('renovacion_de_id'),
  cadenaRenovaciones: integer('cadena_renovaciones').default(0),
  historialRenovacion: text('historial_renovacion'),
  createdAt: text('created_at').notNull(),
});

// ─── Cuotas ───────────────────────────────────────────────────
export const cuotas = sqliteTable('cuotas', {
  id: text('id').primaryKey(),
  numero: integer('numero').notNull(),
  monto: real('monto').notNull(),
  capital: real('capital').notNull(),
  interes: real('interes').notNull(),
  mora: real('mora').default(0),
  fechaVencimiento: text('fecha_vencimiento').notNull(),
  pagada: integer('pagada', { mode: 'boolean' }).default(false),
  fechaPago: text('fecha_pago'),
  prestamoId: text('prestamo_id').notNull(),
  createdAt: text('created_at').notNull(),
});

// ─── Pagos ────────────────────────────────────────────────────
export const pagos = sqliteTable('pagos', {
  id: text('id').primaryKey(),
  montoTotal: real('monto_total').notNull(),
  capital: real('capital').notNull(),
  interes: real('interes').notNull(),
  mora: real('mora').default(0),
  metodo: text('metodo').notNull(),
  referencia: text('referencia'),
  observacion: text('observacion'),
  prestamoId: text('prestamo_id').notNull(),
  usuarioId: text('usuario_id').notNull(),
  cajaId: text('caja_id'),
  createdAt: text('created_at').notNull(),
});

// ─── Rutas ────────────────────────────────────────────────────
export const rutas = sqliteTable('rutas', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  activa: integer('activa', { mode: 'boolean' }).default(true),
  empresaId: text('empresa_id').notNull(),
  usuarioId: text('usuario_id').notNull(),
  createdAt: text('created_at'),
});

// ─── Ruta Clientes ────────────────────────────────────────────
export const rutaClientes = sqliteTable('ruta_clientes', {
  id: text('id').primaryKey(),
  orden: integer('orden').notNull(),
  observacion: text('observacion'),
  visitadoHoy: integer('visitado_hoy', { mode: 'boolean' }).default(false),
  ultimaVisita: text('ultima_visita'),
  fechaRuta: text('fecha_ruta'),
  rutaId: text('ruta_id').notNull(),
  clienteId: text('cliente_id').notNull(),
  eliminado: integer('eliminado', { mode: 'boolean' }).default(false),
});

// ─── Configuración ────────────────────────────────────────────
export const configuracion = sqliteTable('configuracion', {
  id: text('id').primaryKey(),
  tasaInteresBase: real('tasa_interes_base').notNull(),
  moraPorcentajeMensual: real('mora_porcentaje_mensual').notNull(),
  diasGracia: integer('dias_gracia').notNull(),
  permitirAbonoCapital: integer('permitir_abono_capital', { mode: 'boolean' }).default(true),
  montoMinimoPrestamo: real('monto_minimo_prestamo').default(0),
  montoMaximoPrestamo: real('monto_maximo_prestamo'),
  montoMaximoPago: real('monto_maximo_pago'),
  cuotasRestantesParaRenovar: integer('cuotas_restantes_para_renovar').default(0),
  maxRefinanciamientosPorPrestamo: integer('max_refinanciamientos_por_prestamo').default(0),
  maxPrestamosActivosPorCliente: integer('max_prestamos_activos_por_cliente').default(0),
  // Reglas de renovación de préstamos (v8); 0 = sin restricción
  permitirRenovacion: integer('permitir_renovacion', { mode: 'boolean' }).default(false),
  maxCuotasRestantesParaRenovacion: integer('max_cuotas_restantes_para_renovacion').default(0),
  incluirInteresEnRenovacion: integer('incluir_interes_en_renovacion', { mode: 'boolean' }).default(true),
  porcentajeMaximoSaldoAplicado: integer('porcentaje_maximo_saldo_aplicado').default(100),
  maxRenovacionesConsecutivas: integer('max_renovaciones_consecutivas').default(0),
  empresaId: text('empresa_id').notNull(),
  existe: integer('existe', { mode: 'boolean' }).default(true),
});

// ─── Cola Offline ─────────────────────────────────────────────
export const offlineQueue = sqliteTable('offline_queue', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  data: text('data').notNull(), // JSON string
  queryKeys: text('query_keys').notNull(), // JSON string
  createdAt: integer('created_at').notNull(),
  retryCount: integer('retry_count').default(0),
  status: text('status').notNull().default('pending'),
  tempId: text('temp_id'),
  tempDisplay: text('temp_display'), // JSON string
  lastError: text('last_error'),
  idempotencyKey: text('idempotency_key'),
  retryable: integer('retryable', { mode: 'boolean' }).default(true),
  // C3: estado pre-mutación de las entidades afectadas por la operación encolada
  // (p. ej. el préstamo y sus cuotas antes de un pago offline). Se usa para
  // revertir la mutación local si la operación falla de forma permanente.
  snapshot: text('snapshot'), // JSON string
});

// ─── Sync Metadata ────────────────────────────────────────────
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ─── Caja activa (C2) ─────────────────────────────────────────
// Persiste la caja activa para que sobreviva al arranque en frío sin conexión.
// Una sola fila (id fijo 'activa'); se borra al cerrar.
export const cajaActiva = sqliteTable('caja_activa', {
  id: text('id').primaryKey(),
  data: text('data').notNull(), // JSON de la caja activa
  updatedAt: text('updated_at').notNull(),
});
