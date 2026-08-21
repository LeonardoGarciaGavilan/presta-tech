import { eq, like, or, sql, inArray } from 'drizzle-orm';
import { db } from './index';
import { prestamos, cuotas, clientes } from './schema';
import { upsertPagos } from './pagos-db';
import type { Prestamo, Cuota } from '@/types/prestamo.types';

function rowToPrestamo(
  row: typeof prestamos.$inferSelect,
  clienteRow?: typeof clientes.$inferSelect,
): Prestamo {
  // Si el llamador ya precargó el cliente (p. ej. un mapa en memoria), lo
  // reutiliza para evitar la consulta N+1 por fila.
  const cliente = clienteRow ?? db
    .select()
    .from(clientes)
    .where(eq(clientes.id, row.clienteId))
    .get();

  return {
    id: row.id,
    monto: row.monto,
    tasaInteres: row.tasaInteres,
    numeroCuotas: row.numeroCuotas,
    montoTotal: row.montoTotal,
    saldoPendiente: row.saldoPendiente,
    cuotaMensual: row.cuotaMensual,
    frecuenciaPago: row.frecuenciaPago as Prestamo['frecuenciaPago'],
    fechaInicio: row.fechaInicio,
    fechaVencimiento: row.fechaVencimiento,
    moraAcumulada: row.moraAcumulada ?? 0,
    estado: row.estado as Prestamo['estado'],
    refinanciado: row.refinanciado ?? false,
    vecesRefinanciado: row.vecesRefinanciado ?? 0,
    motivoRechazo: row.motivoRechazo,
    solicitadoPor: row.solicitadoPor,
    aprobadoPor: row.aprobadoPor,
    fechaAprobacion: row.fechaAprobacion,
    fechaDesembolso: row.fechaDesembolso,
    modoRapido: row.modoRapido ?? false,
    clienteId: row.clienteId,
    garanteId: row.garanteId,
    empresaId: row.empresaId,
    createdAt: row.createdAt,
    historialRefinanciamiento: row.historialRefinanciamiento ? JSON.parse(row.historialRefinanciamiento) : null,
    cliente: cliente
      ? { id: cliente.id, nombre: cliente.nombre, apellido: cliente.apellido, cedula: cliente.cedula, telefono: cliente.telefono, celular: cliente.celular }
      : { id: row.clienteId, nombre: '', cedula: '', apellido: null, telefono: null, celular: null },
    cuotas: [],
    pagos: [],
  };
}

function rowToCuota(row: typeof cuotas.$inferSelect): Cuota {
  return {
    id: row.id,
    numero: row.numero,
    monto: row.monto,
    capital: row.capital,
    interes: row.interes,
    mora: row.mora ?? 0,
    fechaVencimiento: row.fechaVencimiento,
    pagada: row.pagada ?? false,
    fechaPago: row.fechaPago,
    prestamoId: row.prestamoId,
    createdAt: row.createdAt,
  };
}

function prestamoToRow(p: Prestamo) {
  return {
    id: p.id,
    monto: p.monto,
    tasaInteres: p.tasaInteres,
    numeroCuotas: p.numeroCuotas,
    montoTotal: p.montoTotal,
    saldoPendiente: p.saldoPendiente,
    cuotaMensual: p.cuotaMensual,
    frecuenciaPago: p.frecuenciaPago,
    fechaInicio: p.fechaInicio,
    fechaVencimiento: p.fechaVencimiento,
    moraAcumulada: p.moraAcumulada ?? 0,
    estado: p.estado,
    refinanciado: p.refinanciado ?? false,
    vecesRefinanciado: p.vecesRefinanciado ?? 0,
    motivoRechazo: p.motivoRechazo,
    solicitadoPor: p.solicitadoPor,
    aprobadoPor: p.aprobadoPor,
    fechaAprobacion: p.fechaAprobacion,
    fechaDesembolso: p.fechaDesembolso,
    modoRapido: p.modoRapido ?? false,
    clienteId: p.clienteId,
    garanteId: p.garanteId,
    empresaId: p.empresaId,
    historialRefinanciamiento: p.historialRefinanciamiento ? JSON.stringify(p.historialRefinanciamiento) : null,
    createdAt: p.createdAt,
  };
}

function cuotaToRow(c: Cuota) {
  return {
    id: c.id,
    numero: c.numero,
    monto: c.monto,
    capital: c.capital,
    interes: c.interes,
    mora: c.mora ?? 0,
    fechaVencimiento: c.fechaVencimiento,
    pagada: c.pagada ?? false,
    fechaPago: c.fechaPago,
    prestamoId: c.prestamoId,
    createdAt: c.createdAt,
  };
}

