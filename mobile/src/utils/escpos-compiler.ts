import type { Node, PrinterOptions } from 'react-native-thermal-printer-driver';

import {
  codificarTexto,
  esModoAscii,
  resolverIdCodePage,
  type CodigoSalida,
} from './escpos-code-pages';

const ESC = 0x1b;
const FS = 0x1c;
const GS = 0x1d;
const LF = 0x0a;

const INIT = [ESC, 0x40];
const CANCELAR_MODO_CHINO = [FS, 0x2e];
const FONT_A = [ESC, 0x4d, 0x00];
const ALINEAR_IZQ = [ESC, 0x61, 0x00];
const ALINEAR_CENTRO = [ESC, 0x61, 0x01];
const ALINEAR_DER = [ESC, 0x61, 0x02];
const NEGRITA_ON = [ESC, 0x45, 0x01];
const NEGRITA_OFF = [ESC, 0x45, 0x00];
const TAMANO_BASE = [GS, 0x21, 0x00];
const CORTE_PARCIAL = [GS, 0x56, 0x01];

const COLUMNAS_POR_ANCHO: Record<number, number> = { 58: 32, 80: 48 };

function seleccionarPagina(id: number): number[] {
  return [ESC, 0x74, id & 0xff];
}

function tamanoEscalon(escala: number): number[] {
  const n = Math.min(Math.max(escala, 1), 8);
  return [GS, 0x21, ((n - 1) << 4) | ((n - 1) & 0x0f)];
}

function alimentar(lineas: number): number[] {
  return [ESC, 0x64, Math.min(Math.max(lineas, 1), 255) & 0xff];
}

function alinear(align: 'left' | 'center' | 'right' | undefined): number[] {
  if (align === 'center') return ALINEAR_CENTRO;
  if (align === 'right') return ALINEAR_DER;
  return ALINEAR_IZQ;
}

export interface OpcionesCompilacion extends Omit<PrinterOptions, 'codePage'> {
  codePage?: CodigoSalida;
}

export function compilarDocumento(nodes: Node[], options?: OpcionesCompilacion): number[] {
  const codePage: CodigoSalida = options?.codePage ?? 'cp850';
  const ascii = esModoAscii(codePage);
  const idPagina = ascii ? undefined : resolverIdCodePage(codePage);
  const columnas = COLUMNAS_POR_ANCHO[options?.paperWidthMm ?? 58] ?? 32;

  const bytes: number[] = [...INIT, ...CANCELAR_MODO_CHINO, ...FONT_A];
  if (idPagina !== undefined) {
    bytes.push(...seleccionarPagina(idPagina));
  }

  const ayudante = {
    codificar: (contenido: string) => codificarTexto(contenido, codePage),
  };

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        compilarTexto(node, bytes, ayudante, false);
        break;
      case 'line':
        compilarLinea(node, bytes, ayudante, columnas);
        break;
      case 'columns':
        compilarColumnas(node.columns, bytes, ayudante, columnas);
        break;
      case 'feed':
        bytes.push(...alimentar(node.lines));
        break;
      case 'cut':
        bytes.push(...(node.partial === false ? [GS, 0x56, 0x00] : CORTE_PARCIAL));
        break;
      case 'raw':
        for (const byte of node.data) {
          bytes.push(byte & 0xff);
        }
        break;
      case 'spacer':
        bytes.push(...alimentar(node.lines ?? 1));
        break;
      default:
        break;
    }
  }

  return bytes;
}

function compilarTexto(
  node: Extract<Node, { type: 'text' }>,
  bytes: number[],
  ayudante: { codificar: (contenido: string) => number[] },
  esBold: boolean,
): void {
  const style = node.style ?? {};
  const align = style.align ?? 'left';
  const bold = esBold || (style.bold === true);
  const widthScale = style.widthScale ?? style.size ?? 1;
  const heightScale = style.heightScale ?? style.size ?? 1;
  const escalado = widthScale > 1 || heightScale > 1;

  if (align !== 'left') {
    bytes.push(...alinear(align));
  }
  if (bold) {
    bytes.push(...NEGRITA_ON);
  }
  if (escalado) {
    bytes.push(...tamanoEscalon(Math.max(widthScale, heightScale)));
  }

  bytes.push(...ayudante.codificar(node.content), LF);

  if (align !== 'left') {
    bytes.push(...ALINEAR_IZQ);
  }
  if (bold) {
    bytes.push(...NEGRITA_OFF);
  }
  if (escalado) {
    bytes.push(...TAMANO_BASE);
  }
}

function compilarLinea(
  node: Extract<Node, { type: 'line' }>,
  bytes: number[],
  ayudante: { codificar: (contenido: string) => number[] },
  columnas: number,
): void {
  if (node.character) {
    bytes.push(...ayudante.codificar(node.character.repeat(Math.ceil(columnas / node.character.length)).slice(0, columnas)), LF);
    return;
  }
  if (node.style === 'dashed') {
    const patron = '- ';
    const contenido = patron.repeat(Math.ceil(columnas / patron.length)).slice(0, columnas);
    bytes.push(...ayudante.codificar(contenido), LF);
    return;
  }
  bytes.push(...ayudante.codificar('-'.repeat(columnas)), LF);
}

function compilarColumnas(
  cols: Extract<Node, { type: 'columns' }>['columns'],
  bytes: number[],
  ayudante: { codificar: (contenido: string) => number[] },
  columnas: number,
): void {
  for (const col of cols) {
    const ancho = Math.max(Math.floor((col.width ?? 0) * columnas), 0);
    const contenido = (col.content ?? '').slice(0, ancho);
    const relleno = Math.max(ancho - contenido.length, 0);
    let segmento: string;
    if (col.align === 'right') {
      segmento = ' '.repeat(relleno) + contenido;
    } else if (col.align === 'center') {
      const izquierda = Math.floor(relleno / 2);
      segmento = ' '.repeat(izquierda) + contenido + ' '.repeat(relleno - izquierda);
    } else {
      segmento = contenido + ' '.repeat(relleno);
    }

    if (col.style?.bold) {
      bytes.push(...NEGRITA_ON);
    }
    bytes.push(...ayudante.codificar(segmento));
    if (col.style?.bold) {
      bytes.push(...NEGRITA_OFF);
    }
  }
  bytes.push(LF);
}