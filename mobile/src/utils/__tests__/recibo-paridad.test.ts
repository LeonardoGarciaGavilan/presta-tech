import { buildReciboDocument, renderNodes } from '@/utils/recibo-escpos';
import { generateReciboHtml, type ReciboData } from '@/utils/recibo-pdf';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/utils/formatters';

const RECIBO_BASE: ReciboData = {
  pago: {
    id: 'pago_abcdef1234567890',
    capital: 400,
    interes: 50,
    mora: 0,
    abonoCapital: 0,
    montoTotal: 450,
    metodo: 'EFECTIVO',
    referencia: 'REF-001',
    observacion: 'Pago García',
    pagoCompleto: true,
    createdAt: '2026-08-27T10:30:00.000Z',
  },
  cliente: {
    nombre: 'Juan',
    apellido: 'Pérez',
    cedula: '00123456789',
  },
  prestamo: {
    monto: 10000,
    numeroCuotas: 12,
    frecuenciaPago: 'SEMANAL',
    saldoPendiente: 400,
  },
  cuota: {
    id: 'cuota_1',
    numero: 5,
    monto: 450,
    capital: 400,
    interes: 50,
    mora: 0,
    fechaVencimiento: '2026-08-25',
    pagoCompleto: true,
  },
  usuario: { nombre: 'Ana' },
};

beforeEach(() => {
  useAuthStore.setState({ user: { nombre: 'Ana', empresa: 'Financiera Prueba SA' } as never });
});

describe('paridad recibo térmico (ESC/POS) vs PDF (HTML)', () => {
  it('contiene los mismos datos clave en ambos formatos', () => {
    const escposLineas = renderNodes(buildReciboDocument(RECIBO_BASE)).join('\n');
    const html = generateReciboHtml(RECIBO_BASE);

    const esperados = [
      '#34567890',
      'Juan Pérez',
      '001-2345678-9',
      formatCurrency(10000),
      '#5 de 12',
      'Semanal',
      formatCurrency(400),
      formatCurrency(50),
      'Efectivo',
      'REF-001',
      'Pago García',
      formatCurrency(450),
      'Financiera Prueba SA',
      'Ana',
    ];

    for (const token of esperados) {
      expect(escposLineas).toContain(token);
      expect(html).toContain(token);
    }
  });

  it('marca la cuota en abono con la misma advertencia en ambos formatos', () => {
    const data: ReciboData = {
      ...RECIBO_BASE,
      pago: { ...RECIBO_BASE.pago!, pagoCompleto: false, montoTotal: 200, capital: 150, interes: 50 },
    };

    const escposLineas = renderNodes(buildReciboDocument(data)).join('\n');
    const html = generateReciboHtml(data);

    expect(escposLineas).toContain('CUOTA EN ABONO');
    expect(escposLineas).toContain('Abono parcial');
    expect(html).toContain('Cuota en Abono');
    expect(html).toContain('Abono parcial');
  });

  it('marca el préstamo saldado en ambos formatos', () => {
    const data: ReciboData = {
      ...RECIBO_BASE,
      prestamo: { ...RECIBO_BASE.prestamo!, saldoPendiente: 0 },
    };

    const escposLineas = renderNodes(buildReciboDocument(data)).join('\n');
    const html = generateReciboHtml(data);

    expect(escposLineas).toContain('completamente pagado');
    expect(html).toContain('completamente pagado');
  });
});