export function upsertPrestamos(list: Prestamo[]): void {
  if (list.length === 0) return;
  for (const p of list) {
    db.insert(prestamos)
      .values(prestamoToRow(p))
      .onConflictDoUpdate({
        target: prestamos.id,
        set: prestamoToRow(p),
      })
      .run();

    if (p.cuotas && p.cuotas.length > 0) {
      for (const cuota of p.cuotas) {
        const fullCuota: Cuota = {
          ...cuota,
          id: cuota.id ?? `${p.id}_cuota_${cuota.numero}`,
          prestamoId: p.id,
          // 2.4: createdAt es la fecha real de creación (como el servidor,
          // que usa now() al crear la cuota), no la fecha de vencimiento.
          createdAt: cuota.createdAt ?? new Date().toISOString(),
        } as Cuota;
        db.insert(cuotas)
          .values(cuotaToRow(fullCuota))
          .onConflictDoUpdate({
            target: cuotas.id,
            set: cuotaToRow(fullCuota),
          })
          .run();
      }
    }

    // 2.2: los pagos del servidor que vienen anidados en el préstamo se
    // hidratan en la tabla local `pagos` (antes se descartaban y el historial
    // offline perdía los pagos creados en otros dispositivos).
    if (p.pagos && p.pagos.length > 0) {
      for (const pago of p.pagos) {
        upsertPagos([
          {
            id: pago.id,
            montoTotal: pago.montoTotal,
            capital: pago.capital,
            interes: pago.interes,
            mora: pago.mora ?? 0,
            metodo: pago.metodo,
            referencia: pago.referencia ?? null,
            observacion: pago.observacion ?? null,
            createdAt: pago.createdAt,
            usuarioId: (pago as { usuarioId?: string }).usuarioId ?? pago.usuario?.id ?? '',
            prestamoId: p.id,
            cajaId: (pago as { cajaId?: string | null }).cajaId ?? null,
          },
        ]);
      }
    }
  }
}

export function getPrestamoById(id: string): Prestamo | null {
  const row = db.select().from(prestamos).where(eq(prestamos.id, id)).get();
  if (!row) return null;

  const prestamo = rowToPrestamo(row);
  prestamo.cuotas = getCuotasByPrestamoId(id);
  return prestamo;
}

export function searchPrestamos(term: string): Prestamo[] {
  if (!term || term.length < 1) return [];

  const normalized = term.toLowerCase().trim();
  const pattern = `%${normalized}%`;

  const matchingClienteIds = db
    .select({ id: clientes.id })
    .from(clientes)
    .where(
      or(
        like(sql`lower(${clientes.nombre})`, pattern),
        like(sql`lower(${clientes.apellido})`, pattern),
        like(sql`lower(${clientes.cedula})`, pattern),
        like(
          sql`lower(${clientes.nombre} || ' ' || coalesce(${clientes.apellido}, ''))`,
          pattern,
        ),
      ),
    )
    .all()
    .map((r) => r.id);

  if (matchingClienteIds.length === 0) return [];

  // Precargamos los clientes coincidentes una sola vez (mapa en memoria) para
  // evitar el N+1 en rowToPrestamo.
  const clientesMap = new Map(
    db
      .select()
      .from(clientes)
      .where(inArray(clientes.id, matchingClienteIds))
      .all()
      .map((c) => [c.id, c]),
  );

  const rows = db
    .select()
    .from(prestamos)
    .where(inArray(prestamos.clienteId, matchingClienteIds))
    .limit(20)
    .all();

  return rows.map((row) => {
    const p = rowToPrestamo(row, clientesMap.get(row.clienteId));
    p.cuotas = getCuotasByPrestamoId(p.id);
    return p;
  });
}

export function getPrestamosByClienteId(clienteId: string): Prestamo[] {
  const rows = db
    .select()
    .from(prestamos)
    .where(eq(prestamos.clienteId, clienteId))
    .all();
  // Todos los préstamos comparten el mismo cliente: una sola consulta.
  const clienteRow = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .get();
  return rows.map((row) => rowToPrestamo(row, clienteRow ?? undefined));
}

export function upsertCuotas(list: Cuota[]): void {
  if (list.length === 0) return;
  for (const c of list) {
    db.insert(cuotas)
      .values(cuotaToRow(c))
      .onConflictDoUpdate({
        target: cuotas.id,
        set: cuotaToRow(c),
      })
      .run();
  }
}

