import { codificarTexto, resolverIdCodePage } from '@/utils/escpos-code-pages';

describe('codificarTexto / páginas de código ESC/POS', () => {
  it('deja el ASCII (US-ASCII) igual en cualquier página', () => {
    const ascii = 'PRESTATECH 58mm'.split('').map((c) => c.charCodeAt(0));
    for (const page of ['cp437', 'cp850', 'cp858', 'cp1252'] as const) {
      expect(codificarTexto('PRESTATECH 58mm', page)).toEqual(ascii);
    }
  });

  it('mapea el español a un solo byte en las páginas DOS (437/850/858)', () => {
    const esperado = {
      á: 0xa0,
      é: 0x82,
      í: 0xa1,
      ó: 0xa2,
      ú: 0xa3,
      ñ: 0xa4,
      ü: 0x81,
      Á: 0xb5,
      É: 0x90,
      Í: 0xd6,
      Ó: 0xe0,
      Ú: 0xe9,
      Ñ: 0xa5,
      Ü: 0x9a,
      '¿': 0xa8,
      '·': 0xfa,
      '°': 0xf8,
    };
    for (const [letra, byte] of Object.entries(esperado)) {
      expect(codificarTexto(letra, 'cp850')[0]).toBe(byte);
      expect(codificarTexto(letra, 'cp437')[0]).toBe(byte);
      expect(codificarTexto(letra, 'cp858')[0]).toBe(byte);
    }
  });

  it('mapea el español a CP1252 (Latin-1, ids 0xE0-0xFF)', () => {
    const esperado: Record<string, number> = {
      á: 0xe1,
      é: 0xe9,
      í: 0xed,
      ó: 0xf3,
      ú: 0xfa,
      ñ: 0xf1,
      ü: 0xfc,
      Á: 0xc1,
      É: 0xc9,
      Í: 0xcd,
      Ó: 0xd3,
      Ú: 0xda,
      Ñ: 0xd1,
      Ü: 0xdc,
      '¿': 0xbf,
      '·': 0xb7,
      '°': 0xb0,
      '€': 0x80,
      '½': 0xbd,
    };
    for (const [letra, byte] of Object.entries(esperado)) {
      expect(codificarTexto(letra, 'cp1252')[0]).toBe(byte);
    }
    expect(codificarTexto('€', 'cp858')[0]).toBe(0xd5);
  });

  it('no emite UTF-8 multibyte (nada >= 0x80 en el precompilado)', () => {
    const bytes = codificarTexto('Pérez, Martínez, Sánchez, Ñúñez á é í ó ú ñ ü', 'cp850');
    for (const byte of bytes) {
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(0xff);
    }
    expect(bytes).not.toContain(0xc3);
  });

  it('sustituye con "?" (0x3f) los caracteres sin byte en la página', () => {
    expect(codificarTexto('¥€', 'cp437')).toEqual([0x9d, 0x3f]);
  });

  it('resuelve el id de ESC t n por página', () => {
    expect(resolverIdCodePage('cp437')).toBe(0x00);
    expect(resolverIdCodePage('cp850')).toBe(0x02);
    expect(resolverIdCodePage('cp858')).toBe(0x0d);
    expect(resolverIdCodePage('cp1252')).toBe(0x10);
    expect(resolverIdCodePage(5)).toBe(5);
    expect(resolverIdCodePage('cp860')).toBeUndefined();
  });

  it('modo ascii: transcribe acentos a la letra base (100 % bytes < 0x80)', () => {
    const bytes = codificarTexto('Á É Í Ó Ú Ñ Ü · ° ¿ ¡ «» € ½', 'ascii');
    const texto = String.fromCharCode(...bytes);

    expect(texto).toBe('A E I O U N U - o ? ! <> E 1/2');
    for (const byte of bytes) {
      expect(byte).toBeLessThan(0x80);
    }
  });

  it('modo ascii: deja el ASCII intacto', () => {
    expect(codificarTexto('PRESTATECH 58mm / RD$ 1,250.00', 'ascii')).toEqual(
      'PRESTATECH 58mm / RD$ 1,250.00'.split('').map((c) => c.charCodeAt(0)),
    );
  });

  it('normaliza guiones, comillas tipográficas, nbsp y puntos suspensivos (nunca "?")', () => {
    const texto = 'Pago — Abono parcial – “Juan’s” 1\u00a0250.00 … fin';
    for (const page of ['cp437', 'cp850', 'cp858', 'cp1252', 'ascii'] as const) {
      const bytes = codificarTexto(texto, page);
      expect(bytes).not.toContain(0x3f);
    }
    const cp850 = codificarTexto('A — B – C ‘x’ “y” 1\u00a02 …', 'cp850');
    const cp1252 = codificarTexto('A — B – C ‘x’ “y” 1\u00a02 …', 'cp1252');
    const ascii = codificarTexto('A — B – C ‘x’ “y” 1\u00a02 …', 'ascii');

    expect(String.fromCharCode(...cp850)).toBe('A - B - C \'x\' "y" 1 2 ...');
    expect(String.fromCharCode(...cp1252)).toBe('A - B - C \'x\' "y" 1 2 ...');
    expect(String.fromCharCode(...ascii)).toBe('A - B - C \'x\' "y" 1 2 ...');
  });
});