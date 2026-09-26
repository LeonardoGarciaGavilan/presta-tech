import { m, roundMoney, toCents, fromCents } from './money';

const c = (n: number) => roundMoney(n);

describe('roundMoney — redondeo robusto half-away-from-zero', () => {
  it('redondea a 2 decimales valores exactos', () => {
    expect(c(112.83)).toBe(112.83);
    expect(c(0)).toBe(0);
    expect(c(5000)).toBe(5000);
  });

  it('maneja límites de centavo que en binario caen justo bajo el entero', () => {
    expect(c(1.005)).toBe(1.01);
    expect(c(2.675)).toBe(2.68);
    expect(c(0.005)).toBe(0.01);
    expect(c(10.015)).toBe(10.02);
  });

  it('redondea hacia abajo cuando corresponde', () => {
    expect(c(1.004)).toBe(1.0);
    expect(c(10.014)).toBe(10.01);
    expect(c(1234.5649)).toBe(1234.56);
  });

  it('es half-away-from-zero para negativos', () => {
    expect(c(-1.005)).toBe(-1.01);
    expect(c(-1.004)).toBe(-1.0);
  });

  it('no rompe con valores grandes ni no-finitos', () => {
    expect(c(999999999999.995)).toBe(1000000000000.0);
    expect(c(NaN)).toBeNaN();
    expect(c(Infinity)).toBe(Infinity);
  });
});

describe('toCents / fromCents', () => {
  it('convierten pesos a céntimos y viceversa sin artefactos', () => {
    expect(toCents(10.1)).toBe(1010);
    expect(toCents(112.83)).toBe(11283);
    expect(toCents(1.005)).toBe(101);
    expect(fromCents(11283)).toBe(112.83);
  });
});

describe('inputs crudos (null/undefined/string) — no lanzan y voltean a 0', () => {
  it('roundMoney no explota con null ni undefined (SQL row_to_json)', () => {
    expect(roundMoney(null)).toBe(0);
    expect(roundMoney(undefined)).toBe(0);
  });

  it('roundMoney tolera strings numéricos y vacíos', () => {
    expect(roundMoney('1.005')).toBe(1.01);
    expect(roundMoney('')).toBe(0);
    expect(roundMoney('abc')).toBe(0);
  });

  it('roundMoney acepta objeto Decimal-like con toNumber', () => {
    expect(roundMoney({ toNumber: () => 19.5 })).toBe(19.5);
  });

  it('m vuelve a 0 para nulos y vacío, y respeta Decimal-like', () => {
    expect(m(null)).toBe(0);
    expect(m(undefined)).toBe(0);
    expect(m('')).toBe(0);
    expect(m('12.5')).toBe(12.5);
    expect(m({ toNumber: () => 19.5 })).toBe(19.5);
  });
});
