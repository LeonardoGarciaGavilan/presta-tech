import type { CodePage } from 'react-native-thermal-printer-driver';

export type CodePageName = 'cp437' | 'cp850' | 'cp858' | 'cp1252';
export type CodigoSalida = CodePage | 'ascii';

const SIMBOLOS_COMUNES: Record<string, number> = {
  '¿': 0xa8,
  '¡': 0xad,
  '«': 0xae,
  '»': 0xaf,
  '°': 0xf8,
  '·': 0xfa,
  '¹': 0xfb,
  '³': 0xfc,
  '½': 0xab,
  '¼': 0xac,
  '¢': 0x9b,
  '£': 0x9c,
  '¥': 0x9d,
  '¤': 0xcf,
  '©': 0xb8,
  'µ': 0xe6,
  'ß': 0xe1,
  '÷': 0xf7,
  'ÿ': 0x98,
  'Ç': 0x80,
  'ç': 0x87,
  'â': 0x83,
  'ä': 0x84,
  'à': 0x85,
  'å': 0x86,
  'ê': 0x88,
  'ë': 0x89,
  'è': 0x8a,
  'ï': 0x8b,
  'î': 0x8c,
  'ì': 0x8d,
  'ô': 0x93,
  'ö': 0x94,
  'ò': 0x95,
  'û': 0x96,
  'ù': 0x97,
  'ã': 0xc6,
  'õ': 0xe4,
  'Ä': 0x8e,
  'Å': 0x8f,
  'Ö': 0x99,
  'Ü': 0x9a,
  'Â': 0xb6,
  'À': 0xb7,
  'Ê': 0xd2,
  'Ë': 0xd3,
  'È': 0xd4,
  'Î': 0xd7,
  'Ï': 0xd8,
  'Ã': 0xc7,
  'Õ': 0xe5,
  'Ô': 0xe2,
  'Ò': 0xe3,
  'Û': 0xea,
  'Ù': 0xeb,
  'Ý': 0xed,
  'ý': 0xec,
};

const ESPANOL: Record<string, number> = {
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
};

const CP1252_ESPANOL: Record<string, number> = {
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
};

const CP1252: Record<string, number> = {
  ...CP1252_ESPANOL,
  À: 0xc0,
  Â: 0xc2,
  Ã: 0xc3,
  Ä: 0xc4,
  Å: 0xc5,
  Æ: 0xc6,
  Ç: 0xc7,
  È: 0xc8,
  Ê: 0xca,
  Ë: 0xcb,
  Ì: 0xcc,
  Î: 0xce,
  Ï: 0xcf,
  Ð: 0xd0,
  Ò: 0xd2,
  Ô: 0xd4,
  Õ: 0xd5,
  Ö: 0xd6,
  Ø: 0xd8,
  Ù: 0xd9,
  Û: 0xdb,
  Ý: 0xdd,
  Þ: 0xde,
  à: 0xe0,
  â: 0xe2,
  ã: 0xe3,
  ä: 0xe4,
  å: 0xe5,
  æ: 0xe6,
  ç: 0xe7,
  è: 0xe8,
  ê: 0xea,
  ë: 0xeb,
  ì: 0xec,
  î: 0xee,
  ï: 0xef,
  ð: 0xf0,
  ò: 0xf2,
  ô: 0xf4,
  õ: 0xf5,
  ö: 0xf6,
  ø: 0xf8,
  ù: 0xf9,
  û: 0xfb,
  ý: 0xfd,
  þ: 0xfe,
  ÿ: 0xff,
  '¿': 0xbf,
  '¡': 0xa1,
  '«': 0xab,
  '»': 0xbb,
  '°': 0xb0,
  '·': 0xb7,
  '¹': 0xb9,
  '²': 0xb2,
  '³': 0xb3,
  '½': 0xbd,
  '¼': 0xbc,
  '¾': 0xbe,
  '¢': 0xa2,
  '£': 0xa3,
  '¥': 0xa5,
  '¤': 0xa4,
  'µ': 0xb5,
  '§': 0xa7,
  '©': 0xa9,
  '®': 0xae,
  '±': 0xb1,
  '÷': 0xf7,
  '×': 0xd7,
  '€': 0x80,
  'ß': 0xdf,
};

