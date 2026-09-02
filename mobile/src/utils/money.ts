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