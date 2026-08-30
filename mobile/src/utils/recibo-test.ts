import type { Node } from 'react-native-thermal-printer-driver';

export const ANCHO_PAPEL_MM = 58;

export function buildDocumentoPrueba(): Node[] {
  return [
    {
      type: 'text',
      content: 'PRESTATECH',
      style: { align: 'center', bold: true, size: 2 },
    },
    { type: 'text', content: 'Prueba de impresora', style: { align: 'center', bold: true } },
    { type: 'text', content: '58mm / 32 caracteres', style: { align: 'center' } },
    { type: 'text', content: 'Bluetooth Classic SPP', style: { align: 'center' } },
    { type: 'line' },
    { type: 'text', content: 'Acentos y enie:', style: { bold: true } },
    { type: 'text', content: 'sin acentos: a e i o u n u' },
    { type: 'text', content: 'con acentos: á é í ó ú ñ ü' },
    { type: 'text', content: 'MAYUSCULAS  : Á É Í Ó Ú Ñ Ü' },
    { type: 'text', content: 'Nombres: Pérez, Martínez, Sánchez, Ñúñez' },
    { type: 'text', content: 'simbolos: Recibo N° 3 · saldo °C' },
    { type: 'text', content: 'solo ascii: a e i o u n u', style: { align: 'center' } },
    { type: 'line', style: 'dashed' },
    {
      type: 'text',
      content:
        'A lineal izquierda que debe alcanzar exactamente los 32 caracteres por linea y el hardware la corta sola.',
    },
    { type: 'text', content: 'Centrado', style: { align: 'center' } },
    { type: 'text', content: 'Derecha', style: { align: 'right' } },
    { type: 'line', style: 'dashed' },
    { type: 'text', content: 'Columnas', style: { bold: true } },
    {
      type: 'columns',
      columns: [
        { content: 'Cant', width: 0.15, align: 'left', style: { bold: true } },
        { content: 'Descripcion', width: 0.55, align: 'left', style: { bold: true } },
        { content: 'Total', width: 0.3, align: 'right', style: { bold: true } },
      ],
    },
    {
      type: 'columns',
      columns: [
        { content: '1', width: 0.15, align: 'left' },
        { content: 'Cuota', width: 0.55, align: 'left' },
        { content: '100.00', width: 0.3, align: 'right' },
      ],
    },
    {
      type: 'columns',
      columns: [
        { content: '2', width: 0.15, align: 'left' },
        { content: 'Mora', width: 0.55, align: 'left' },
        { content: '25.50', width: 0.3, align: 'right' },
      ],
    },
    { type: 'line' },
    { type: 'text', content: 'Total S/ 125.50', style: { align: 'right', bold: true } },
    { type: 'feed', lines: 3 },
    { type: 'cut', partial: true },
  ];
}

export function vistaPreviaDocumentoPrueba(): string[] {
  const lines: string[] = [];
  const fillRow = (columns: { content: string; width: number; align?: 'left' | 'center' | 'right' }[]) => {
    let row = '';
    for (const col of columns) {
      const width = Math.floor(col.width * ANCHO_PAPEL_MM);
      const content = col.content.slice(0, width);
      const padding = width - content.length;
      if (col.align === 'right') {
        row += ' '.repeat(padding) + content;
      } else if (col.align === 'center') {
        const left = Math.floor(padding / 2);
        row += ' '.repeat(left) + content + ' '.repeat(padding - left);
      } else {
        row += content + ' '.repeat(padding);
      }
    }
    lines.push(row);
  };

  for (const node of buildDocumentoPrueba()) {
    if (node.type === 'text') {
      lines.push(node.content);
    } else if (node.type === 'line') {
      lines.push(node.style === 'dashed' ? '- - - - - - - - - - - - - - - -'.slice(0, ANCHO_PAPEL_MM) : '-'.repeat(ANCHO_PAPEL_MM));
    } else if (node.type === 'columns') {
      fillRow(node.columns);
    } else if (node.type === 'feed') {
      for (let i = 0; i < node.lines; i++) lines.push('');
    } else if (node.type === 'cut') {
      lines.push('──── ✂ CORTE ────');
    }
  }
  return lines;
}