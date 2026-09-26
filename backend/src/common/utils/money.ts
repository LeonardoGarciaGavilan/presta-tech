export type MoneyInput =
  | number
  | string
  | null
  | undefined
  | { toNumber(): number };

const aNumero = (v: MoneyInput): number => {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return v.toNumber();
};

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
