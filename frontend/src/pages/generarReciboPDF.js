/**
 * generarReciboPDF.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera un PDF de 58 mm optimizado para impresoras térmicas portátiles
 * (JacLink JACL-P210 y similares) usando jsPDF.
 *
 * INSTALACIÓN:
 *   npm install jspdf
 *   # o con yarn:
 *   yarn add jspdf
 *
 * IMPORTANTE: jsPDF carga fuentes en base64 internamente, no necesita
 * conexión a internet en tiempo de ejecución.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { jsPDF } from "jspdf";

// ─── Helpers (copiados de prestamosUtils para no crear dependencia circular) ──

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
  DIARIO: "Diario",
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
};

const METODO_LABEL = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CHEQUE: "Cheque",
};

const fmtLong = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
};

const fmtShort = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(date));
};

// ─── Constantes de layout ─────────────────────────────────────────────────────

const PAGE_W    = 58;
const MARGIN    = 3;
const COL_W     = PAGE_W - MARGIN * 2;
const LINE_H    = 5.0;   // era 4.2 — más espacio entre líneas
const LINE_SM   = 4.2;   // era 3.6
const FONT_SM   = 7.5;   // era 6   — el más crítico: etiquetas antes ilegibles
const FONT_NOR  = 8.5;   // era 7
const FONT_MED  = 10;    // era 8
const FONT_LG   = 12;    // era 10
const FONT_XL   = 16;    // era 14  — total pagado

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * @param {Object} data      - { pago, prestamo, cliente, cuota, usuario }
 * @param {Object} empresa   - { nombre }
 * @param {string} [fileName] - nombre del archivo descargado (sin extensión)
 */