const TABLAS: Record<CodePageName, Record<string, number>> = {
  cp437: { ...ESPANOL, ...SIMBOLOS_COMUNES },
  cp850: { ...ESPANOL, ...SIMBOLOS_COMUNES },
  cp858: { ...ESPANOL, ...SIMBOLOS_COMUNES, '€': 0xd5 },
  cp1252: CP1252,
};

export function resolverIdCodePage(codePage: CodigoSalida | undefined): number | undefined {
  if (typeof codePage === 'number') return codePage;
  switch (codePage) {
    case 'cp437':
      return 0x00;
    case 'cp850':
      return 0x02;
    case 'cp858':
      return 0x0d;
    case 'cp1252':
      return 0x10;
    default:
      return undefined;
  }
}

export function resolverNombreTabla(codePage: CodigoSalida | undefined): CodePageName {
  if (codePage === 'cp437' || codePage === 'cp850' || codePage === 'cp858' || codePage === 'cp1252') {
    return codePage;
  }
  return 'cp850';
}

export function esModoAscii(codePage: CodigoSalida | undefined): boolean {
  return codePage === 'ascii';
}

const TRANSCRIPCION_ASCII: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ñ: 'n',
  ü: 'u',
  Á: 'A',
  É: 'E',
  Í: 'I',
  Ó: 'O',
  Ú: 'U',
  Ñ: 'N',
  Ü: 'U',
  à: 'a',
  è: 'e',
  ì: 'i',
  ò: 'o',
  ù: 'u',
  â: 'a',
  ê: 'e',
  î: 'i',
  ô: 'o',
  û: 'u',
  ä: 'a',
  ë: 'e',
  ï: 'i',
  ö: 'o',
  À: 'A',
  È: 'E',
  Ì: 'I',
  Ò: 'O',
  Ù: 'U',
  Â: 'A',
  Ê: 'E',
  Î: 'I',
  Ô: 'O',
  Û: 'U',
  Ä: 'A',
  Ë: 'E',
  Ï: 'I',
  Ö: 'O',
  ç: 'c',
  Ç: 'C',
  ã: 'a',
  Ã: 'A',
  õ: 'o',
  Õ: 'O',
  '¿': '?',
  '¡': '!',
  '«': '<',
  '»': '>',
  '·': '-',
  '°': 'o',
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '¢': 'c',
  '£': 'L',
  '¥': 'Y',
  '€': 'E',
  '§': 'S',
  'µ': 'u',
  'ß': 'ss',
  '±': '+',
  '×': 'x',
  '÷': '/',
  '–': '-',
  '—': '-',
};

const NORMALIZACION: Record<string, string> = {
  '\u00a0': ' ',
  '–': '-',
  '—': '-',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '−': '-',
  '‘': "'",
  '’': "'",
  '‚': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '…': '...',
  '•': '-',
};

function normalizarTexto(texto: string): string {
  let resultado = texto.normalize('NFC');
  for (const [origen, destino] of Object.entries(NORMALIZACION)) {
    if (resultado.includes(origen)) {
      resultado = resultado.split(origen).join(destino);
    }
  }
  return resultado;
}

function transcribirAscii(texto: string): number[] {
  const bytes: number[] = [];
  for (const ch of texto) {
    if (ch.codePointAt(0)! < 0x80) {
      bytes.push(ch.codePointAt(0)!);
      continue;
    }
    const reemplazo = TRANSCRIPCION_ASCII[ch];
    if (reemplazo !== undefined) {
      for (const c of reemplazo) {
        bytes.push(c.charCodeAt(0));
      }
    } else {
      bytes.push(0x3f);
    }
  }
  return bytes;
}

export function codificarTexto(texto: string, codePage: CodigoSalida = 'cp850'): number[] {
  const normalizado = normalizarTexto(texto);
  if (esModoAscii(codePage)) {
    return transcribirAscii(normalizado);
  }
  const tabla = TABLAS[resolverNombreTabla(codePage)];
  const bytes: number[] = [];
  for (const ch of normalizado) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) {
      bytes.push(cp);
      continue;
    }
    const byte = tabla[ch];
    bytes.push(byte === undefined ? 0x3f : byte);
  }
  return bytes;
}