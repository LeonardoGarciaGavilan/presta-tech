import type { Node } from 'react-native-thermal-printer-driver';

import { compilarDocumento } from '@/utils/escpos-compiler';
import { buildDocumentoPrueba } from '@/utils/recibo-test';
import { buildReciboDocument } from '@/utils/recibo-escpos';
import type { ReciboData } from '@/utils/recibo-pdf';
import { useAuthStore } from '@/store/auth.store';

const C = {
  ESC: 0x1b,
  FS: 0x1c,
  GS: 0x1d,
  LF: 0x0a,
};

const RECIBO_BASE: ReciboData = {
  pago: {
    id: 'pago_x',
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
  cliente: { nombre: 'Juan', apellido: 'Pérez', cedula: '00123456789' },
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

function subArray(bytes: number[], sub: number[]): boolean {
  return bytes.some((_, i) => sub.every((b, j) => bytes[i + j] === b));
}

describe('compilarDocumento (compilador propio ESC/POS)', () => {
  it('emite INIT + cancelar modo chino (FS .) + fuente A + página CP850', () => {
    expect(compilarDocumento([])).toEqual([
      C.ESC, 0x40,
      C.FS, 0x2e,
      C.ESC, 0x4d, 0x00,
      C.ESC, 0x74, 0x02,
    ]);
  });

  it('siempre cancela el modo chino incluso en modo ascii', () => {
    const bytes = compilarDocumento([{ type: 'text', content: 'x' }], { codePage: 'ascii' });
    expect(subArray(bytes, [C.FS, 0x2e])).toBe(true);
  });

  it('codifica en modo ascii transcribiendo acentos y sin bytes altos ni ESC t', () => {
    const bytes = compilarDocumento(
      [
        { type: 'text', content: 'Pérez, ñ y N° · °' },
        { type: 'text', content: 'con acentos: á é í ó ú ñ ü', style: { align: 'center' } },
      ],
      { codePage: 'ascii' },
    );

    expect(subArray(bytes, [C.ESC, 0x74, 0x02])).toBe(false);
    const texto = bytes.map((b) => String.fromCharCode(b)).join('');
    expect(texto).toContain('Perez, n y No - o');
    expect(texto).toContain('con acentos: a e i o u n u');
    for (const byte of bytes) {
      expect(byte).toBeLessThan(0x80);
    }
  });

  it('codifica texto acentuado a un byte de la página (sin UTF-8)', () => {
    const conCp850 = compilarDocumento([{ type: 'text', content: 'é' }], { codePage: 'cp850' });
    expect(conCp850).toContain(0x82);
    expect(conCp850[conCp850.length - 1]).toBe(C.LF);

    const conCp1252 = compilarDocumento([{ type: 'text', content: 'é' }], { codePage: 'cp1252' });
    expect(subArray(conCp1252, [C.ESC, 0x74, 0x10])).toBe(true);
    expect(conCp1252).toContain(0xe9);

    const conCp858 = compilarDocumento([{ type: 'text', content: '€' }], { codePage: 'cp858' });
    expect(conCp858).toContain(0xd5);
  });

  it('controla negrita, alineación y tamaño (GS !)', () => {
    const bytes = compilarDocumento(
      [{ type: 'text', content: 'Hola', style: { align: 'center', bold: true, size: 2 } }],
      { codePage: 'cp437' },
    );

    expect(subArray(bytes, [C.ESC, 0x61, 0x01])).toBe(true);
    expect(subArray(bytes, [C.ESC, 0x45, 0x01])).toBe(true);
    expect(subArray(bytes, [C.GS, 0x21, 0x11])).toBe(true);

    const ordenAlto = bytes.indexOf(C.ESC);
    const ordenCentro = bytes.indexOf(C.ESC, ordenAlto + 1);
    const ordenNegrita = bytes.indexOf(C.ESC, ordenCentro + 1);
    const resto = bytes.slice(ordenNegrita + 3);
    expect(resto).toContain(0x48); // 'H'

    expect(subArray(bytes, [C.ESC, 0x61, 0x00])).toBe(true);
    expect(subArray(bytes, [C.ESC, 0x45, 0x00])).toBe(true);
    expect(subArray(bytes, [C.GS, 0x21, 0x00])).toBe(true);
  });

  it('no consume el reset de tamaño si el texto es tamaño 1', () => {
    const bytes = compilarDocumento([{ type: 'text', content: 'x' }], { codePage: 'cp850' });
    expect(subArray(bytes, [C.GS, 0x21, 0x00])).toBe(false);
  });

  it('linea sólida y punteada de 32 caracteres', () => {
    const guion = '-'.charCodeAt(0);
    const textoDe = (bytes: number[]) => {
      const inicio = bytes.indexOf(guion);
      const fin = bytes.lastIndexOf(C.LF);
      return String.fromCharCode(...bytes.slice(inicio, fin < inicio ? undefined : fin));
    };

    const solida = compilarDocumento([{ type: 'line' }], { codePage: 'cp850' });
    expect(textoDe(solida)).toBe('-'.repeat(32));

    const punteada = compilarDocumento([{ type: 'line', style: 'dashed' }], { codePage: 'cp850' });
    expect(textoDe(punteada)).toBe('- '.repeat(16));
  });

  it('columnas: respeta anchos fraccionarios y aplica negrita por columna', () => {
    const nodo: Node = {
      type: 'columns',
      columns: [
        { content: 'Cant', width: 0.15, align: 'left' },
        { content: 'Total', width: 0.3, align: 'right', style: { bold: true } },
      ],
    };
    const bytes = compilarDocumento([nodo], { codePage: 'cp850' });
    const texto = bytes.map((b) => String.fromCharCode(b)).join('');

    expect(texto).toContain('Cant');
    expect(texto).toContain('Total');
    const inicioBold = texto.indexOf('\x1bE\x01');
    const finBold = texto.indexOf('\x1bE\x00', inicioBold);
    expect(inicioBold).toBeGreaterThanOrEqual(0);
    expect(finBold).toBeGreaterThanOrEqual(0);
  });

  it('alimenta y corta al final del documento de prueba', () => {
    const bytes = compilarDocumento(buildDocumentoPrueba(), { codePage: 'cp850' });
    expect(subArray(bytes, [C.ESC, 0x64, 0x03])).toBe(true);
    expect(subArray(bytes, [C.GS, 0x56, 0x01])).toBe(true);
  });

  it('compila un recibo real sin emitir UTF-8 y con acentos de cp850', () => {
    useAuthStore.setState({ user: { nombre: 'Ana', empresa: 'Financiera Prueba SA' } as never });
    const bytes = compilarDocumento(buildReciboDocument(RECIBO_BASE), { paperWidthMm: 58, codePage: 'cp850' });

    const bytesValidosCp850 = new Set([
      0x82, 0x90, 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xb5, 0x9a, 0xd6, 0xe0, 0xe9, 0x81, 0xf8, 0xfa,
    ]);

    expect(bytes).toContain(0x82); // 'é' de Pérez / García
    for (const byte of bytes) {
      if (byte >= 0x80) {
        expect(bytesValidosCp850.has(byte)).toBe(true);
      }
    }
    expect(subArray(bytes, [0xc3, 0xa9])).toBe(false);
    expect(subArray(bytes, [0xc3, 0xb1])).toBe(false);
  });

  it('recibo en CP1252 emite PRÉSTAMO/INTERÉS/MÉTODO sin el 0x90 roto', () => {
    useAuthStore.setState({ user: { nombre: 'Ana', empresa: 'Financiera Prueba SA' } as never });
    const bytes = compilarDocumento(buildReciboDocument(RECIBO_BASE), { paperWidthMm: 58, codePage: 'cp1252' });
    const codigo = (s: string) => s.split('').map((c) => c.charCodeAt(0));

    expect(subArray(bytes, [C.ESC, 0x74, 0x10])).toBe(true); // ESC t 16 = CP1252
    expect(subArray(bytes, codigo('PRÉSTAMO'))).toBe(true); // É = 0xC9
    expect(subArray(bytes, codigo('Interés'))).toBe(true); // é = 0xE9
    expect(subArray(bytes, codigo('Método'))).toBe(true); // é = 0xE9
    expect(bytes).not.toContain(0x90); // la É rota de CP850 jamás se emite
    expect(bytes).not.toContain(0x82); // la é de CP850 tampoco
  });
});