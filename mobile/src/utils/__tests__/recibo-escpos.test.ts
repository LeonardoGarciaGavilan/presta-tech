import type { Node } from 'react-native-thermal-printer-driver';

import { buildReciboDocument, buildReciboDesembolso, buildReciboRetiro } from '@/utils/recibo-escpos';
import { useAuthStore } from '@/store/auth.store';
import type { DesembolsoReciboData, ReciboData, RetiroReciboData } from '@/utils/recibo-pdf';

const RECIBO_BASE: ReciboData = {
  pago: {
    id: 'pago_abcdef1234567890',
    capital: 400,
    interes: 50,
    mora: 0,
    abonoCapital: 0,
    montoTotal: 450,
    metodo: 'EFECTIVO',
    referencia: null,
    observacion: null,
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

describe('buildReciboDocument', () => {
  it('construye el documento con encabezado, cliente, detalle y total', () => {
    const nodes = buildReciboDocument(RECIBO_BASE);

    expect(nodes.some((n) => n.type === 'text' && n.content === 'Recibo de Pago')).toBe(true);
    expect(nodes.some((n) => n.type === 'text' && n.content.includes('Financiera Prueba SA'))).toBe(true);
    expect(nodes.some((n) => n.type === 'text' && n.content.includes('Juan Pérez'))).toBe(true);
    expect(nodes.some((n) => n.type === 'text' && n.content.includes('Total Pagado'))).toBe(true);
    expect(nodes.some((n) => n.type === 'cut')).toBe(true);
  });

  it('incluye la cuota pagada y el método de pago', () => {
    const nodes = buildReciboDocument(RECIBO_BASE);
    const texts = nodes
      .filter((n): n is Extract<Node, { type: 'text' }> => n.type === 'text')
      .map((n) => n.content);
    const columns = nodes.filter((n) => n.type === 'columns');

    expect(texts).toContain('CUOTA PAGADA');
    expect(columns.some((n) => n.type === 'columns' && n.columns[1]?.content === 'Efectivo')).toBe(true);
    expect(columns.some((n) => n.type === 'columns' && n.columns[1]?.content === '#5 de 12')).toBe(true);
  });

  it('marca la cuota en abono cuando no es pago completo', () => {
    const data: ReciboData = {
      ...RECIBO_BASE,
      pago: { ...RECIBO_BASE.pago!, pagoCompleto: false, montoTotal: 200, capital: 150, interes: 50 },
    };
    const nodes = buildReciboDocument(data);
    const texts = nodes
      .filter((n): n is Extract<Node, { type: 'text' }> => n.type === 'text')
      .map((n) => n.content);

    expect(texts).toContain('CUOTA EN ABONO');
    expect(texts.some((t) => t.includes('saldo'))).toBe(true);
  });

  it('muestra el mensaje de saldado cuando el saldo llega a cero', () => {
    const data: ReciboData = {
      ...RECIBO_BASE,
      prestamo: { ...RECIBO_BASE.prestamo!, saldoPendiente: 0 },
    };
    const nodes = buildReciboDocument(data);
    const texts = nodes
      .filter((n): n is Extract<Node, { type: 'text' }> => n.type === 'text')
      .map((n) => n.content);

    expect(texts.some((t) => t.includes('completamente pagado'))).toBe(true);
  });
});

describe('buildReciboDesembolso', () => {
  const DESEMBOLSO: DesembolsoReciboData = {
    desembolso: {
      id: 'prestamo_9876543210',
      monto: 25000,
      numeroCuotas: 8,
      frecuenciaPago: 'SEMANAL',
      tasaInteres: 2,
      createdAt: '2026-08-27T10:30:00.000Z',
    },
    cliente: { nombre: 'María', apellido: 'Díaz', cedula: '00123456789' },
    usuario: { nombre: 'Ana' },
  };

  it('construye el recibo de desembolso con préstamo y total', () => {
    const nodes = buildReciboDesembolso(DESEMBOLSO);
    const texts = nodes
      .filter((n): n is Extract<Node, { type: 'text' }> => n.type === 'text')
      .map((n) => n.content);
    const columns = nodes.filter((n) => n.type === 'columns');

    expect(texts).toContain('Recibo de Desembolso');
    expect(texts).toContain('#76543210');
    expect(nodes.some((n) => n.type === 'text' && n.content.includes('María Díaz'))).toBe(true);
    expect(texts).toContain('PRÉSTAMO');
    expect(columns.some((n) => n.columns[0]?.content === 'Cuotas')).toBe(true);
    expect(texts).toContain('Total Desembolsado');
    expect(nodes.some((n) => n.type === 'cut')).toBe(true);
  });

  it('muestra tasa fija si no hay tasa de interés', () => {
    const data = { ...DESEMBOLSO, desembolso: { ...DESEMBOLSO.desembolso!, tasaInteres: 0 } };
    const nodes = buildReciboDesembolso(data);
    const columns = nodes.filter((n) => n.type === 'columns');
    expect(columns.some((n) => n.columns[0]?.content === 'Tasa' && n.columns[1]?.content === 'Cuota fija')).toBe(true);
  });
});

describe('buildReciboRetiro', () => {
  const RETIRO: RetiroReciboData = {
    retiro: {
      id: 'retiro_1234abcd98',
      tipo: 'Retiro de ganancias',
      monto: 5000,
      concepto: 'Cierre mensual',
      createdAt: '2026-08-27T10:30:00.000Z',
    },
    usuario: { nombre: 'Ana' },
  };

  it('construye el recibo de retiro con monto y concepto', () => {
    const nodes = buildReciboRetiro(RETIRO);
    const texts = nodes
      .filter((n): n is Extract<Node, { type: 'text' }> => n.type === 'text')
      .map((n) => n.content);

    expect(texts).toContain('Recibo de Retiro');
    expect(texts).toContain('RETIRO DE GANANCIAS');
    expect(texts).toContain('Monto Retirado');
    expect(texts).toContain('CONCEPTO');
    expect(texts).toContain('Cierre mensual');
    expect(nodes.some((n) => n.type === 'cut')).toBe(true);
  });

  it('omite el número de retiro y el concepto si no están', () => {
    const data: RetiroReciboData = {
      retiro: { tipo: 'Retiro de capital', monto: 3000, createdAt: RETIRO.retiro!.createdAt },
    };
    const nodes = buildReciboRetiro(data);
    const texts = nodes
      .filter((n): n is Extract<Node, { type: 'text' }> => n.type === 'text')
      .map((n) => n.content);
    const columns = nodes.filter((n) => n.type === 'columns');

    expect(texts).toContain('RETIRO DE CAPITAL');
    expect(columns.some((n) => n.columns[0]?.content === 'Retiro N°')).toBe(false);
    expect(texts).not.toContain('Concepto');
  });
});