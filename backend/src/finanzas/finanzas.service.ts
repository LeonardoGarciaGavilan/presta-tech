import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { m, roundMoney } from '../common/utils/money';
import { getFechaRD } from '../common/utils/fecha.utils';

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

  private mesKeyRD(date: Date): string {
    return getFechaRD(date).slice(0, 7);
  }

  // ─── Genera etiqueta "Ene 2026" ─────────────────────────────────────────────
  private mesLabel(year: number, month: number): string {
    return new Intl.DateTimeFormat('es-DO', {
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month, 1));
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
      : new Date(
          Date.UTC(
            ahora.getUTCFullYear(),
            ahora.getUTCMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        );

    const fechaDesde = desde
      ? this.startOfDay(desde)
      : new Date(
          Date.UTC(
            ahora.getUTCFullYear(),
            ahora.getUTCMonth() - (meses - 1),
            1,
          ),
        );

    // ── Obtener pagos y gastos en paralelo ────────────────────────────────────
    const [pagos, gastos] = await Promise.all([
      this.prisma.pago.findMany({
        where: {
          prestamo: { empresaId },
          createdAt: { gte: fechaDesde, lte: fechaHasta },
        },
        select: {
          montoTotal: true,
          capital: true,
          interes: true,
          mora: true,
          createdAt: true,
        },
      }),
      this.prisma.gasto.findMany({
        where: {
          empresaId,
          fecha: { gte: fechaDesde, lte: fechaHasta },
        },
        select: {
          monto: true,
          fecha: true,
          categoria: true,
        },
      }),
    ]);

    // ── Construir mapa de meses en el rango ───────────────────────────────────
    const mesMap: Record<
      string,
      {
        key: string;
        mes: string;
        año: number;
        mesNum: number;
        cobrado: number;
        capital: number;
        interes: number;
        mora: number;
        gastado: number;
        balance: number;
        cantidadPagos: number;
        cantidadGastos: number;
      }
    > = {};

    // Iterar todos los meses entre fechaDesde y fechaHasta usando claves RD
    const cur = new Date(
      Date.UTC(fechaDesde.getUTCFullYear(), fechaDesde.getUTCMonth(), 1),
    );
    while (cur <= fechaHasta) {
      const key = this.mesKeyRD(cur);
      if (!mesMap[key]) {
        mesMap[key] = {
          key,
          mes: this.mesLabel(
            Number(key.slice(0, 4)),
            Number(key.slice(5, 7)) - 1,
          ),
          año: Number(key.slice(0, 4)),
          mesNum: Number(key.slice(5, 7)),
          cobrado: 0,
          capital: 0,
          interes: 0,
          mora: 0,
          gastado: 0,
          balance: 0,
          cantidadPagos: 0,
          cantidadGastos: 0,
        };
      }
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }

    const asegurarMes = (key: string) => {
      if (!mesMap[key]) {
        mesMap[key] = {
          key,
          mes: this.mesLabel(
            Number(key.slice(0, 4)),
            Number(key.slice(5, 7)) - 1,
          ),
          año: Number(key.slice(0, 4)),
          mesNum: Number(key.slice(5, 7)),
          cobrado: 0,
          capital: 0,
          interes: 0,
          mora: 0,
          gastado: 0,
          balance: 0,
          cantidadPagos: 0,
          cantidadGastos: 0,
        };
      }
    };

    // ── Acumular pagos (bucket por mes en zona RD) ────────────────────────
    for (const p of pagos) {
      const key = this.mesKeyRD(p.createdAt);
      asegurarMes(key);
      mesMap[key].cobrado += m(p.montoTotal);
      mesMap[key].capital += m(p.capital);
      mesMap[key].interes += m(p.interes);
      mesMap[key].mora += m(p.mora);
      mesMap[key].cantidadPagos += 1;
    }

    // ── Acumular gastos (bucket por mes en zona RD) ───────────────────────
    for (const g of gastos) {
      const key = this.mesKeyRD(g.fecha);
      asegurarMes(key);
      mesMap[key].gastado += m(g.monto);
      mesMap[key].cantidadGastos += 1;
    }

    // ── Calcular balance por mes ──────────────────────────────────────────────
    const mesesArr = Object.values(mesMap)
      .map((mes) => ({
        ...mes,
        cobrado: roundMoney(mes.cobrado),
        capital: roundMoney(mes.capital),
        interes: roundMoney(mes.interes),
        mora: roundMoney(mes.mora),
        gastado: roundMoney(mes.gastado),
        balance: roundMoney(mes.cobrado - mes.gastado),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    // ── Totales globales ──────────────────────────────────────────────────────
    const totalCobrado = roundMoney(
      mesesArr.reduce((s, mes) => s + mes.cobrado, 0),
    );
    const totalGastado = roundMoney(
      mesesArr.reduce((s, mes) => s + mes.gastado, 0),
    );
    const totalBalance = roundMoney(totalCobrado - totalGastado);
    const totalCapital = roundMoney(
      mesesArr.reduce((s, mes) => s + mes.capital, 0),
    );
    const totalInteres = roundMoney(
      mesesArr.reduce((s, mes) => s + mes.interes, 0),
    );
    const totalMora = roundMoney(mesesArr.reduce((s, mes) => s + mes.mora, 0));
    const totalPagos = mesesArr.reduce((s, mes) => s + mes.cantidadPagos, 0);
    const totalGastos = mesesArr.reduce((s, mes) => s + mes.cantidadGastos, 0);

    // ── Gastos por categoría (total del período) ──────────────────────────────
    const porCategoria: Record<string, number> = {};
    for (const g of gastos) {
      porCategoria[g.categoria] = roundMoney(
        (porCategoria[g.categoria] ?? 0) + m(g.monto),
      );
    }

    // ── Margen operacional (si cobrado > 0) ───────────────────────────────────
    const margenPct =
      totalCobrado > 0
        ? Math.round((totalBalance / totalCobrado) * 10000) / 100
        : 0;

    return {
      meses: mesesArr,
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