export function getCuotasByPrestamoId(prestamoId: string): Cuota[] {
  const rows = db
    .select()
    .from(cuotas)
    .where(eq(cuotas.prestamoId, prestamoId))
    .all();
  return rows.map(rowToCuota);
}

export function getAllCachedPrestamos(): Prestamo[] {
  const rows = db.select().from(prestamos).all();
  // Cargamos todos los clientes una sola vez y mapeamos por id: elimina el
  // N+1 que disparaba `rowToPrestamo` (1 query de cliente por préstamo).
  const clientesMap = new Map(
    db
      .select()
      .from(clientes)
      .all()
      .map((c) => [c.id, c]),
  );
  return rows.map((row) => {
    const p = rowToPrestamo(row, clientesMap.get(row.clienteId));
    p.cuotas = getCuotasByPrestamoId(p.id);
    return p;
  });
}

export function deletePrestamo(id: string): void {
  db.delete(cuotas).where(eq(cuotas.prestamoId, id)).run();
  db.delete(prestamos).where(eq(prestamos.id, id)).run();
}

export function clearPrestamos(): void {
  db.delete(prestamos).run();
  db.delete(cuotas).run();
}

export interface DistribucionPagoLocal {
  capital: number;
  interes: number;
  mora: number;
  abonoCapital: number;
  pagoCompleto: boolean;
}

