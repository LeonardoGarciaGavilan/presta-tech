import type { Node } from 'react-native-thermal-printer-driver';

import { formatCedula, formatCurrency } from '@/utils/formatters';
import { METODO_PAGO_LABELS } from '@/constants/pagos.constants';
import { useAuthStore } from '@/store/auth.store';
import type { DesembolsoReciboData, ReciboData, RetiroReciboData } from '@/utils/recibo-pdf';

export const ANCHO_PAPEL_MM = 58;
export const CARACTERES_POR_LINEA = 32;

const FRECUENCIA_LABEL: Record<string, string> = {
  DIARIO: 'Diario',
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

function formatDateLong(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
    .format(new Date(date))
    .replace(/\u00a0/g, ' ');
}

function formatDateShort(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date));
}

function title(content: string): Node {
  return { type: 'text', content: content.toUpperCase(), style: { bold: true } };
}

function divider(style: 'solid' | 'dashed' = 'dashed'): Node {
  return { type: 'line', style };
}

function fila(label: string, value: string): Node {
  const valueWidth = Math.max(8, Math.min(CARACTERES_POR_LINEA - label.length - 1, 16));
  const labelWidth = CARACTERES_POR_LINEA - valueWidth - 1;
  return {
    type: 'columns',
    columns: [
      { content: label, width: labelWidth / CARACTERES_POR_LINEA, align: 'left' },
      { content: value, width: valueWidth / CARACTERES_POR_LINEA, align: 'right', style: { bold: true } },
    ],
  };
}

function headerCentrado(content: string, bold = true, size: 1 | 2 = 1): Node {
  return { type: 'text', content, style: { align: 'center', bold, size } };
}

