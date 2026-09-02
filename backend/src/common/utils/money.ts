export type MoneyInput = number | { toNumber(): number };

const aNumero = (v: MoneyInput): number =>
  typeof v === 'number' ? v : v.toNumber();

export const m = (v: MoneyInput): number => aNumero(v);

export function roundMoney(n: MoneyInput): number {
  const v = aNumero(n);
  if (!Number.isFinite(v)) return v;
  const sign = v < 0 ? -1 : 1;
  const abs = Math.abs(v);
  return (sign * Math.round((abs + Number.EPSILON) * 100)) / 100;
}

export function toCents(n: MoneyInput): number {
  return Math.round(roundMoney(n) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
