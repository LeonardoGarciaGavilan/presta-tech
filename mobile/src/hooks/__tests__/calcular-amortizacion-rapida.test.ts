jest.mock('@/hooks/use-prestamos', () => ({
  useCalcularTabla: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('@/hooks/use-network-status', () => ({
  getNetworkStatus: jest.fn().mockReturnValue({ isOnline: true }),
}));

jest.mock('@/utils/formatters', () => ({
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
}));

import {
  siguienteFecha,
  calcularAmortizacionRapidaLocal,
} from '@/hooks/use-prestamo-preview';

describe('siguienteFecha (2.8)', () => {
  const base = new Date('2026-01-05');

  it('DIARIO: +N días', () => {
    expect(siguienteFecha(base, 'DIARIO', 1).toISOString().split('T')[0]).toBe('2026-01-06');
    expect(siguienteFecha(base, 'DIARIO', 7).toISOString().split('T')[0]).toBe('2026-01-12');
  });

  it('SEMANAL: +N semanas', () => {
    expect(siguienteFecha(base, 'SEMANAL', 1).toISOString().split('T')[0]).toBe('2026-01-12');
    expect(siguienteFecha(base, 'SEMANAL', 3).toISOString().split('T')[0]).toBe('2026-01-26');
  });

  it('QUINCENAL: +N*15 días', () => {
    expect(siguienteFecha(base, 'QUINCENAL', 1).toISOString().split('T')[0]).toBe('2026-01-20');
    expect(siguienteFecha(base, 'QUINCENAL', 2).toISOString().split('T')[0]).toBe('2026-02-04');
  });

  it('MENSUAL: +N meses', () => {
    expect(siguienteFecha(base, 'MENSUAL', 1).toISOString().split('T')[0]).toBe('2026-02-05');
    expect(siguienteFecha(base, 'MENSUAL', 3).toISOString().split('T')[0]).toBe('2026-04-05');
  });
});

describe('calcularAmortizacionRapidaLocal (2.8)', () => {
  it('suma cuotas = montoTotal', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    expect(p.montoTotal).toBe(12000);
    expect(p.totalIntereses).toBe(2000);

    const suma = p.cuotas.reduce((s, c) => s + c.monto, 0);
    expect(suma).toBe(p.montoTotal);
  });

  it('todas las cuotas tienen interes > 0', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    for (const c of p.cuotas) {
      expect(c.interes).toBeGreaterThan(0);
      expect(c.capital).toBeGreaterThanOrEqual(0);
      expect(c.monto).toBe(c.capital + c.interes);
    }
  });

  it('capital + interes = monto en cada cuota', () => {
    const p = calcularAmortizacionRapidaLocal(5000, 3, 8000, 'MENSUAL', '2026-01-05');
    for (const c of p.cuotas) {
      expect(c.monto).toBe(c.capital + c.interes);
    }
  });

  it('última cuota absorbe el redondeo', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 3, 13000, 'SEMANAL', '2026-01-05');
    expect(p.montoTotal).toBe(13000);
    expect(p.totalIntereses).toBe(3000);

    const sumaIntereses = p.cuotas.reduce((s, c) => s + c.interes, 0);
    expect(sumaIntereses).toBe(3000);
  });

  it('cuotaFija = round(montoTotal/duracion), ultimaCuota ajusta', () => {
    const p = calcularAmortizacionRapidaLocal(8000, 3, 10001, 'SEMANAL', '2026-01-05');
    expect(p.cuotas[0].monto).toBe(3334);
    expect(p.cuotas[1].monto).toBe(3334);
    expect(p.cuotas[2].monto).toBe(3333);
    expect(p.cuotas.reduce((s, c) => s + c.monto, 0)).toBe(10001);
  });

  it('fechas correctas para MENSUAL', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 3, 12000, 'MENSUAL', '2026-01-05');
    expect(p.cuotas[0].fechaVencimiento).toBe('2026-02-05');
    expect(p.cuotas[1].fechaVencimiento).toBe('2026-03-05');
    expect(p.cuotas[2].fechaVencimiento).toBe('2026-04-05');
  });

  it('fechas correctas para SEMANAL', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 3, 12000, 'SEMANAL', '2026-01-05');
    expect(p.cuotas[0].fechaVencimiento).toBe('2026-01-12');
    expect(p.cuotas[1].fechaVencimiento).toBe('2026-01-19');
    expect(p.cuotas[2].fechaVencimiento).toBe('2026-01-26');
  });

  it('saldoRestante decrece con cada capital', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    let saldo = 10000;
    for (const c of p.cuotas) {
      saldo = Math.max(0, Math.round((saldo - c.capital) * 100) / 100);
      expect(c.saldoRestante).toBe(saldo);
    }
    expect(saldo).toBe(0);
  });

  it('GANANCIA: totalCobrar = monto + ganancia', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    expect(p.montoTotal).toBe(12000);
    expect(p.totalIntereses).toBe(2000);
    expect(p.cuotaInicial).toBe(3000);
  });

  it('PAGO: totalCobrar = pagoPorPeriodo * duracion', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    expect(p.montoTotal).toBe(12000);
    expect(p.cuotas[0].monto).toBe(3000);
    expect(p.cuotas[1].monto).toBe(3000);
    expect(p.cuotas[2].monto).toBe(3000);
    expect(p.cuotas[3].monto).toBe(3000);
  });

  it('valores impares: 5000, 4 cuotas, 6000 total', () => {
    const p = calcularAmortizacionRapidaLocal(5000, 4, 6000, 'SEMANAL', '2026-01-05');
    expect(p.montoTotal).toBe(6000);
    expect(p.totalIntereses).toBe(1000);
    const suma = p.cuotas.reduce((s, c) => s + c.monto, 0);
    expect(suma).toBe(6000);
  });

  it('cuotaInicial = primera cuota monto', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    expect(p.cuotaInicial).toBe(p.cuotas[0].monto);
  });

  it('tasaPeriodo = 0 (modo rápido no usa tasa)', () => {
    const p = calcularAmortizacionRapidaLocal(10000, 4, 12000, 'SEMANAL', '2026-01-05');
    expect(p.tasaPeriodo).toBe(0);
  });
});