export function generarReciboPDF(data, empresa, fileName) {
  const { pago, prestamo, cliente, cuota, usuario } = data ?? {};

  // ── Datos derivados ───────────────────────────────────────────────────────
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
    : empresa?.nombre?.nombre ?? empresa?.nombreEmpresa ?? "Sistema de Préstamos";

  // ── Crear documento con alto dinámico (auto-calculado al final) ───────────
  // Usamos un alto grande provisorio; jsPDF permite ajustarlo después.
  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE_W, 400], // alto provisorio; se recortará
    orientation: "portrait",
  });

  let y = MARGIN; // cursor vertical

  // ─── Helpers de dibujo ────────────────────────────────────────────────────

  const x  = MARGIN;
  const xR = PAGE_W - MARGIN; // borde derecho

  const text = (str, posX, posY, opts = {}) => {
    doc.text(String(str ?? "—"), posX, posY, opts);
  };

  const setFont = (style = "normal", size = FONT_NOR) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const setColor = (hex) => {
    // hex: "#rrggbb" o nombre CSS simple
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setTextColor(r, g, b);
  };

  const resetColor = () => doc.setTextColor(0, 0, 0);

  const dashedLine = () => {
    doc.setLineDashPattern([1.5, 1], 0);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(x, y, xR, y);
    doc.setLineDashPattern([], 0);
    y += 2.5;
  };

  const solidLine = () => {
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(x, y, xR, y);
    y += 2.5;
  };

  /** Fila izquierda / derecha */
  const row = (label, value, colorValue = "#0f172a") => {
    setFont("normal", FONT_SM);
    setColor("#64748b");
    text(label, x, y);

    setFont("bold", FONT_NOR);
    setColor(colorValue);
    text(String(value ?? "—"), xR, y, { align: "right" });
    resetColor();

    y += LINE_H;
  };

  /** Etiqueta de sección */
  const sectionLabel = (label) => {
    setFont("bold", FONT_SM);
    setColor("#94a3b8");
    text(label.toUpperCase(), x, y);
    resetColor();
    y += LINE_SM;
  };

  /** Caja coloreada de alerta */
  const infoBox = (msg, bgHex, textHex) => {
    const [r, g, b] = [bgHex.slice(1,3), bgHex.slice(3,5), bgHex.slice(5,7)].map(h => parseInt(h,16));
    doc.setFillColor(r, g, b);
    doc.roundedRect(x, y, COL_W, 6.5, 1, 1, "F");
    setFont("normal", FONT_SM - 1);
    setColor(textHex);
    text(msg, x + 1.5, y + 4.2);
    resetColor();
    y += 8;
  };

  // ─── CONTENIDO ────────────────────────────────────────────────────────────

  // Encabezado empresa
  setFont("bold", FONT_MED);
  text(nombreEmpresa, PAGE_W / 2, y, { align: "center" });
  y += LINE_H;

  setFont("normal", FONT_SM);
  setColor("#94a3b8");
  text("RECIBO DE PAGO", PAGE_W / 2, y, { align: "center" });
  resetColor();
  y += LINE_H + 1;

  dashedLine();

  // Nº recibo + fecha
  setFont("bold", FONT_LG);
  setColor("#2563eb");
  text(`#${numeroRecibo}`, x, y);
  resetColor();

  setFont("normal", FONT_SM);
  setColor("#64748b");
  text(fmtLong(pago?.createdAt || pago?.fecha), xR, y, { align: "right" });
  resetColor();
  y += LINE_H + 1;

  dashedLine();

  // Cliente
  sectionLabel("Cliente");
  setFont("bold", FONT_MED);
  text(`${cliente?.nombre ?? ""} ${cliente?.apellido ?? ""}`.trim(), x, y);
  y += LINE_SM + 1;
  setFont("normal", FONT_SM);
  setColor("#64748b");
  text(formatCedula(cliente?.cedula ?? ""), x, y);
  resetColor();
  y += LINE_H;

  dashedLine();

  // Préstamo
  sectionLabel("Préstamo");
  row("Monto original",  formatCurrency(prestamo?.monto));
  row("Frecuencia",      FRECUENCIA_LABEL[prestamo?.frecuenciaPago] ?? "—");
  row("Total cuotas",    `${prestamo?.numeroCuotas ?? "—"} cuotas`);
  row("Tasa de interés", `${prestamo?.tasaInteres ?? "—"}%`);

  dashedLine();

  // Cuota pagada o en abono
  if (cuota && pagoCompleto) {
    sectionLabel("Cuota Pagada");
    row("Número de cuota",   `#${cuota.numero} de ${prestamo?.numeroCuotas ?? "—"}`, "#2563eb");
    row("Fecha vencimiento", fmtShort(cuota.fechaVencimiento));
    dashedLine();
  } else if (cuota && !pagoCompleto) {
    sectionLabel("Cuota en Abono");
    row("Número de cuota",   `#${cuota.numero} de ${prestamo?.numeroCuotas ?? "—"}`, "#d97706");
    row("Fecha vencimiento", fmtShort(cuota.fechaVencimiento));
    infoBox("Abono parcial - la cuota aun tiene saldo pendiente.", "#fffbeb", "#92400e");
    dashedLine();
  }

  // Detalle del pago
  sectionLabel("Detalle del Pago");
  if (capitalDeCuota > 0) row("Capital",  formatCurrency(capitalDeCuota));
  if (interesPagado   > 0) row("Interes",  formatCurrency(interesPagado),  "#b45309");
  if (moraPagada      > 0) row("Mora",     formatCurrency(moraPagada),     "#dc2626");
  if (capitalDeCuota === 0 && interesPagado === 0 && moraPagada === 0) {
    row("Aplicado", formatCurrency(pago?.montoTotal ?? 0));
  }
  if (tieneAbono) {
    row("Abono a capital", `+ ${formatCurrency(abonoCapital)}`, "#0369a1");
    infoBox(`Abono de ${formatCurrency(abonoCapital)} aplicado al capital de proximas cuotas.`, "#eff6ff", "#1d4ed8");
  }
  row("Metodo", METODO_LABEL[pago?.metodo] ?? pago?.metodo ?? "—");
  if (pago?.referencia) row("Referencia", pago.referencia);

  solidLine();

  // Total pagado — caja verde
  const boxH = 14;
  doc.setFillColor(5, 150, 105); // emerald-600
  doc.roundedRect(x, y, COL_W, boxH, 2, 2, "F");

  setFont("normal", FONT_SM);
  setColor("#a7f3d0");
  text("TOTAL PAGADO", PAGE_W / 2, y + 4.5, { align: "center" });

  setFont("bold", FONT_XL);
  doc.setTextColor(255, 255, 255);
  text(formatCurrency(pago?.montoTotal ?? 0), PAGE_W / 2, y + 11, { align: "center" });
  resetColor();
  y += boxH + 2.5;

  // Saldo restante
  row("Saldo restante", formatCurrency(saldoRestante), estaSaldado ? "#059669" : "#0f172a");

  // Observación
  if (pago?.observacion) {
    dashedLine();
    sectionLabel("Observacion");
    setFont("normal", FONT_SM);
    setColor("#64748b");
    // Ajuste de texto largo en múltiples líneas
    const lines = doc.splitTextToSize(pago.observacion, COL_W);
    lines.forEach((line) => {
      text(line, x, y);
      y += LINE_SM;
    });
    resetColor();
  }

  dashedLine();

  // Footer
  if (estaSaldado) {
    setFont("bold", FONT_MED);
    setColor("#059669");
    text("¡Prestamo completamente pagado!", PAGE_W / 2, y, { align: "center" });
    resetColor();
    y += LINE_H;
  }

  setFont("normal", FONT_SM);
  setColor("#94a3b8");
  text(`Registrado por: ${usuario?.nombre ?? "—"}`, PAGE_W / 2, y, { align: "center" });
  y += LINE_SM;
  text(`${nombreEmpresa} · ${fmtShort(new Date())}`, PAGE_W / 2, y, { align: "center" });
  resetColor();
  y += MARGIN + 2;

  // ── Recortar el alto del PDF al contenido real ────────────────────────────
  const finalHeight = y;
  const finalDoc = new jsPDF({
    unit: "mm",
    format: [PAGE_W, finalHeight],
    orientation: "portrait",
  });

  // Copiar páginas (jsPDF no permite redimensionar in-place,
  // así que usamos el truco de recrear con el alto correcto).
  // En vez de copiar internamente, simplemente re-renderizamos
  // en el nuevo doc (función auxiliar).
  const pdf = _buildPDF(
    data, empresa,
    { PAGE_W, MARGIN, COL_W, LINE_H, LINE_SM, FONT_SM, FONT_NOR, FONT_MED, FONT_LG, FONT_XL }
  );

  // ── Descargar ─────────────────────────────────────────────────────────────
  const safeFileName = (fileName ?? `recibo-${numeroRecibo}`).replace(/[^a-zA-Z0-9_\-]/g, "_");
  pdf.save(`${safeFileName}.pdf`);
}

