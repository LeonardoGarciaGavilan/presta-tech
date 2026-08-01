import { eq, like, or, sql, inArray } from 'drizzle-orm';
import { db } from './index';
import { clientes, rutaClientes, rutas } from './schema';
import type { Cliente } from '@/types/cliente.types';

function rowToCliente(row: typeof clientes.$inferSelect): Cliente {
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    cedula: row.cedula,
    telefono: row.telefono,
    celular: row.celular,
    email: row.email,
    provincia: row.provincia,
    municipio: row.municipio,
    sector: row.sector,
    direccion: row.direccion,
    ocupacion: row.ocupacion,
    empresaLaboral: row.empresaLaboral,
    ingresos: row.ingresos,
    observaciones: row.observaciones,
    activo: row.activo,
    empresaId: row.empresaId,
    latitud: row.latitud,
    longitud: row.longitud,
    coordsAproximadas: row.coordsAproximadas ?? false,
    cedulaFrontalPath: row.cedulaFrontalPath,
    cedulaTraseraPath: row.cedulaTraseraPath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function clienteToRow(c: Cliente) {
  return {
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    cedula: c.cedula,
    telefono: c.telefono,
    celular: c.celular,
    email: c.email,
    provincia: c.provincia,
    municipio: c.municipio,
    sector: c.sector,
    direccion: c.direccion,
    ocupacion: c.ocupacion,
    empresaLaboral: c.empresaLaboral,
    ingresos: c.ingresos,
    observaciones: c.observaciones,
    activo: c.activo,
    empresaId: c.empresaId,
    latitud: c.latitud,
    longitud: c.longitud,
    coordsAproximadas: c.coordsAproximadas ?? false,
    cedulaFrontalPath: c.cedulaFrontalPath,
    cedulaTraseraPath: c.cedulaTraseraPath,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function upsertClientes(list: Cliente[]): void {
  if (list.length === 0) return;
  for (const c of list) {
    db.insert(clientes)
      .values(clienteToRow(c))
      .onConflictDoUpdate({
        target: clientes.id,
        set: clienteToRow(c),
      })
      .run();
  }
}

export function getClienteById(id: string): Cliente | null {
  const row = db.select().from(clientes).where(eq(clientes.id, id)).get();
  if (!row) return null;

  const cliente = rowToCliente(row);
  const rcs = db
    .select({
      rutaId: rutaClientes.rutaId,
      rutaNombre: rutas.nombre,
    })
    .from(rutaClientes)
    .innerJoin(rutas, eq(rutas.id, rutaClientes.rutaId))
    .where(eq(rutaClientes.clienteId, id))
    .all();

  if (rcs.length > 0) {
    cliente.rutaClientes = rcs.map((rc) => ({
      rutaId: rc.rutaId,
      ruta: { nombre: rc.rutaNombre },
    }));
  }
  return cliente;
}

export function searchClientes(term: string, excludeId?: string): Cliente[] {
  if (!term || term.length < 1) return [];

  const normalized = term.toLowerCase().trim();
  const pattern = `%${normalized}%`;

  const rows = db
    .select()
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
    .limit(20)
    .all();

  let results = rows.map(rowToCliente);

  if (excludeId) {
    results = results.filter((c: Cliente) => c.id !== excludeId);
  }

  return results;
}

export function getAllCachedClientes(): Cliente[] {
  const rows = db.select().from(clientes).all();
  return rows.map(rowToCliente);
}

export function getClientesByIds(ids: string[]): Cliente[] {
  if (ids.length === 0) return [];
  const rows = db
    .select()
    .from(clientes)
    .where(inArray(clientes.id, ids))
    .all();
  return rows.map(rowToCliente);
}

export function deleteCliente(id: string): void {
  db.delete(clientes).where(eq(clientes.id, id)).run();
}

export function clearClientes(): void {
  db.delete(clientes).run();
}
