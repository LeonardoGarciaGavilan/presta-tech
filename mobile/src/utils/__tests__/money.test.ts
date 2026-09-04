import { roundMoney, toCents, fromCents, m, totalCuota } from '@/utils/money';

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

describe('m — coacción defensiva de montos', () => {
  it('devuelve el número tal cual cuando ya es número', () => {
    expect(m(25)).toBe(25);
    expect(m(0)).toBe(0);
    expect(m(10.5)).toBe(10.5);
  });

  it('convierte strings numéricas', () => {
    expect(m('25')).toBe(25);
    expect(m('25.00')).toBe(25);
    expect(m('1500.75')).toBe(1500.75);
  });

  it('trata null/undefined/vacío como 0', () => {
    expect(m(null)).toBe(0);
    expect(m(undefined)).toBe(0);
    expect(m('')).toBe(0);
  });

  it('devuelve 0 para valores no numéricos', () => {
    expect(m('abc')).toBe(0);
    expect(m(NaN)).toBe(0);
    expect(m(Infinity)).toBe(0);
  });
});

describe('totalCuota — monto + mora redondeado', () => {
  it('suma monto y mora', () => {
    expect(totalCuota(100, 25)).toBe(125);
    expect(totalCuota('100', '25')).toBe(125);
  });

  it('mora null/undefined se trata como 0', () => {
    expect(totalCuota(100)).toBe(100);
    expect(totalCuota(100, null)).toBe(100);
    expect(totalCuota(100, undefined)).toBe(100);
  });

  it('tolera strings y falla a 0', () => {
    expect(totalCuota('10.50', '1.25')).toBe(11.75);
    expect(totalCuota(null, '5')).toBe(5);
  });
});