// ─── Builder interno (evita duplicar la lógica de renderizado) ────────────────

function _buildPDF(data, empresa, C) {
  const { pago, prestamo, cliente, cuota, usuario } = data ?? {};

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
    : empresa?.nombre?.nombre ?? empresa?.nombreEmpresa ?? "Sistema de Préstamos";

  const { PAGE_W, MARGIN, COL_W, LINE_H, LINE_SM, FONT_SM, FONT_NOR, FONT_MED, FONT_LG, FONT_XL } = C;

  // ── Primera pasada: calcular alto total ───────────────────────────────────
  let yCalc = MARGIN;
  yCalc += LINE_H + LINE_H + 1 + 2.5 + 2 + 1; // header + dashedLine
  yCalc += LINE_H;                              // nº recibo
  yCalc += 2.5 + 2;                             // dashedLine
  yCalc += LINE_SM + LINE_SM + 1 + LINE_H + 2.5 + 2; // cliente
  yCalc += LINE_SM + LINE_H * 4 + 2.5 + 2;    // prestamo
  if (cuota && pagoCompleto)    yCalc += LINE_SM + LINE_H * 2 + 2.5 + 2;
  if (cuota && !pagoCompleto)   yCalc += LINE_SM + LINE_H * 2 + 8 + 2.5 + 2;
  yCalc += LINE_SM; // detalle label
  if (capitalDeCuota > 0) yCalc += LINE_H;
  if (interesPagado   > 0) yCalc += LINE_H;
  if (moraPagada      > 0) yCalc += LINE_H;
  if (tieneAbono)          yCalc += LINE_H + 8;
  yCalc += LINE_H * 2; // metodo + referencia (estimado)
  yCalc += 2.5 + 2;    // solidLine
  yCalc += 14 + 2.5;   // caja total
  yCalc += LINE_H;     // saldo
  if (pago?.observacion) yCalc += LINE_H * 4;
  yCalc += 2.5 + 2;    // dashedLine footer
  if (estaSaldado) yCalc += LINE_H;
  yCalc += LINE_SM * 2 + MARGIN + 2;

  // ── Crear doc con alto exacto ─────────────────────────────────────────────
  const doc = new jsPDF({
    unit: "mm",
    format: [PAGE_W, Math.ceil(yCalc)],
    orientation: "portrait",
  });

  let y = MARGIN;
  const x  = MARGIN;
  const xR = PAGE_W - MARGIN;

  const text = (str, posX, posY, opts = {}) => doc.text(String(str ?? "—"), posX, posY, opts);
  const setFont = (style = "normal", size = FONT_NOR) => { doc.setFont("helvetica", style); doc.setFontSize(size); };
  const setColor = (hex) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    doc.setTextColor(r,g,b);
  };
  const resetColor = () => doc.setTextColor(0,0,0);

  const dashedLine = () => {
    doc.setLineDashPattern([1.5,1],0); doc.setDrawColor(180,180,180); doc.setLineWidth(0.4);
    doc.line(x,y,xR,y); doc.setLineDashPattern([],0); y += 2.5;
  };
  const solidLine = () => {
    doc.setLineDashPattern([],0); doc.setDrawColor(220,220,220); doc.setLineWidth(0.5);
    doc.line(x,y,xR,y); y += 2.5;
  };
  const row = (label, value, colorValue = "#0f172a") => {
    setFont("normal", FONT_SM); setColor("#64748b"); text(label, x, y);
    setFont("bold", FONT_NOR);  setColor(colorValue); text(String(value ?? "—"), xR, y, { align:"right" });
    resetColor(); y += LINE_H;
  };
  const sectionLabel = (label) => {
    setFont("bold", FONT_SM); setColor("#94a3b8"); text(label.toUpperCase(), x, y); resetColor(); y += LINE_SM;
  };
  const infoBox = (msg, bgHex, textHex) => {
    const [r,g,b] = [bgHex.slice(1,3),bgHex.slice(3,5),bgHex.slice(5,7)].map(h=>parseInt(h,16));
    doc.setFillColor(r,g,b); doc.roundedRect(x,y,COL_W,6.5,1,1,"F");
    setFont("normal", FONT_SM-1); setColor(textHex); text(msg, x+1.5, y+4.2); resetColor(); y += 8;
  };

  // ── Renderizado ───────────────────────────────────────────────────────────

  setFont("bold", FONT_MED); text(nombreEmpresa, PAGE_W/2, y, {align:"center"}); y += LINE_H;
  setFont("normal", FONT_SM); setColor("#94a3b8"); text("RECIBO DE PAGO", PAGE_W/2, y, {align:"center"}); resetColor(); y += LINE_H+1;
  dashedLine();

  setFont("bold", FONT_LG); setColor("#2563eb"); text(`#${numeroRecibo}`, x, y); resetColor();
  setFont("normal", FONT_SM); setColor("#64748b"); text(fmtLong(pago?.createdAt||pago?.fecha), xR, y, {align:"right"}); resetColor();
  y += LINE_H+1; dashedLine();

  sectionLabel("Cliente");
  setFont("bold", FONT_MED); text(`${cliente?.nombre??""} ${cliente?.apellido??""}`.trim(), x, y); y += LINE_SM+1;
  setFont("normal", FONT_SM); setColor("#64748b"); text(formatCedula(cliente?.cedula??""), x, y); resetColor(); y += LINE_H;
  dashedLine();

  sectionLabel("Préstamo");
  row("Monto original",  formatCurrency(prestamo?.monto));
  row("Frecuencia",      FRECUENCIA_LABEL[prestamo?.frecuenciaPago]??"—");
  row("Total cuotas",    `${prestamo?.numeroCuotas??"—"} cuotas`);
  row("Tasa de interes", `${prestamo?.tasaInteres??"—"}%`);
  dashedLine();

  if (cuota && pagoCompleto) {
    sectionLabel("Cuota Pagada");
    row("Numero de cuota",   `#${cuota.numero} de ${prestamo?.numeroCuotas??"—"}`, "#2563eb");
    row("Fecha vencimiento", fmtShort(cuota.fechaVencimiento));
    dashedLine();
  } else if (cuota && !pagoCompleto) {
    sectionLabel("Cuota en Abono");
    row("Numero de cuota",   `#${cuota.numero} de ${prestamo?.numeroCuotas??"—"}`, "#d97706");
    row("Fecha vencimiento", fmtShort(cuota.fechaVencimiento));
    infoBox("Abono parcial - la cuota aun tiene saldo pendiente.", "#fffbeb", "#92400e");
    dashedLine();
  }

  sectionLabel("Detalle del Pago");
  if (capitalDeCuota > 0) row("Capital",  formatCurrency(capitalDeCuota));
  if (interesPagado   > 0) row("Interes",  formatCurrency(interesPagado),  "#b45309");
  if (moraPagada      > 0) row("Mora",     formatCurrency(moraPagada),     "#dc2626");
  if (capitalDeCuota===0 && interesPagado===0 && moraPagada===0)
    row("Aplicado", formatCurrency(pago?.montoTotal??0));
  if (tieneAbono) {
    row("Abono a capital", `+ ${formatCurrency(abonoCapital)}`, "#0369a1");
    infoBox(`Abono de ${formatCurrency(abonoCapital)} aplicado al capital de proximas cuotas.`, "#eff6ff", "#1d4ed8");
  }
  row("Metodo", METODO_LABEL[pago?.metodo]??pago?.metodo??"—");
  if (pago?.referencia) row("Referencia", pago.referencia);
  solidLine();

  // Caja total
  const boxH = 14;
  doc.setFillColor(5,150,105);
  doc.roundedRect(x, y, COL_W, boxH, 2, 2, "F");
  setFont("normal", FONT_SM); setColor("#a7f3d0"); text("TOTAL PAGADO", PAGE_W/2, y+4.5, {align:"center"});
  setFont("bold", FONT_XL); doc.setTextColor(255,255,255); text(formatCurrency(pago?.montoTotal??0), PAGE_W/2, y+11, {align:"center"});
  resetColor(); y += boxH+2.5;

  row("Saldo restante", formatCurrency(saldoRestante), estaSaldado ? "#059669" : "#0f172a");

  if (pago?.observacion) {
    dashedLine(); sectionLabel("Observacion");
    setFont("normal", FONT_SM); setColor("#64748b");
    const lines = doc.splitTextToSize(pago.observacion, COL_W);
    lines.forEach(line => { text(line, x, y); y += LINE_SM; });
    resetColor();
  }

  dashedLine();

  if (estaSaldado) {
    setFont("bold", FONT_MED); setColor("#059669");
    text("¡Prestamo completamente pagado!", PAGE_W/2, y, {align:"center"});
    resetColor(); y += LINE_H;
  }

  setFont("normal", FONT_SM); setColor("#94a3b8");
  text(`Registrado por: ${usuario?.nombre??"—"}`, PAGE_W/2, y, {align:"center"}); y += LINE_SM;
  text(`${nombreEmpresa} · ${fmtShort(new Date())}`, PAGE_W/2, y, {align:"center"});
  resetColor();

  return doc;
}