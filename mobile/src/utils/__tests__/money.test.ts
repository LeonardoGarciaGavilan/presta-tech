import { roundMoney, toCents, fromCents } from '@/utils/money';

describe('roundMoney — redondeo robusto half-away-from-zero', () => {
  it('redondea a 2 decimales valores exactos', () => {
    expect(roundMoney(112.83)).toBe(112.83);
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(5000)).toBe(5000);
  });

  it('maneja límites de centavo que en binario caen justo bajo el entero', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(0.005)).toBe(0.01);
    expect(roundMoney(10.015)).toBe(10.02);
  });

  it('redondea hacia abajo cuando corresponde', () => {
    expect(roundMoney(1.004)).toBe(1.0);
    expect(roundMoney(1234.5649)).toBe(1234.56);
  });

  it('es half-away-from-zero para negativos', () => {
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(-1.004)).toBe(-1.0);
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