// Aplica localmente (offline) un pago a las cuotas del préstamo replicando la
// lógica del backend: mora → interés → capital, excedente a cuotas siguientes,
// y recálculo de saldo / mora / estado. Devuelve la distribución calculada.
export function aplicarPagoLocal(
  prestamoId: string,
  cuotaId: string | undefined,
  montoPagadoRaw: number,
  fecha = new Date().toISOString(),
): DistribucionPagoLocal {
  const resultadoVacio: DistribucionPagoLocal = {
    capital: 0,
    interes: 0,
    mora: 0,
    abonoCapital: 0,
    pagoCompleto: false,
  };

  // Lectura única de cuotas en memoria; se reutiliza en todo el cálculo para
  // evitar re-consultas (antes se leían hasta 3 veces por pago).
  const todas = getCuotasByPrestamoId(prestamoId);

  const cuotasPendientes = todas
    .filter((c) => !c.pagada)
    .sort((a, b) => a.numero - b.numero);
  if (cuotasPendientes.length === 0) return resultadoVacio;

  let cuotaObjetivo = cuotasPendientes[0];
  if (cuotaId) {
    const especifica = cuotasPendientes.find((c) => c.id === cuotaId);
    if (especifica) cuotaObjetivo = especifica;
  }

  const montoExacto = Math.round((cuotaObjetivo.monto + cuotaObjetivo.mora) * 100) / 100;

  let montoPagado = Math.round(montoPagadoRaw * 100) / 100;
  let moraAplicada = 0;
  let interesAplicado = 0;
  let capitalAplicado = 0;

  if (cuotaObjetivo.mora > 0) {
    moraAplicada = Math.min(montoPagado, cuotaObjetivo.mora);
    montoPagado = Math.round((montoPagado - moraAplicada) * 100) / 100;
  }
  if (montoPagado > 0) {
    interesAplicado = Math.min(montoPagado, cuotaObjetivo.interes);
    montoPagado = Math.round((montoPagado - interesAplicado) * 100) / 100;
  }
  if (montoPagado > 0) {
    capitalAplicado = Math.min(montoPagado, cuotaObjetivo.capital);
    montoPagado = Math.round((montoPagado - capitalAplicado) * 100) / 100;
  }
  const excedente = Math.round(montoPagado * 100) / 100;
  const pagoCompleto = Math.round(montoPagadoRaw * 100) / 100 >= montoExacto;

  const map = new Map(todas.map((c) => [c.id, { ...c }]));

  const cuotaObj = map.get(cuotaObjetivo.id)!;
  if (pagoCompleto) {
    cuotaObj.pagada = true;
    cuotaObj.fechaPago = fecha;
  } else {
    const nuevaMora = Math.max(0, Math.round((cuotaObj.mora - moraAplicada) * 100) / 100);
    const nuevoInteres = Math.max(0, Math.round((cuotaObj.interes - interesAplicado) * 100) / 100);
    const nuevoCapital = Math.max(0, Math.round((cuotaObj.capital - capitalAplicado) * 100) / 100);
    cuotaObj.mora = nuevaMora;
    cuotaObj.interes = nuevoInteres;
    cuotaObj.capital = nuevoCapital;
    cuotaObj.monto = Math.round((nuevoCapital + nuevoInteres + nuevaMora) * 100) / 100;
  }
  map.set(cuotaObjetivo.id, cuotaObj);

  if (excedente > 0) {
    const cuotasRestantes = cuotasPendientes.filter((c) => c.id !== cuotaObjetivo.id);
    let abonoRestante = excedente;
    for (const cuota of cuotasRestantes) {
      if (abonoRestante <= 0) break;
      const c = map.get(cuota.id)!;

      let restante = abonoRestante;
      let pagoMora = 0;
      let pagoInteres = 0;
      let pagoCapital = 0;

      if (c.mora > 0) {
        pagoMora = Math.min(restante, c.mora);
        restante = Math.round((restante - pagoMora) * 100) / 100;
      }
      if (restante > 0) {
        pagoInteres = Math.min(restante, c.interes);
        restante = Math.round((restante - pagoInteres) * 100) / 100;
      }
      if (restante > 0) {
        pagoCapital = Math.min(restante, c.capital);
        restante = Math.round((restante - pagoCapital) * 100) / 100;
      }

      const nuevaMora = Math.max(0, Math.round((c.mora - pagoMora) * 100) / 100);
      const nuevoInteres = Math.max(0, Math.round((c.interes - pagoInteres) * 100) / 100);
      const nuevoCapital = Math.max(0, Math.round((c.capital - pagoCapital) * 100) / 100);
      const nuevoMonto = Math.round((nuevoCapital + nuevoInteres + nuevaMora) * 100) / 100;

      if (nuevoMonto <= 0) {
        c.capital = 0;
        c.interes = 0;
        c.mora = 0;
        c.monto = 0;
        c.pagada = true;
        c.fechaPago = fecha;
      } else {
        c.capital = nuevoCapital;
        c.interes = nuevoInteres;
        c.mora = nuevaMora;
        c.monto = nuevoMonto;
      }
      map.set(cuota.id, c);
      abonoRestante =
        Math.round((abonoRestante - pagoMora - pagoInteres - pagoCapital) * 100) / 100;
    }
  }

  const actualizadas = [...map.values()].filter((c) => !c.pagada);
  const nuevoSaldo = Math.max(
    0,
    Math.round(actualizadas.reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0) * 100) / 100,
  );
  const nuevaMoraAcumulada = Math.max(
    0,
    Math.round(actualizadas.reduce((s, c) => s + (c.mora || 0), 0) * 100) / 100,
  );

  // Cargamos solo la fila del préstamo (y su cliente) sin las cuotas: evita la
  // lectura extra de cuotas que hacía getPrestamoById (ya las tenemos en `todas`).
  const prestamoRow = db
    .select()
    .from(prestamos)
    .where(eq(prestamos.id, prestamoId))
    .get();
  if (!prestamoRow) return { ...resultadoVacio, pagoCompleto };
  const prestamo = rowToPrestamo(prestamoRow);

  let nuevoEstado: Prestamo['estado'] = prestamo.estado;
  if (actualizadas.length === 0 || nuevoSaldo <= 0) {
    nuevoEstado = 'PAGADO';
  } else {
    const hoy = new Date();
    const hayVencidas = actualizadas.some((c) => new Date(c.fechaVencimiento) < hoy);
    nuevoEstado = hayVencidas ? 'ATRASADO' : 'ACTIVO';
  }

  upsertPrestamos([
    {
      ...prestamo,
      saldoPendiente: nuevoSaldo,
      moraAcumulada: nuevaMoraAcumulada,
      estado: nuevoEstado,
      cuotas: [...map.values()],
    },
  ]);

  return {
    capital: Math.max(0, capitalAplicado),
    interes: Math.max(0, interesAplicado),
    mora: Math.max(0, moraAplicada),
    abonoCapital: Math.max(0, excedente),
    pagoCompleto,
  };
}

// Salda el préstamo completo localmente (offline): marca todas las cuotas
// pendientes como pagadas y pone saldo 0 / estado PAGADO.
export function saldarPrestamoLocal(prestamoId: string): void {
  const prestamo = getPrestamoById(prestamoId);
  if (!prestamo) return;
  const cuotas = getCuotasByPrestamoId(prestamoId).map((c) => ({
    ...c,
    pagada: true,
    fechaPago: new Date().toISOString(),
  }));
  upsertPrestamos([
    {
      ...prestamo,
      saldoPendiente: 0,
      moraAcumulada: 0,
      estado: 'PAGADO',
      cuotas,
    },
  ]);
}
