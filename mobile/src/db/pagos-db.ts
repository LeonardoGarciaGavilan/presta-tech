import { eq } from 'drizzle-orm';
import { db } from './index';
import { pagos } from './schema';
import { toCents, fromCents } from '@/utils/money';
import type { Pago } from '@/types/prestamo.types';

function rowToPago(row: typeof pagos.$inferSelect): Pago {
  return {
    id: row.id,
    montoTotal: fromCents(row.montoTotal),
    capital: fromCents(row.capital),
    interes: fromCents(row.interes),
    mora: fromCents(row.mora ?? 0),
    metodo: row.metodo as Pago['metodo'],
    referencia: row.referencia,
    observacion: row.observacion,
    prestamoId: row.prestamoId,
    usuarioId: row.usuarioId,
    cajaId: row.cajaId,
    createdAt: row.createdAt,
  };
}

function pagoToRow(p: Pago) {
  return {
    id: p.id,
    montoTotal: toCents(p.montoTotal),
    capital: toCents(p.capital),
    interes: toCents(p.interes),
    mora: toCents(p.mora ?? 0),
    metodo: p.metodo,
    referencia: p.referencia ?? null,
    observacion: p.observacion ?? null,
    prestamoId: p.prestamoId,
    usuarioId: p.usuarioId,
    cajaId: p.cajaId ?? null,
    createdAt: p.createdAt,
  };
}

export function insertPago(pago: Pago): void {
  db.insert(pagos)
    .values(pagoToRow(pago))
    .onConflictDoUpdate({ target: pagos.id, set: pagoToRow(pago) })
    .run();
}

export function getPagosByPrestamoId(prestamoId: string): Pago[] {
  return db
    .select()
    .from(pagos)
    .where(eq(pagos.prestamoId, prestamoId))
    .orderBy(pagos.createdAt)
    .all()
    .map(rowToPago);
}

export function getAllPagos(): Pago[] {
  return db.select().from(pagos).orderBy(pagos.createdAt).all().map(rowToPago);
}

export function upsertPagos(list: Pago[]): void {
  if (list.length === 0) return;
  for (const p of list) {
    db.insert(pagos)
      .values(pagoToRow(p))
      .onConflictDoUpdate({ target: pagos.id, set: pagoToRow(p) })
      .run();
  }
}

export function deletePago(id: string): void {
  db.delete(pagos).where(eq(pagos.id, id)).run();
}

export function clearPagos(): void {
  db.delete(pagos).run();
}
