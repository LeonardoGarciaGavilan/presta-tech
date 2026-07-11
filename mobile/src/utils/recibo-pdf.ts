import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '@/store/auth.store';

const FRECUENCIA_LABEL: Record<string, string> = {
  DIARIO: 'Diario',
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CHEQUE: 'Cheque',
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'RD$ 0.00';
  return `RD$ ${new Intl.NumberFormat('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDateLong(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

function formatDateShort(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date));
}

function formatCedula(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
}

export interface ReciboData {
  pago?: {
    id: string;
    capital: number;
    interes: number;
    mora: number;
    abonoCapital: number;
    montoTotal: number;
    metodo: string;
    referencia: string | null;
    observacion: string | null;
    pagoCompleto: boolean;
    createdAt: string;
  };
  cliente?: {
    nombre: string;
    apellido: string | null;
    cedula: string;
  };
  prestamo?: {
    monto: number;
    numeroCuotas: number;
    frecuenciaPago: string;
    saldoPendiente: number;
  };
  cuota?: {
    id: string;
    numero: number;
    monto: number;
    capital: number;
    interes: number;
    mora: number;
    fechaVencimiento: string;
    pagoCompleto: boolean;
  } | null;
  usuario?: {
    nombre: string;
  };
}

export function generateReciboHtml(data: ReciboData): string {
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

  const user = useAuthStore.getState().user;
  const nombreEmpresa = user?.empresa ?? 'PrestaTech';
  const fechaActual = formatDateShort(new Date().toISOString());

  const style = `
    @page { margin: 0; size: 58mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      width: 58mm;
      max-width: 58mm;
      font-size: 14px;
      line-height: 1.3;
      color: #000;
      padding: 12px 8px;
    }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .uppercase { text-transform: uppercase; }
    .divider-dashed {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .divider-solid {
      border-top: 1.5px solid #000;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .label {
      font-size: 13px;
      color: #000;
    }
    .value {
      font-weight: 700;
      font-size: 14px;
      text-align: right;
      color: #000;
    }
    .section-title {
      font-size: 13px;
      text-transform: uppercase;
      margin-bottom: 6px;
      color: #000;
    }
    .info-box {
      border: 1px solid #000;
      border-radius: 3px;
      padding: 4px 6px;
      margin: 4px 0;
      font-size: 13px;
      color: #000;
    }
    .total-label {
      font-size: 13px;
      text-transform: uppercase;
      margin: 0 0 3px;
    }
    .total-value {
      font-size: 20px;
      font-weight: 800;
      margin: 0;
    }
    .empresa-name {
      font-size: 16px;
      font-weight: 800;
      margin: 0 0 2px;
    }
    .recibo-subtitle {
      font-size: 13px;
      text-transform: uppercase;
      margin: 0;
    }
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=58mm">
  <title>Recibo #${numeroRecibo}</title>
  <style>${style}</style>
</head>
<body>
  <!-- Encabezado -->
  <div class="center" style="margin-bottom: 8px;">
    <p class="empresa-name">${nombreEmpresa}</p>
    <p class="recibo-subtitle">Recibo de Pago</p>
  </div>

  <div class="divider-dashed"></div>

  <!-- Nº recibo + fecha -->
  <p style="font-size: 13px; text-transform: uppercase; margin-bottom: 2px;">Recibo Nº</p>
  <p style="font-size: 15px; font-weight: 800; margin: 0 0 3px;">#${numeroRecibo}</p>
  <p style="font-size: 14px; margin-bottom: 4px;">${formatDateLong(pago?.createdAt)}</p>

  <div class="divider-dashed"></div>

  <!-- Cliente -->
  <p class="section-title">Cliente</p>
  <p style="font-size: 16px; font-weight: 700; margin-bottom: 2px;">
    ${cliente?.nombre ?? ''} ${cliente?.apellido ?? ''}
  </p>
  <p style="font-size: 14px; margin-bottom: 0;">
    ${formatCedula(cliente?.cedula ?? '')}
  </p>

  <div class="divider-dashed"></div>

  <!-- Préstamo -->
  <p class="section-title">Préstamo</p>
  <div class="row">
    <span class="label">Monto original</span>
    <span class="value">${formatCurrency(prestamo?.monto)}</span>
  </div>
  <div class="row">
    <span class="label">Frecuencia</span>
    <span class="value">${FRECUENCIA_LABEL[prestamo?.frecuenciaPago ?? ''] || '—'}</span>
  </div>
  <div class="row">
    <span class="label">Total cuotas</span>
    <span class="value">${prestamo?.numeroCuotas ?? '—'} cuotas</span>
  </div>

  <div class="divider-dashed"></div>

  <!-- Cuota pagada -->
  ${cuota && pagoCompleto ? `
    <p class="section-title">Cuota Pagada</p>
    <div class="row">
      <span class="label">Número de cuota</span>
      <span class="value">#${cuota.numero} de ${prestamo?.numeroCuotas ?? '—'}</span>
    </div>
    <div class="row">
      <span class="label">Fecha vencimiento</span>
      <span class="value">${formatDateShort(cuota.fechaVencimiento)}</span>
    </div>
    <div class="divider-dashed"></div>
  ` : ''}

  <!-- Cuota en abono -->
  ${cuota && !pagoCompleto ? `
    <p class="section-title">Cuota en Abono</p>
    <div class="row">
      <span class="label">Número de cuota</span>
      <span class="value">#${cuota.numero} de ${prestamo?.numeroCuotas ?? '—'}</span>
    </div>
    <div class="row">
      <span class="label">Fecha vencimiento</span>
      <span class="value">${formatDateShort(cuota.fechaVencimiento)}</span>
    </div>
    <div class="info-box">≫ Abono parcial — la cuota aún tiene saldo pendiente.</div>
    <div class="divider-dashed"></div>
  ` : ''}

  <!-- Detalle del pago -->
  <p class="section-title">Detalle del Pago</p>
  ${capitalDeCuota > 0 ? `
    <div class="row">
      <span class="label">Capital</span>
      <span class="value">${formatCurrency(capitalDeCuota)}</span>
    </div>
  ` : ''}
  ${interesPagado > 0 ? `
    <div class="row">
      <span class="label">Interés</span>
      <span class="value">${formatCurrency(interesPagado)}</span>
    </div>
  ` : ''}
  ${moraPagada > 0 ? `
    <div class="row">
      <span class="label">Mora</span>
      <span class="value">${formatCurrency(moraPagada)}</span>
    </div>
  ` : ''}
  ${capitalDeCuota === 0 && interesPagado === 0 && moraPagada === 0 ? `
    <div class="row">
      <span class="label">Aplicado</span>
      <span class="value">${formatCurrency(pago?.montoTotal ?? 0)}</span>
    </div>
  ` : ''}
  ${tieneAbono ? `
    <div class="row">
      <span class="label">Abono a capital</span>
      <span class="value">+ ${formatCurrency(abonoCapital)}</span>
    </div>
    <div class="info-box">≫ Abono de ${formatCurrency(abonoCapital)} al capital de próximas cuotas.</div>
  ` : ''}
  <div class="row">
    <span class="label">Método</span>
    <span class="value">${METODO_LABEL[pago?.metodo ?? ''] || pago?.metodo || '—'}</span>
  </div>
  ${pago?.referencia ? `
    <div class="row">
      <span class="label">Referencia</span>
      <span class="value">${pago.referencia}</span>
    </div>
  ` : ''}

  <div class="divider-solid"></div>

  <!-- Total pagado -->
  <div class="center" style="margin: 8px 0 6px;">
    <p class="total-label">Total Pagado</p>
    <p class="total-value">${formatCurrency(pago?.montoTotal ?? 0)}</p>
  </div>

  <!-- Observación -->
  ${pago?.observacion ? `
    <div class="divider-dashed"></div>
    <p class="section-title">Observación</p>
    <p style="font-size: 14px;">${pago.observacion}</p>
  ` : ''}

  <div class="divider-dashed"></div>

  <!-- Footer -->
  <div class="center">
    ${estaSaldado ? `
      <p style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">
        ¡Préstamo completamente pagado!
      </p>
    ` : ''}
    <p style="font-size: 14px;">
      Registrado por: ${usuario?.nombre ?? '—'}
    </p>
    <p style="font-size: 14px; margin-top: 2px;">
      ${nombreEmpresa} · ${fechaActual}
    </p>
  </div>
</body>
</html>`;
}

function calculateHeightPx(data: ReciboData): number {
  const mmToPx = (mm: number) => Math.ceil(mm * 72 / 25.4);

  const MARGIN   = 3;
  const LINE_H   = 6;
  const LINE_SM  = 5;
  const GAP_1    = 1;
  const DIVIDER  = 3.5;
  const GAP_2    = 2;
  const GAP_3    = 3;

  const { pago, prestamo, cuota } = data;
  const pagoCompleto = pago?.pagoCompleto ?? cuota?.pagoCompleto ?? true;
  const capitalPagado = pago?.capital ?? 0;
  const interesPagado = pago?.interes ?? 0;
  const moraPagada = pago?.mora ?? 0;
  const abonoCapital = pago?.abonoCapital ?? 0;
  const tieneAbono = abonoCapital > 0 && pagoCompleto;
  const capitalDeCuota = tieneAbono
    ? Math.max(0, Math.round((capitalPagado - abonoCapital) * 100) / 100)
    : capitalPagado;
  const estaSaldado = (prestamo?.saldoPendiente ?? 0) <= 0.01;

  let h = MARGIN;
  h += LINE_H + LINE_H + GAP_1 + DIVIDER;
  h += LINE_H + LINE_SM + GAP_1 + DIVIDER;
  h += LINE_SM + LINE_SM + GAP_1 + LINE_H + DIVIDER;
  h += LINE_SM + LINE_H * 3 + DIVIDER;

  if (cuota && pagoCompleto) h += LINE_SM + LINE_H * 2 + DIVIDER;
  if (cuota && !pagoCompleto) h += LINE_SM + LINE_H * 2 + LINE_SM * 2 + DIVIDER;

  h += LINE_SM;
  if (capitalDeCuota > 0) h += LINE_H;
  if (interesPagado > 0) h += LINE_H;
  if (moraPagada > 0) h += LINE_H;
  if (capitalDeCuota === 0 && interesPagado === 0 && moraPagada === 0) h += LINE_H;
  if (tieneAbono) h += LINE_H + LINE_SM + LINE_SM + GAP_3;
  h += LINE_H * 2;

  h += DIVIDER;
  h += LINE_H + LINE_H + GAP_2;

  if (pago?.observacion) h += LINE_H * 4;

  h += DIVIDER;
  if (estaSaldado) h += LINE_H;
  h += LINE_SM + GAP_2;

  h += 25; // buffer CSS (padding, margin, line-height del HTML)

  return mmToPx(h);
}

export async function guardarReciboPDF(data: ReciboData): Promise<string> {
  const html = generateReciboHtml(data);
  const { uri } = await Print.printToFileAsync({
    html,
    width: 165,
    height: calculateHeightPx(data),
    margins: { left: 0, right: 0, top: 0, bottom: 0 },
  });
  const numero = data.pago?.id?.slice(-8)?.toUpperCase() ?? 'pago';
  const fileName = `recibo_${numero}.pdf`;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Guardar recibo',
    });
  }
  return uri;
}
