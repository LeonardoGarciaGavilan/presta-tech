import { and, eq, inArray } from 'drizzle-orm';
import { db } from './index';
import { rutas, rutaClientes, syncMeta } from './schema';
import type { Ruta, RutaCliente, VistaDiaResponse } from '@/types/rutas.types';

function rowToRuta(row: typeof rutas.$inferSelect): Ruta {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    activa: row.activa ?? true,
    empresaId: row.empresaId,
    usuarioId: row.usuarioId,
    createdAt: row.createdAt ?? undefined,
  };
}

function rowToRutaCliente(row: typeof rutaClientes.$inferSelect): RutaCliente {
  return {
    id: row.id,
    orden: row.orden,
    observacion: row.observacion,
    visitadoHoy: row.visitadoHoy ?? false,
    ultimaVisita: row.ultimaVisita,
    fechaRuta: row.fechaRuta ?? null,
    rutaId: row.rutaId,
    clienteId: row.clienteId,
    eliminado: row.eliminado ?? false,
  };
}

function rutaToRow(r: Ruta) {
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion ?? null,
    activa: r.activa ?? true,
    empresaId: r.empresaId,
    usuarioId: r.usuarioId,
    createdAt: r.createdAt ?? null,
  };
}

function rutaClienteToRow(rc: RutaCliente) {
  return {
    id: rc.id,
    orden: rc.orden,
    observacion: rc.observacion ?? null,
    visitadoHoy: rc.visitadoHoy ?? false,
    ultimaVisita: rc.ultimaVisita ?? null,
    fechaRuta: rc.fechaRuta ?? null,
    rutaId: rc.rutaId,
    clienteId: rc.clienteId,
    eliminado: rc.eliminado ?? false,
  };
}

export function upsertRutas(list: Ruta[]): void {
  if (list.length === 0) return;
  for (const r of list) {
    db.insert(rutas)
      .values(rutaToRow(r))
      .onConflictDoUpdate({ target: rutas.id, set: rutaToRow(r) })
      .run();
  }
}

export function getRutas(): Ruta[] {
  return db.select().from(rutas).all().map(rowToRuta);
}

export function getRutaById(id: string): Ruta | null {
  const row = db.select().from(rutas).where(eq(rutas.id, id)).get();
  return row ? rowToRuta(row) : null;
}

export function upsertRutaClientes(list: RutaCliente[]): void {
  if (list.length === 0) return;
  for (const rc of list) {
    db.insert(rutaClientes)
      .values(rutaClienteToRow(rc))
      .onConflictDoUpdate({ target: rutaClientes.id, set: rutaClienteToRow(rc) })
      .run();
  }
}

export function getRutaClientes(rutaId: string): RutaCliente[] {
  return db
    .select()
    .from(rutaClientes)
    .where(and(eq(rutaClientes.rutaId, rutaId), eq(rutaClientes.eliminado, false)))
    .all()
    .map(rowToRutaCliente);
}

export function updateVisitado(rcId: string, visitado: boolean): void {
  db.update(rutaClientes)
    .set({ visitadoHoy: visitado })
    .where(eq(rutaClientes.id, rcId))
    .run();
}

export function upsertVistaDiaCache(rutaId: string, fecha: string, data: VistaDiaResponse): void {
  const key = `vistadia:${rutaId}:${fecha}`;
  db.insert(syncMeta)
    .values({ key, value: JSON.stringify(data) })
    .onConflictDoUpdate({
      target: syncMeta.key,
      set: { value: JSON.stringify(data) },
    })
    .run();
}

export function getVistaDiaCache(rutaId: string, fecha: string): VistaDiaResponse | null {
  const key = `vistadia:${rutaId}:${fecha}`;
  const row = db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as VistaDiaResponse;
  } catch {
    return null;
  }
}

export function getRutaClienteByClienteId(clienteId: string): RutaCliente | null {
  const row = db
    .select()
    .from(rutaClientes)
    .where(and(eq(rutaClientes.clienteId, clienteId), eq(rutaClientes.eliminado, false)))
    .get();
  return row ? rowToRutaCliente(row) : null;
}

export function getRutaClienteById(rcId: string): RutaCliente | null {
  const row = db
    .select()
    .from(rutaClientes)
    .where(and(eq(rutaClientes.id, rcId), eq(rutaClientes.eliminado, false)))
    .get();
  return row ? rowToRutaCliente(row) : null;
}

export function clearRutas(): void {
  db.delete(rutas).run();
  db.delete(rutaClientes).run();
}

// C8: retira rutas (y sus rutaClientes) de la cache local. Se usa con las
// `rutasAjenas` del delta: rutas de otros usuarios que fueron desactivadas o
// reasignadas y que el no-admin ya no debe ver. Idempotente: si la ruta no
// existe localmente es un no-op.
export function deleteRutas(ids: string[]): void {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const CHUNK = 400;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    db.delete(rutaClientes)
      .where(inArray(rutaClientes.rutaId, chunk))
      .run();
    db.delete(rutas)
      .where(inArray(rutas.id, chunk))
      .run();
  }
}

// C4-B1: borra las rutaClientes locales que NO estén en el snapshot servidor.
// Se usa solo en el full reload, donde la lista es autoritativa. Los borrados
// hard de rutaCliente no dejan rastro en el delta (la fila desaparece), así que
// sin esta reconciliación quedarían huérfanas en SQLite para siempre.
export function deleteRutaClientesExcept(keepIds: string[]): void {
  const keep = new Set(keepIds);
  const localIds = db
    .select({ id: rutaClientes.id })
    .from(rutaClientes)
    .all();
  const toDelete = localIds.filter((r) => !keep.has(r.id)).map((r) => r.id);
  if (toDelete.length === 0) return;
  // SQLite limita ~999 variables por query; se trocea para full reloads grandes.
  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const ids = toDelete.slice(i, i + CHUNK);
    db.delete(rutaClientes)
      .where(inArray(rutaClientes.id, ids))
      .run();
  }
}
