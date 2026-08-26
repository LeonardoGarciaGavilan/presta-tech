// reporteHelpers.js — Utilidades compartidas para reportes
import * as XLSX from "xlsx";

// ─── Fechas ──────────────────────────────────────────────────────────────────
export const hoy = () => new Date().toISOString().slice(0, 10);

export const primerDiaMes = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

export const fmtFechaCorta = (f) =>
  new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(f));

export const fmtHora = (d) =>
  new Intl.DateTimeFormat("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d));

export const fechaReporte = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

// ─── Exportar Excel ──────────────────────────────────────────────────────────
export const exportarExcel = (sheets, filename) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ─── Exportar PDF (via print dialog) ────────────────────────────────────────
export const exportarPDF = (contenidoRef, titulo) => {
  try {
    const html = contenidoRef.current?.innerHTML;
    if (!html) return;
    const ventana = window.open("", "_blank", "width=1000,height=700");
    if (!ventana) return;
    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>${titulo}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;padding:24px;font-size:12px}
      h1{font-size:18px;font-weight:800;margin-bottom:4px}h2{font-size:14px;font-weight:700;margin:16px 0 8px}
      p{color:#64748b;font-size:11px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0}
      td{padding:7px 10px;border-bottom:1px solid #f1f5f9}.right{text-align:right}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}
      .sum-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
      .sum-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
      .sum-val{font-size:18px;font-weight:800}.sum-lbl{font-size:10px;color:#94a3b8;margin-top:2px}
      .footer{margin-top:24px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
      tfoot td{font-weight:700;background:#f1f5f9}
      @media print{@page{margin:12mm}}
    </style></head><body>${html}</body></html>`);
    ventana.document.close();
    ventana.onafterprint = () => ventana.close();
    setTimeout(() => {
      ventana.focus();
      ventana.print();
    }, 400);
    setTimeout(() => {
      try {
        if (!ventana.closed) ventana.close();
      } catch (e) {
        console.error(e);
      }
    }, 15000);
  } catch (err) {
    console.error("Error al exportar PDF:", err);
  }
};
