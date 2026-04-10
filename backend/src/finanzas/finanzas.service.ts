import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanzasService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers UTC ────────────────────────────────────────────────────────────
  private startOfDay(dateStr: string): Date {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  }
  private endOfDay(dateStr: string): Date {
    return new Date(`${dateStr.slice(0, 10)}T23:59:59.999Z`);
  }

  // ─── Genera etiqueta "Ene 2026" ─────────────────────────────────────────────
  private mesLabel(year: number, month: number): string {
    return new Intl.DateTimeFormat('es-DO', { month: 'short', year: 'numeric' })
      .format(new Date(year, month, 1));
  }

  // ─── RESUMEN MENSUAL ────────────────────────────────────────────────────────
  // Devuelve los últimos N meses con cobros, gastos y balance neto.
  // Si se pasan desde/hasta, filtra dentro de ese rango.

  async resumenMensual(
    empresaId: string,
    desde?: string,
    hasta?: string,
    meses = 6,
  ) {
    const ahora = new Date();

    // Construir rango — si no vienen parámetros usamos últimos N meses
    const fechaHasta = hasta
      ? this.endOfDay(hasta)
      : new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const fechaDesde = desde
      ? this.startOfDay(desde)
      : new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - (meses - 1), 1));

    // ── Obtener pagos y gastos en paralelo ────────────────────────────────────
    const [pagos, gastos] = await Promise.all([
      this.prisma.pago.findMany({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: fechaDesde, lte: fechaHasta },
        },
        select: {
          montoTotal: true,
          capital:    true,
          interes:    true,
          mora:       true,
          createdAt:  true,
        },
      }),
      this.prisma.gasto.findMany({
        where: {
          empresaId,
          fecha: { gte: fechaDesde, lte: fechaHasta },
        },
        select: {
          monto:    true,
          fecha:    true,
          categoria: true,
        },
      }),
    ]);

    // ── Construir mapa de meses en el rango ───────────────────────────────────
    const mesMap: Record<string, {
      key: string; mes: string; año: number; mesNum: number;
      cobrado: number; capital: number; interes: number; mora: number;
      gastado: number; balance: number; cantidadPagos: number; cantidadGastos: number;
    }> = {};

    // Iterar todos los meses entre fechaDesde y fechaHasta
    const cur = new Date(Date.UTC(
      fechaDesde.getUTCFullYear(),
      fechaDesde.getUTCMonth(),
      1,
    ));
    while (cur <= fechaHasta) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`;
      mesMap[key] = {
        key,
        mes:            this.mesLabel(cur.getUTCFullYear(), cur.getUTCMonth()),
        año:            cur.getUTCFullYear(),
        mesNum:         cur.getUTCMonth() + 1,
        cobrado:        0,
        capital:        0,
        interes:        0,
        mora:           0,
        gastado:        0,
        balance:        0,
        cantidadPagos:  0,
        cantidadGastos: 0,
      };
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }

    // ── Acumular pagos ────────────────────────────────────────────────────────
    for (const p of pagos) {
      const d   = new Date(p.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (mesMap[key]) {
        mesMap[key].cobrado       += p.montoTotal;
        mesMap[key].capital       += p.capital;
        mesMap[key].interes       += p.interes;
        mesMap[key].mora          += p.mora;
        mesMap[key].cantidadPagos += 1;
      }
    }

    // ── Acumular gastos ───────────────────────────────────────────────────────
    for (const g of gastos) {
      const d   = new Date(g.fecha);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (mesMap[key]) {
        mesMap[key].gastado        += g.monto;
        mesMap[key].cantidadGastos += 1;
      }
    }

    // ── Calcular balance por mes ──────────────────────────────────────────────
    const mesesArr = Object.values(mesMap).map((m) => ({
      ...m,
      cobrado:  Math.round(m.cobrado  * 100) / 100,
      capital:  Math.round(m.capital  * 100) / 100,
      interes:  Math.round(m.interes  * 100) / 100,
      mora:     Math.round(m.mora     * 100) / 100,
      gastado:  Math.round(m.gastado  * 100) / 100,
      balance:  Math.round((m.cobrado - m.gastado) * 100) / 100,
    }));

    // ── Totales globales ──────────────────────────────────────────────────────
    const totalCobrado  = Math.round(mesesArr.reduce((s, m) => s + m.cobrado,  0) * 100) / 100;
    const totalGastado  = Math.round(mesesArr.reduce((s, m) => s + m.gastado,  0) * 100) / 100;
    const totalBalance  = Math.round((totalCobrado - totalGastado) * 100) / 100;
    const totalCapital  = Math.round(mesesArr.reduce((s, m) => s + m.capital,  0) * 100) / 100;
    const totalInteres  = Math.round(mesesArr.reduce((s, m) => s + m.interes,  0) * 100) / 100;
    const totalMora     = Math.round(mesesArr.reduce((s, m) => s + m.mora,     0) * 100) / 100;
    const totalPagos    = mesesArr.reduce((s, m) => s + m.cantidadPagos,  0);
    const totalGastos   = mesesArr.reduce((s, m) => s + m.cantidadGastos, 0);

    // ── Gastos por categoría (total del período) ──────────────────────────────
    const porCategoria: Record<string, number> = {};
    for (const g of gastos) {
      porCategoria[g.categoria] = Math.round(
        ((porCategoria[g.categoria] ?? 0) + g.monto) * 100
      ) / 100;
    }

    // ── Margen operacional (si cobrado > 0) ───────────────────────────────────
    const margenPct = totalCobrado > 0
      ? Math.round((totalBalance / totalCobrado) * 10000) / 100
      : 0;

    return {
      meses:   mesesArr,
      totales: {
        totalCobrado,
        totalGastado,
        totalBalance,
        totalCapital,
        totalInteres,
        totalMora,
        totalPagos,
        totalGastos,
        margenPct,
      },
      porCategoria,
      periodo: {
        desde: fechaDesde.toISOString().slice(0, 10),
        hasta: fechaHasta.toISOString().slice(0, 10),
      },
    };
  }
}