export function buildReciboDocument(data: ReciboData): Node[] {
  const { pago, prestamo, cliente, cuota, usuario } = data;

  const numeroRecibo = pago?.id?.slice(-8)?.toUpperCase() ?? '—';
  const saldoRestante = prestamo?.saldoPendiente ?? 0;
  const estaSaldado = saldoRestante <= 0.01;
  const pagoCompleto = pago?.pagoCompleto ?? cuota?.pagoCompleto ?? true;
  const capitalPagado = pago?.capital ?? 0;
  const interesPagado = pago?.interes ?? 0;
  const moraPagada = pago?.mora ?? 0;
  const abonoCapital = pago?.abonoCapital ?? 0;
  const tieneAbono = abonoCapital > 0 && pagoCompleto;
  const capitalDeCuota = tieneAbono
    ? Math.max(0, Math.round((capitalPagado - abonoCapital) * 100) / 100)
    : capitalPagado;

  const { nombreEmpresa, fechaActual, totalPagado } = obtenerDatosRecibo(data);
  const numeroCuotas = prestamo?.numeroCuotas ?? '—';
  const totalPagadoLargo = totalPagado.length > 15;

  const nodes: Node[] = [
    headerCentrado(nombreEmpresa, true, nombreEmpresa.length > 15 ? 1 : 2),
    headerCentrado('Recibo de Pago', true),
    divider(),
    { type: 'text', content: 'Recibo N°', style: { bold: true } },
    { type: 'text', content: `#${numeroRecibo}`, style: { bold: true } },
    { type: 'text', content: formatDateLong(pago?.createdAt) },
    divider(),
    title('Cliente'),
    { type: 'text', content: [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ').trim(), style: { bold: true } },
    { type: 'text', content: formatCedula(cliente?.cedula ?? '') },
    divider(),
    title('Préstamo'),
    fila('Monto original', formatCurrency(prestamo?.monto)),
    fila('Frecuencia', FRECUENCIA_LABEL[prestamo?.frecuenciaPago ?? ''] || '—'),
    fila('Total cuotas', `${numeroCuotas} cuotas`),
  ];

  if (cuota && pagoCompleto) {
    nodes.push(
      divider(),
      title('Cuota Pagada'),
      fila('Cuota', `#${cuota.numero} de ${numeroCuotas}`),
      fila('Vencimiento', formatDateShort(cuota.fechaVencimiento)),
    );
  }

  if (cuota && !pagoCompleto) {
    nodes.push(
      divider(),
      title('Cuota en Abono'),
      fila('Cuota', `#${cuota.numero} de ${numeroCuotas}`),
      fila('Vencimiento', formatDateShort(cuota.fechaVencimiento)),
      headerCentrado('Abono parcial — la cuota aun tiene saldo', false),
    );
  }

  nodes.push(
    divider(),
    title('Detalle del Pago'),
  );

  if (capitalDeCuota > 0) nodes.push(fila('Capital', formatCurrency(capitalDeCuota)));
  if (interesPagado > 0) nodes.push(fila('Interés', formatCurrency(interesPagado)));
  if (moraPagada > 0) nodes.push(fila('Mora', formatCurrency(moraPagada)));
  if (capitalDeCuota === 0 && interesPagado === 0 && moraPagada === 0) {
    nodes.push(fila('Aplicado', formatCurrency(pago?.montoTotal ?? 0)));
  }
  if (tieneAbono) {
    nodes.push(fila('Abono a capital', `+ ${formatCurrency(abonoCapital)}`));
    nodes.push(headerCentrado(`Abono de ${formatCurrency(abonoCapital)} al capital de próximas cuotas.`, false));
  }
  nodes.push(fila('Método', METODO_PAGO_LABELS[pago?.metodo ?? ''] || pago?.metodo || '—'));
  if (pago?.referencia) nodes.push(fila('Referencia', pago.referencia));

  nodes.push(
    divider('solid'),
    headerCentrado('Total Pagado'),
    headerCentrado(totalPagado, true, totalPagadoLargo ? 1 : 2),
  );

  if (pago?.observacion) {
    nodes.push(
      divider(),
      title('Observación'),
      { type: 'text', content: pago.observacion },
    );
  }

  nodes.push(divider());

  if (estaSaldado) {
    nodes.push(headerCentrado('¡Préstamo completamente pagado!', true));
  }
  nodes.push(headerCentrado(`Registrado por: ${usuario?.nombre ?? '—'}`, false));
  nodes.push(headerCentrado(`${nombreEmpresa} · ${fechaActual}`, false));

  nodes.push({ type: 'feed', lines: 3 });
  nodes.push({ type: 'cut', partial: true });

  return nodes;
}

function obtenerCabecera(): { nombreEmpresa: string; fechaActual: string } {
  const user = useAuthStore.getState().user;
  return {
    nombreEmpresa: user?.empresa ?? 'PrestaTech',
    fechaActual: new Intl.DateTimeFormat('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date()),
  };
}

export function buildReciboDesembolso(data: DesembolsoReciboData): Node[] {
  const { desembolso, cliente, usuario } = data;
  const { nombreEmpresa, fechaActual } = obtenerCabecera();
  const numero = desembolso?.id?.slice(-8)?.toUpperCase() ?? '—';
  const monto = formatCurrency(desembolso?.monto ?? 0);
  const frecuencia = FRECUENCIA_LABEL[desembolso?.frecuenciaPago ?? ''] || desembolso?.frecuenciaPago || '—';
  const tasa = (desembolso?.tasaInteres ?? 0) > 0 ? `${desembolso?.tasaInteres}% ${frecuencia}` : 'Cuota fija';

  const nodes: Node[] = [
    headerCentrado(nombreEmpresa, true, nombreEmpresa.length > 15 ? 1 : 2),
    headerCentrado('Recibo de Desembolso', true),
    divider(),
    { type: 'text', content: 'Desembolso N°', style: { bold: true } },
    { type: 'text', content: `#${numero}`, style: { bold: true, size: 2 } },
    { type: 'text', content: formatDateLong(desembolso?.createdAt) },
    divider(),
    title('Cliente'),
    { type: 'text', content: [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ').trim(), style: { bold: true } },
    { type: 'text', content: formatCedula(cliente?.cedula ?? '') },
    divider(),
    title('Préstamo'),
    fila('Cuotas', `${desembolso?.numeroCuotas ?? '—'} cuotas`),
    fila('Frecuencia', frecuencia),
    fila('Tasa', tasa),
    divider('solid'),
    headerCentrado('Total Desembolsado'),
    headerCentrado(monto, true, monto.length > 15 ? 1 : 2),
    divider(),
    headerCentrado(`Registrado por: ${usuario?.nombre ?? '—'}`, false),
    headerCentrado(`${nombreEmpresa} · ${fechaActual}`, false),
    { type: 'feed', lines: 3 },
    { type: 'cut', partial: true },
  ];
  return nodes;
}

export function buildReciboRetiro(data: RetiroReciboData): Node[] {
  const { retiro, usuario } = data;
  const { nombreEmpresa, fechaActual } = obtenerCabecera();
  const monto = formatCurrency(retiro?.monto ?? 0);
  const tipo = retiro?.tipo || 'Retiro';

  const nodes: Node[] = [
    headerCentrado(nombreEmpresa, true, nombreEmpresa.length > 15 ? 1 : 2),
    headerCentrado('Recibo de Retiro', true),
    divider(),
    title(tipo),
    { type: 'text', content: formatDateLong(retiro?.createdAt) },
  ];

  if (retiro?.id) {
    nodes.push(fila('Retiro N°', `#${retiro.id.slice(-8).toUpperCase()}`));
  }

  nodes.push(
    divider('solid'),
    headerCentrado('Monto Retirado'),
    headerCentrado(monto, true, monto.length > 15 ? 1 : 2),
  );

  if (retiro?.concepto) {
    nodes.push(
      divider(),
      title('Concepto'),
      { type: 'text', content: retiro.concepto },
    );
  }

  nodes.push(
    divider(),
    headerCentrado(`Registrado por: ${usuario?.nombre ?? '—'}`, false),
    headerCentrado(`${nombreEmpresa} · ${fechaActual}`, false),
    { type: 'feed', lines: 3 },
    { type: 'cut', partial: true },
  );

  return nodes;
}

function obtenerDatosRecibo(data: ReciboData): {
  nombreEmpresa: string;
  fechaActual: string;
  totalPagado: string;
} {
  const user = useAuthStore.getState().user;
  const nombreEmpresa = user?.empresa ?? 'PrestaTech';
  const fechaActual = new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
  const totalPagado = formatCurrency(data.pago?.montoTotal ?? 0);
  return { nombreEmpresa, fechaActual, totalPagado };
}

export function renderNodes(nodes: Node[]): string[] {
  const lines: string[] = [];
  const fillRow = (columns: { content: string; width: number; align?: 'left' | 'center' | 'right' }[]) => {
    let row = '';
    for (const col of columns) {
      const width = Math.floor(col.width * CARACTERES_POR_LINEA);
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

  for (const node of nodes) {
    if (node.type === 'text') {
      lines.push(node.content);
    } else if (node.type === 'line') {
      lines.push(node.style === 'dashed' ? '- - - - - - - - - - - - - - - -'.slice(0, CARACTERES_POR_LINEA) : '-'.repeat(CARACTERES_POR_LINEA));
    } else if (node.type === 'columns') {
      fillRow(node.columns);
    } else if (node.type === 'feed') {
      for (let i = 0; i < node.lines; i++) lines.push('');
    } else if (node.type === 'cut') {
      lines.push('──── ✂ CORTE ────');
    } else if (node.type === 'raw') {
      lines.push(`[raw ${node.data.length} bytes]`);
    } else if (node.type === 'qr') {
      lines.push(`[QR: ${node.content}]`);
    } else if (node.type === 'barcode') {
      lines.push(`[${node.format}: ${node.content}]`);
    } else if (node.type === 'image') {
      lines.push('[imagen]');
    } else if (node.type === 'table') {
      node.table.rows.forEach((row) => lines.push(row.join(' | ')));
    } else if (node.type === 'spacer') {
      for (let i = 0; i < (node.lines ?? 1); i++) lines.push('');
    }
  }
  return lines;
}