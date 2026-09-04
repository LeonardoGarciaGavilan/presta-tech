export type MoneyValue = number | string | null | undefined;

export function m(v: MoneyValue): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function totalCuota(monto: MoneyValue, mora?: MoneyValue): number {
  return Math.round((m(monto) + m(mora)) * 100) / 100;
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return n;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  return (sign * Math.round((abs + Number.EPSILON) * 100)) / 100;
}

export function toCents(n: number): number {
  return Math.round(roundMoney(n) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
