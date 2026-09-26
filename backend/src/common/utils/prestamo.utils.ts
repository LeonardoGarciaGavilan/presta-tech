// src/common/utils/prestamo.utils.ts
import { m, roundMoney } from './money';
import type { MoneyInput } from './money';

// Forma mínima que necesita el cálculo desde una cuota (Decimal o number).
type CuotaCalculable = {
  pagada: boolean;
  capital: MoneyInput;
  interes: MoneyInput;
  mora?: MoneyInput;
};

export function calcularDesdeObjeto(prestamo: any): {
  saldoPendiente: number;
  moraAcumulada: number;
} {
  const cuotasPendientes = (
    (prestamo.cuotas ?? []) as CuotaCalculable[]
  ).filter((c) => !c.pagada);

  const saldo = cuotasPendientes.reduce(
    (sum, c) =>
      sum + m(c.capital) + m(c.interes) + m(c.mora ?? 0),
    0,
  );

  const mora = cuotasPendientes.reduce(
    (sum, c) => sum + m(c.mora ?? 0),
    0,
  );

  return {
    saldoPendiente: roundMoney(saldo),
    moraAcumulada: roundMoney(mora),
  };
}

export function calcularSaldoDesdeCuotas(cuotas: any[]): number {
  const cuotasPendientes = (cuotas as CuotaCalculable[]).filter(
    (c) => !c.pagada,
  );
  const saldo = cuotasPendientes.reduce(
    (sum, c) =>
      sum + m(c.capital) + m(c.interes) + m(c.mora ?? 0),
    0,
  );
  return roundMoney(saldo);
}

export function calcularMoraDesdeCuotas(cuotas: any[]): number {
  const cuotasPendientes = (cuotas as CuotaCalculable[]).filter(
    (c) => !c.pagada,
  );
  const mora = cuotasPendientes.reduce(
    (sum, c) => sum + m(c.mora ?? 0),
    0,
  );
  return roundMoney(mora);
}