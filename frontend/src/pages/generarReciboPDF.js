/**
 * generarReciboPDF.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PDF de 58 mm para impresoras térmicas — versión optimizada para 203 DPI.
 * jsPDF se carga dinámicamente para no engordar el bundle principal.
 *
 * CAMBIOS v2:
 * - Helvetica en vez de Courier (mejor legibilidad en baja resolución)
 * - Font-sizes aumentados para 203 DPI (mínimo 10pt)
 * - Todo el texto en negro puro (sin grises → sin dithering)
 * - Líneas divisorias más visibles (negro, 0.8mm)
 * - Fechas con splitTextToSize (sin overflow)
 * - infoBox simplificado sin fondos de color
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (val) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(val ?? 0);

const formatCedula = (cedula = "") => {
  const digits = cedula.replace(/\D/g, "");
  if (digits.length !== 11) return cedula;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
};

const FRECUENCIA_LABEL = {
  DIARIO:    "Diario",
  SEMANAL:   "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL:   "Mensual",
};

const METODO_LABEL = {
  EFECTIVO:      "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA:       "Tarjeta",
  CHEQUE:        "Cheque",
};

const fmtLong = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
};

const fmtShort = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(date));
};

// ─── Constantes de layout ─────────────────────────────────────────────────────

const PAGE_W   = 58;
const MARGIN   = 3;
const COL_W    = PAGE_W - MARGIN * 2;
const LINE_H   = 6;      // alto línea normal (antes 5.2)
const LINE_SM  = 5;      // alto línea pequeña (antes 4.4)
const FONT_SM  = 10;     // etiquetas (antes 8)
const FONT_NOR = 11;     // valores (antes 9)
const FONT_MED = 12;     // nombre cliente / empresa (antes 10)
const FONT_LG  = 11;     // nº recibo
const FONT_XL  = 16;     // total pagado (antes 15)

// ─── Función principal (async — import dinámico) ──────────────────────────────

export async function generarReciboPDF(data, empresa, fileName) {
  const { jsPDF } = await import("jspdf");
  const C = { jsPDF, PAGE_W, MARGIN, COL_W, LINE_H, LINE_SM, FONT_SM, FONT_NOR, FONT_MED, FONT_LG, FONT_XL };
  const { pago } = data ?? {};
  const numeroRecibo = pago?.id?.slice(-8)?.toUpperCase() ?? "--------";
  const safeFileName = (fileName ?? `recibo-${numeroRecibo}`).replace(/[^a-zA-Z0-9_-]/g, "_");
  const pdf = _buildPDF(data, empresa, C);
  pdf.save(`${safeFileName}.pdf`);
}

// ─── Builder interno ──────────────────────────────────────────────────────────

function _buildPDF(data, empresa, C) {
  const { pago, prestamo, cliente, cuota, usuario } = data ?? {};
  const { jsPDF, PAGE_W, MARGIN, COL_W, LINE_H, LINE_SM, FONT_SM, FONT_NOR, FONT_MED, FONT_LG, FONT_XL } = C;

  const numeroRecibo   = pago?.id?.slice(-8)?.toUpperCase() ?? "--------";
  const saldoRestante  = prestamo?.saldoPendiente ?? 0;
  const estaSaldado    = saldoRestante <= 0.01;
  const pagoCompleto   = pago?.pagoCompleto ?? cuota?.pagoCompleto ?? true;
  const capitalPagado  = pago?.capital      ?? 0;
  const interesPagado  = pago?.interes      ?? 0;
  const moraPagada     = pago?.mora         ?? 0;
  const abonoCapital   = pago?.abonoCapital ?? 0;
  const tieneAbono     = abonoCapital > 0 && pagoCompleto;
  const capitalDeCuota = tieneAbono
    ? Math.max(0, Math.round((capitalPagado - abonoCapital) * 100) / 100)
    : capitalPagado;

  const nombreEmpresa = typeof empresa?.nombre === "string"
    ? empresa.nombre
    : empresa?.nombre?.nombre ?? empresa?.nombreEmpresa ?? "Sistema de Prestamos";

  // ── Calcular alto dinámico ────────────────────────────────────────────────
  let yCalc = MARGIN;
  yCalc += LINE_H + LINE_H + 1 + 3.5;            // empresa + "recibo de pago" + dashedLine
  yCalc += LINE_H + LINE_SM + 1 + 3.5;           // nº recibo + fecha + dashedLine
  yCalc += LINE_SM + LINE_SM + 1 + LINE_H + 3.5; // cliente
  yCalc += LINE_SM + LINE_H * 3 + 3.5;           // prestamo (monto + frecuencia + cuotas; tasa=comentada)
  if (cuota && pagoCompleto)  yCalc += LINE_SM + LINE_H * 2 + 3.5;
  if (cuota && !pagoCompleto) yCalc += LINE_SM + LINE_H * 2 + LINE_SM * 2 + 3.5;
  yCalc += LINE_SM;
  if (capitalDeCuota > 0) yCalc += LINE_H;
  if (interesPagado   > 0) yCalc += LINE_H;
  if (moraPagada      > 0) yCalc += LINE_H;
  if (tieneAbono)           yCalc += LINE_H + LINE_SM + LINE_SM + 3;
  yCalc += LINE_H * 2;   // metodo + referencia
  yCalc += 3.5;          // solidLine
  yCalc += LINE_H + LINE_H + 2; // total pagado label + monto
  // saldo restante: COMENTADO → no suma
  if (pago?.observacion) yCalc += LINE_H * 4;
  yCalc += 3.5;          // dashedLine footer
  if (estaSaldado) yCalc += LINE_H;
  yCalc += LINE_SM + 2;           // "registrado por" + safety margin

  // ── Crear documento ───────────────────────────────────────────────────────
  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE_W, Math.ceil(yCalc)],
    orientation: "portrait",
  });

  let y = MARGIN;
  const x  = MARGIN;
  const xR = PAGE_W - MARGIN;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const text       = (str, posX, posY, opts = {}) => doc.text(String(str ?? "-"), posX, posY, opts);

  const setFont    = (style = "normal", size = FONT_NOR) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const divider = (dashed = true) => {
    if (dashed) {
      doc.setLineDashPattern([2, 1.5], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(x, y, xR, y);
    doc.setLineDashPattern([], 0);
    y += 3.5;
  };

  const row = (label, value) => {
    setFont("normal", FONT_SM);
    text(label, x, y);
    setFont("bold", FONT_NOR);
    text(String(value ?? "-"), xR, y, { align: "right" });
    y += LINE_H;
  };

  const sectionLabel = (label) => {
    setFont("bold", FONT_SM);
    text(label.toUpperCase(), x, y);
    y += LINE_SM;
  };

  const infoBox = (msg) => {
    setFont("normal", FONT_SM);
    const lines = doc.splitTextToSize(`> ${msg}`, COL_W);
    lines.forEach(line => { text(line, x, y); y += LINE_SM; });
  };

  // ── RENDERIZADO ───────────────────────────────────────────────────────────

  // Encabezado empresa
  setFont("bold", FONT_MED);
  text(nombreEmpresa, PAGE_W / 2, y, { align: "center" }); y += LINE_H;
  setFont("normal", FONT_SM);
  text("RECIBO DE PAGO", PAGE_W / 2, y, { align: "center" });
  y += LINE_H + 1;
  divider(true);

  // Nº recibo (línea propia) + fecha (línea propia debajo)
  setFont("bold", FONT_LG);
  text(`#${numeroRecibo}`, x, y); y += LINE_H;
  setFont("normal", FONT_SM);
  const dateStr = fmtLong(pago?.createdAt || pago?.fecha);
  const dateLines = doc.splitTextToSize(dateStr, COL_W);
  dateLines.forEach((line) => { text(line, x, y); y += LINE_SM; });
  y += 1;
  divider(true);

  // Cliente
  sectionLabel("Cliente");
  setFont("bold", FONT_MED);
  text(`${cliente?.nombre ?? ""} ${cliente?.apellido ?? ""}`.trim(), x, y); y += LINE_SM + 1;
  setFont("normal", FONT_SM);
  text(formatCedula(cliente?.cedula ?? ""), x, y); y += LINE_H;
  divider(true);

  // Préstamo
  sectionLabel("Prestamo");
  row("Monto original",  formatCurrency(prestamo?.monto));
  row("Frecuencia",      FRECUENCIA_LABEL[prestamo?.frecuenciaPago] ?? "-");
  row("Total cuotas",    `${prestamo?.numeroCuotas ?? "-"} cuotas`);
  // row("Tasa de interes", `${prestamo?.tasaInteres ?? "-"}%`);  // COMENTADO
  divider(true);

  // Cuota
  if (cuota && pagoCompleto) {
    sectionLabel("Cuota Pagada");
    row("Num. de cuota",   `#${cuota.numero} de ${prestamo?.numeroCuotas ?? "-"}`);
    row("Vencimiento",     fmtShort(cuota.fechaVencimiento));
    divider(true);
  } else if (cuota && !pagoCompleto) {
    sectionLabel("Cuota en Abono");
    row("Num. de cuota",   `#${cuota.numero} de ${prestamo?.numeroCuotas ?? "-"}`);
    row("Vencimiento",     fmtShort(cuota.fechaVencimiento));
    infoBox("Abono parcial - cuota con saldo pendiente.");
    divider(true);
  }

  // Detalle del pago
  sectionLabel("Detalle del Pago");
  if (capitalDeCuota > 0) row("Capital",  formatCurrency(capitalDeCuota));
  if (interesPagado   > 0) row("Interes",  formatCurrency(interesPagado));
  if (moraPagada      > 0) row("Mora",     formatCurrency(moraPagada));
  if (capitalDeCuota === 0 && interesPagado === 0 && moraPagada === 0)
    row("Aplicado", formatCurrency(pago?.montoTotal ?? 0));
  if (tieneAbono) {
    row("Abono capital", `+${formatCurrency(abonoCapital)}`);
    infoBox(`Abono de ${formatCurrency(abonoCapital)} al capital futuro.`);
  }
  row("Metodo", METODO_LABEL[pago?.metodo] ?? pago?.metodo ?? "-");
  if (pago?.referencia) row("Referencia", pago.referencia);
  divider(false); // línea sólida antes del total

  // Total pagado
  setFont("bold", FONT_SM);
  text("TOTAL PAGADO", PAGE_W / 2, y, { align: "center" }); y += LINE_H;
  setFont("bold", FONT_XL);
  text(formatCurrency(pago?.montoTotal ?? 0), PAGE_W / 2, y, { align: "center" });
  y += LINE_H + 2;

  // row("Saldo restante", ...);  // COMENTADO

  // Observación
  if (pago?.observacion) {
    divider(true); sectionLabel("Observacion");
    setFont("normal", FONT_SM);
    const lines = doc.splitTextToSize(pago.observacion, COL_W);
    lines.forEach(line => { text(line, x, y); y += LINE_SM; });
  }

  divider(true);

  // Footer
  if (estaSaldado) {
    setFont("bold", FONT_MED);
    text("Prestamo saldado!", PAGE_W / 2, y, { align: "center" }); y += LINE_H;
  }
  setFont("normal", FONT_SM);
  text(`Registrado por: ${usuario?.nombre ?? "-"}`, PAGE_W / 2, y, { align: "center" }); y += LINE_SM;
  text(`${nombreEmpresa} · ${fmtShort(new Date())}`, PAGE_W / 2, y, { align: "center" });
  // Sin margen extra — el PDF termina aquí

  return doc;
}
