// src/pages/CierreCaja.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n = 0) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency", currency: "DOP", minimumFractionDigits: 2,
  }).format(n);

const fmtHora = (d) =>
  new Intl.DateTimeFormat("es-DO", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(d));

const fmtFechaGasto = (d) => {
  const datePart = typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("es-DO", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(datePart + "T12:00:00"));
};

const fmtFechaLarga = (f) =>
  new Intl.DateTimeFormat("es-DO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(f + "T12:00:00"));

const fmtFechaCorta = (f) =>
  new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(f + "T12:00:00"));

const hoyStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const METODO_COLOR = {
  EFECTIVO:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  TRANSFERENCIA: "bg-blue-100 text-blue-700 border-blue-200",
  TARJETA:       "bg-violet-100 text-violet-700 border-violet-200",
  CHEQUE:        "bg-amber-100 text-amber-700 border-amber-200",
};
const METODO_LABEL = {
  EFECTIVO:"Efectivo", TRANSFERENCIA:"Transferencia", TARJETA:"Tarjeta", CHEQUE:"Cheque",
};
const METODO_ICON = {
  EFECTIVO:"💵", TRANSFERENCIA:"🏦", TARJETA:"💳", CHEQUE:"📄",
};

if (typeof document !== "undefined" && !document.getElementById("caja-styles")) {
  const s = document.createElement("style");
  s.id = "caja-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

const POR_PAGINA_HISTORIAL = 10;

const Spinner = () => (
  <div className="flex justify-center items-center py-24">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium ${
      type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"
    }`}>
      {type === "success"
        ? <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        : <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      }
      {message}
    </div>
  );
};

// ─── Modal Abrir Caja ─────────────────────────────────────────────────────────
const ModalAbrirCaja = ({ onConfirm, onClose, loading }) => {
  const [monto, setMonto] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" style={{ animation:"fadeUp 0.2s ease" }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Abrir Caja</h3>
            <p className="text-xs text-gray-500">Ingresa el efectivo inicial</p>
          </div>
        </div>
        <label className="block text-xs font-bold text-gray-600 mb-1.5">Monto inicial en efectivo</label>
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 mb-5">
          <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm font-medium border-r border-gray-200">RD$</span>
          <input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00" className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-medium" autoFocus />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">Cancelar</button>
          <button onClick={() => onConfirm(parseFloat(monto) || 0)} disabled={loading || monto === ""}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Abrir caja"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Cerrar Caja ─────────────────────────────────────────────────────────
const ModalCerrarCaja = ({ caja, onConfirm, onClose, loading }) => {
  const [efectivoReal, setEfectivoReal] = useState("");
  const [obs,   setObs]   = useState("");

  const pagosPorMetodo     = caja.resumen?.pagosPorMetodo ?? {};
  const totalDesembolsado  = caja.resumen?.totalDesembolsado ?? 0;
  const efectivoSistema    = caja.resumen?.efectivoSistema ?? ((caja.montoInicial || 0) + (pagosPorMetodo?.EFECTIVO?.monto || 0) - totalDesembolsado);
  const diferencia         = efectivoReal !== "" ? (parseFloat(efectivoReal) || 0) - efectivoSistema : null;
  const totalCobrado       = Object.values(pagosPorMetodo).reduce((s, m) => s + m.monto, 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4" style={{ animation:"fadeUp 0.2s ease" }}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-base">Cerrar Caja</h3>
              <p className="text-xs opacity-75">{caja.usuario?.nombre} · {fmtFechaCorta(caja.fecha)}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Cobros por método */}
          {Object.keys(pagosPorMetodo).length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cobros por método</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(pagosPorMetodo).map(([metodo, info]) => (
                  <div key={metodo} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 ${METODO_COLOR[metodo] ?? "bg-gray-50 border-gray-200"}`}>
                    <span className="text-base">{METODO_ICON[metodo] ?? "💰"}</span>
                    <div>
                      <p className="text-[10px] font-bold opacity-60 uppercase">{METODO_LABEL[metodo] ?? metodo}</p>
                      <p className="text-sm font-bold">{fmt(info.monto)}</p>
                      <p className="text-[10px] opacity-50">{info.cantidad} {info.cantidad === 1 ? "pago" : "pagos"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-xs text-gray-500 font-semibold">Total cobrado</span>
                <span className="text-sm font-bold text-gray-800">{fmt(totalCobrado)}</span>
              </div>
            </div>
          )}

          {/* Cuadre de efectivo — incluye desembolsos */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Cuadre de efectivo</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Efectivo inicial</span>
              <span className="font-semibold text-gray-800">{fmt(caja.montoInicial)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cobros en efectivo</span>
              <span className="font-semibold text-emerald-700">+{fmt(pagosPorMetodo?.EFECTIVO?.monto || 0)}</span>
            </div>
            {totalDesembolsado > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Desembolsos entregados</span>
                <span className="font-semibold text-red-600">−{fmt(totalDesembolsado)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
              <span className="font-bold text-gray-700">Efectivo sistema</span>
              <span className="font-bold text-blue-700">{fmt(efectivoSistema)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Efectivo real en físico</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm font-medium border-r border-gray-200">RD$</span>
              <input type="number" min="0" step="0.01" value={efectivoReal} onChange={(e) => setEfectivoReal(e.target.value)}
                placeholder="0.00" className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-medium" autoFocus />
            </div>
          </div>

          {diferencia !== null && (
            <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl text-sm font-bold border ${
              diferencia === 0  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : diferencia > 0  ? "bg-blue-50 text-blue-700 border-blue-200"
              :                    "bg-red-50 text-red-700 border-red-200"
            }`}>
              <span>{diferencia === 0 ? "✓ Cuadre exacto" : diferencia > 0 ? "💙 Sobrante" : "⚠️ Faltante"}</span>
              <span>{diferencia === 0 ? "—" : fmt(Math.abs(diferencia))}</span>
            </div>
          )}

          {diferencia !== null && diferencia !== 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div className="text-xs text-amber-800">
                  <p className="font-bold">Diferencia detectada</p>
                  <p className="mt-1">El sistema permitirá el cierre, pero esta diferencia queda registrada para auditoría.</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Observaciones <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              placeholder="Notas del cierre..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">
              Cancelar
            </button>
            <button onClick={() => onConfirm(parseFloat(efectivoReal) || 0, obs)} disabled={loading || efectivoReal === ""}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirmar cierre"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EstadoCajaBadge = ({ estado }) =>
  estado === "ABIERTA"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>Abierta</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>Cerrada</span>;

// ─── PDF del cierre ───────────────────────────────────────────────────────────
const imprimirCierre = (caja, resumenDia, empresa, isAdmin) => {
  const pagosPorMetodo     = caja?.resumen?.pagosPorMetodo ?? resumenDia?.pagosPorMetodo ?? {};
  const pagos              = caja?.resumen?.pagos ?? resumenDia?.pagos ?? [];
  const desembolsos        = caja?.resumen?.desembolsos ?? resumenDia?.desembolsos ?? [];
  const totalCobrado       = caja?.resumen?.totalCobrado ?? resumenDia?.resumen?.totalCobrado ?? 0;
  const totalEfectivo      = caja?.resumen?.totalEfectivo ?? resumenDia?.resumen?.totalEfectivo ?? 0;
  const totalDesembolsado  = caja?.resumen?.totalDesembolsado ?? resumenDia?.resumen?.totalDesembolsado ?? 0;
  const efectivoSistema    = caja?.resumen?.efectivoSistema ?? resumenDia?.resumen?.efectivoSistema ?? 0;
  const montoInicial       = caja?.montoInicial ?? 0;
  const montoCierre        = caja?.efectivoReal ?? caja?.montoCierre ?? null;
  const diferencia         = caja?.diferencia ?? null;
  const cajero             = caja?.usuario?.nombre ?? "—";
  const fecha              = caja?.fecha ?? resumenDia?.fecha ?? hoyStr();

  const fmtC = (n) => new Intl.NumberFormat("es-DO",{style:"currency",currency:"DOP"}).format(n);

  const metodosHTML = Object.entries(pagosPorMetodo).map(([m, info]) => `
    <tr><td>${METODO_LABEL[m] ?? m}</td><td class="right">${info.cantidad}</td><td class="right"><strong>${fmtC(info.monto)}</strong></td></tr>`).join("");

  const pagosHTML = pagos.slice(0,50).map((p) => `
    <tr>
      <td>${new Intl.DateTimeFormat("es-DO",{hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(p.createdAt))}</td>
      <td>${p.prestamo?.cliente?.nombre ?? ""} ${p.prestamo?.cliente?.apellido ?? ""}</td>
      <td class="right">${fmtC(p.montoTotal)}</td>
      <td>${METODO_LABEL[p.metodo] ?? p.metodo}</td>
    </tr>`).join("");

  const gastosHTML = gastos.map((g) => `
    <tr><td>${g.categoria}</td><td>${g.descripcion}</td><td class="right" style="color:#dc2626"><strong>${fmtC(g.monto)}</strong></td></tr>`).join("");

  const desembolsosHTML = desembolsos.map((d) => `
    <tr>
      <td>${new Intl.DateTimeFormat("es-DO",{hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(d.createdAt))}</td>
      <td>${d.prestamo?.cliente?.nombre ?? ""} ${d.prestamo?.cliente?.apellido ?? ""}</td>
      <td>${d.concepto}</td>
      <td class="right" style="color:#dc2626"><strong>${fmtC(d.monto)}</strong></td>
    </tr>`).join("");

  const diferenciaHTML = diferencia !== null ? `
    <div style="margin:12px 0;padding:10px 14px;border-radius:8px;font-weight:700;font-size:13px;
      background:${diferencia===0?"#ecfdf5":diferencia>0?"#eff6ff":"#fef2f2"};
      color:${diferencia===0?"#065f46":diferencia>0?"#1e40af":"#991b1b"};
      border:1px solid ${diferencia===0?"#6ee7b7":diferencia>0?"#93c5fd":"#fca5a5"}">
      ${diferencia===0?"✓ Cuadre exacto":diferencia>0?`Sobrante: ${fmtC(diferencia)}`:`Faltante: ${fmtC(Math.abs(diferencia))}`}
    </div>` : "";

  const ventana = window.open("","_blank","width=800,height=900");
  ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Cierre de Caja — ${fmtFechaCorta(fecha)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;padding:28px;font-size:12px;max-width:680px;margin:0 auto}
      .header{text-align:center;border-bottom:2px solid #1e293b;padding-bottom:14px;margin-bottom:18px}
      .header h1{font-size:20px;font-weight:800}
      .header p{color:#64748b;font-size:11px;margin-top:3px}
      .section{margin-bottom:18px}
      .section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
      .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
      .info-card .label{font-size:10px;color:#94a3b8;margin-bottom:2px}
      .info-card .value{font-size:15px;font-weight:800}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th{background:#f8fafc;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
      .right{text-align:right}
      tfoot td{font-weight:700;background:#f1f5f9;font-size:11px}
      .footer{margin-top:24px;padding-top:12px;border-top:1px dashed #e2e8f0;text-align:center;font-size:10px;color:#94a3b8}
      @media print{@page{margin:12mm}body{padding:0}}
    </style></head><body>
    <div class="header">
      <h1>${empresa}</h1>
      <p>Arqueo de Caja · ${fmtFechaLarga(fecha)}</p>
      ${isAdmin ? "" : `<p style="margin-top:3px">Cajero: <strong>${cajero}</strong></p>`}
    </div>
    <div class="section">
      <div class="section-title">Resumen del día</div>
      <div class="info-grid">
        <div class="info-card"><div class="label">Total cobrado</div><div class="value" style="color:#059669">${fmtC(totalCobrado)}</div></div>
        <div class="info-card"><div class="label">En efectivo</div><div class="value" style="color:#2563eb">${fmtC(totalEfectivo)}</div></div>
        <div class="info-card"><div class="label">Total desembolsado</div><div class="value" style="color:#dc2626">${fmtC(totalDesembolsado)}</div></div>
        ${isAdmin
          ? `<div class="info-card"><div class="label">Efectivo sistema</div><div class="value" style="color:#2563eb">${fmtC(efectivoSistema)}</div></div>`
          : `<div class="info-card"><div class="label">Monto inicial</div><div class="value">${fmtC(montoInicial)}</div></div>`
        }
      </div>
      ${montoCierre !== null ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:#64748b">Monto inicial</span><strong>${fmtC(montoInicial)}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px"><span style="color:#64748b">Monto cierre</span><strong>${fmtC(montoCierre)}</strong></div>
      </div>${diferenciaHTML}` : ""}
    </div>
    ${Object.keys(pagosPorMetodo).length > 0 ? `
    <div class="section">
      <div class="section-title">Cobros por método de pago</div>
      <table><thead><tr><th>Método</th><th class="right">Cantidad</th><th class="right">Monto</th></tr></thead>
      <tbody>${metodosHTML}</tbody>
      <tfoot><tr><td>Total</td><td class="right">${Object.values(pagosPorMetodo).reduce((s,m)=>s+m.cantidad,0)}</td><td class="right">${fmtC(totalCobrado)}</td></tr></tfoot></table>
    </div>` : ""}
    ${desembolsos.length > 0 ? `
    <div class="section">
      <div class="section-title">Desembolsos del día (${desembolsos.length})</div>
      <table><thead><tr><th>Hora</th><th>Cliente</th><th>Concepto</th><th class="right">Monto</th></tr></thead>
      <tbody>${desembolsosHTML}</tbody>
      <tfoot><tr><td colspan="3">Total desembolsado</td><td class="right" style="color:#dc2626">${fmtC(totalDesembolsado)}</td></tr></tfoot></table>
    </div>` : ""}
    ${pagos.length > 0 ? `
    <div class="section">
      <div class="section-title">Detalle de pagos (${pagos.length})</div>
      <table><thead><tr><th>Hora</th><th>Cliente</th><th class="right">Total</th><th>Método</th></tr></thead>
      <tbody>${pagosHTML}</tbody></table>
      ${pagos.length > 50 ? `<p style="font-size:10px;color:#94a3b8;text-align:center">Se muestran los primeros 50 de ${pagos.length} pagos</p>` : ""}
    </div>` : ""}
    <div class="footer">${empresa} · Generado el ${new Intl.DateTimeFormat("es-DO",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date())}</div>
  </body></html>`);
  ventana.document.close();
  ventana.focus();
  setTimeout(() => { ventana.print(); ventana.close(); }, 400);
};

// ─── Historial ────────────────────────────────────────────────────────────────
const Historial = ({ isAdmin }) => {
  const [historial,    setHistorial]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [pagina,       setPagina]       = useState(1);
  const [busqueda,     setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  useEffect(() => {
    setLoading(true);
    api.get("/caja/historial").then(r => setHistorial(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtrados    = historial.filter(c => {
    const matchEstado = filtroEstado === "TODOS" || c.estado === filtroEstado;
    const matchBusca  = !busqueda || c.fecha.includes(busqueda) || (c.usuario?.nombre ?? "").toLowerCase().includes(busqueda.toLowerCase());
    return matchEstado && matchBusca;
  });
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA_HISTORIAL));
  const paginados    = filtrados.slice((pagina-1)*POR_PAGINA_HISTORIAL, pagina*POR_PAGINA_HISTORIAL);
  useEffect(() => { setPagina(1); }, [busqueda, filtroEstado]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por fecha o cajero…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div className="flex gap-1.5">
          {["TODOS","ABIERTA","CERRADA"].map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                filtroEstado === e
                  ? e === "ABIERTA" ? "bg-emerald-600 text-white border-emerald-600"
                    : e === "CERRADA" ? "bg-gray-700 text-white border-gray-700"
                    : "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>{e === "TODOS" ? "Todos" : e === "ABIERTA" ? "Abiertas" : "Cerradas"}</button>
          ))}
        </div>
      </div>
      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><div className="text-3xl mb-2">📭</div><p className="font-medium">No hay cierres que mostrar</p></div>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                {isAdmin && <th className="px-4 py-3 text-left font-semibold">Cajero</th>}
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Inicial</th>
                <th className="px-4 py-3 text-right font-semibold">Cierre</th>
                <th className="px-4 py-3 text-right font-semibold">Diferencia</th>
                <th className="px-4 py-3 text-left font-semibold">Obs.</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {paginados.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3"><p className="font-semibold text-gray-800">{fmtFechaCorta(c.fecha)}</p><p className="text-xs text-gray-400 font-mono">{fmtHora(c.createdAt)}</p></td>
                    {isAdmin && <td className="px-4 py-3 text-gray-700">{c.usuario?.nombre ?? "—"}</td>}
                    <td className="px-4 py-3"><EstadoCajaBadge estado={c.estado}/></td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(c.montoInicial)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.montoCierre != null ? fmt(c.montoCierre) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {c.diferencia != null ? (
                        <span className={`font-bold ${c.diferencia===0?"text-emerald-600":c.diferencia>0?"text-blue-600":"text-red-600"}`}>
                          {c.diferencia===0?"✓ Exacto":c.diferencia>0?`+${fmt(c.diferencia)}`:fmt(c.diferencia)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[140px] truncate">{c.observaciones || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2">
            {paginados.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="font-bold text-gray-800">{fmtFechaCorta(c.fecha)}</p>{isAdmin && <p className="text-xs text-gray-400">{c.usuario?.nombre}</p>}</div>
                  <EstadoCajaBadge estado={c.estado}/>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Inicial</p><p className="font-bold text-gray-700">{fmt(c.montoInicial)}</p></div>
                  <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Cierre</p><p className="font-bold text-gray-700">{c.montoCierre != null ? fmt(c.montoCierre) : "—"}</p></div>
                  <div className={`rounded p-1.5 text-center ${c.diferencia < 0 ? "bg-red-50" : c.diferencia > 0 ? "bg-blue-50" : "bg-emerald-50"}`}>
                    <p className="text-gray-400">Dif.</p>
                    <p className={`font-bold ${c.diferencia===0?"text-emerald-600":c.diferencia>0?"text-blue-600":"text-red-600"}`}>{c.diferencia != null ? (c.diferencia===0?"✓":fmt(Math.abs(c.diferencia))) : "—"}</p>
                  </div>
                </div>
                {c.observaciones && <p className="text-[10px] text-gray-400 italic">{c.observaciones}</p>}
              </div>
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-1 py-2">
              <p className="text-xs text-gray-400">{(pagina-1)*POR_PAGINA_HISTORIAL+1}–{Math.min(pagina*POR_PAGINA_HISTORIAL,filtrados.length)} de {filtrados.length}</p>
              <div className="flex gap-1">
                <button onClick={() => setPagina(p => Math.max(1,p-1))} disabled={pagina===1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                {Array.from({length:totalPaginas},(_,i)=>i+1).filter(p=>p===1||p===totalPaginas||Math.abs(p-pagina)<=1).map((p,i,arr)=>(
                  <span key={p}>
                    {i>0&&arr[i-1]!==p-1&&<span className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>}
                    <button onClick={()=>setPagina(p)} className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${p===pagina?"bg-blue-600 text-white":"text-gray-600 hover:bg-gray-100"}`}>{p}</button>
                  </span>
                ))}
                <button onClick={()=>setPagina(p=>Math.min(totalPaginas,p+1))} disabled={pagina===totalPaginas}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CierreCaja() {
  const { user } = useAuth();
  const isAdmin  = user?.rol === "ADMIN";
  const hoy      = hoyStr();
  const empresa  = JSON.parse(localStorage.getItem("user") || "{}").empresa || "Sistema de Préstamos";

  const [fecha,         setFecha]        = useState(hoy);
  const [miCaja,        setMiCaja]       = useState(null);
  const [resumenDia,    setResumenDia]   = useState(null);
  const [loading,       setLoading]      = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,         setToast]        = useState(null);
  const [modalAbrir,    setModalAbrir]   = useState(false);
  const [modalCerrar,   setModalCerrar]  = useState(false);
  const [tabAdmin,      setTabAdmin]     = useState("cajas");
  const [tabPrincipal,  setTabPrincipal] = useState("dia");

  const showToast = (message, type = "success") => setToast({ message, type });
  const esHoy = fecha === hoy;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cajaRes, resumenRes] = await Promise.all([
        api.get(`/caja/activa?fecha=${fecha}`),
        isAdmin ? api.get(`/caja/resumen?fecha=${fecha}`) : Promise.resolve(null),
      ]);
      setMiCaja(cajaRes.data);
      if (resumenRes) setResumenDia(resumenRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [fecha, isAdmin]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleAbrirCaja = async (montoInicial) => {
    setActionLoading(true);
    try {
      await api.post("/caja/abrir", { montoInicial, fecha });
      setModalAbrir(false);
      showToast("Caja abierta correctamente");
      cargar();
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al abrir la caja", "error");
    } finally { setActionLoading(false); }
  };

  const handleCerrarCaja = async (efectivoReal, observaciones) => {
    setActionLoading(true);
    try {
      await api.patch(`/caja/${miCaja.id}/cerrar`, { efectivoReal, observaciones });
      setModalCerrar(false);
      showToast("Caja cerrada correctamente");
      cargar();
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al cerrar la caja", "error");
    } finally { setActionLoading(false); }
  };

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {modalAbrir  && <ModalAbrirCaja  onConfirm={handleAbrirCaja}  onClose={() => setModalAbrir(false)}  loading={actionLoading} />}
      {modalCerrar && <ModalCerrarCaja caja={miCaja} onConfirm={handleCerrarCaja} onClose={() => setModalCerrar(false)} loading={actionLoading} />}

      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{fmtFechaLarga(fecha)}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-1">
              <button onClick={() => { const d = new Date(fecha+"T12:00:00"); d.setDate(d.getDate()-1); setFecha(d.toISOString().slice(0,10)); }}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
              <button onClick={() => { const d = new Date(fecha+"T12:00:00"); d.setDate(d.getDate()+1); const n=d.toISOString().slice(0,10); if(n<=hoy)setFecha(n); }}
                disabled={fecha>=hoy} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
              {!esHoy && <button onClick={() => setFecha(hoy)} className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 whitespace-nowrap">Hoy</button>}
            </div>
            {(miCaja || resumenDia) && (
              <button onClick={() => imprimirCierre(miCaja, resumenDia, empresa, isAdmin)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-all active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                <span className="hidden sm:inline">Imprimir / </span>PDF
              </button>
            )}
            {esHoy && (
              !miCaja
                ? <button onClick={() => setModalAbrir(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Abrir caja
                  </button>
                : miCaja.estado === "ABIERTA"
                  ? <button onClick={() => setModalCerrar(true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                      Cerrar caja
                    </button>
                  : <span className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200 text-center">Caja cerrada hoy</span>
            )}
          </div>
        </div>

        {/* Tabs principales */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          <button onClick={() => setTabPrincipal("dia")}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tabPrincipal==="dia"?"bg-blue-600 text-white":"text-gray-500 hover:bg-gray-50"}`}>
            📅 Vista del día
          </button>
          <button onClick={() => setTabPrincipal("historial")}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tabPrincipal==="historial"?"bg-blue-600 text-white":"text-gray-500 hover:bg-gray-50"}`}>
            📋 Historial de cierres
          </button>
        </div>

        {/* Tab Historial */}
        {tabPrincipal === "historial" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Historial de sesiones de caja</h2>
            <Historial isAdmin={isAdmin} />
          </div>
        )}

        {/* Tab Día */}
        {tabPrincipal === "dia" && (
          loading ? <Spinner /> : (
            <>
              {/* Mi caja */}
              {miCaja ? (
                <div className={`rounded-2xl border p-4 sm:p-5 ${miCaja.estado==="ABIERTA"?"bg-emerald-50 border-emerald-200":"bg-gray-50 border-gray-200"}`}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="font-bold text-gray-900">Mi caja — {miCaja.usuario?.nombre}</h2>
                        <EstadoCajaBadge estado={miCaja.estado}/>
                      </div>
                      <p className="text-xs text-gray-500">
                        Abierta a las {fmtHora(miCaja.createdAt)} · Efectivo inicial: <strong>{fmt(miCaja.montoInicial)}</strong>
                        {miCaja.fechaCierre && ` · Cerrada a las ${fmtHora(miCaja.fechaCierre)}`}
                      </p>
                    </div>
                    {miCaja.estado === "CERRADA" && miCaja.diferencia != null && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border ${
                        miCaja.diferencia===0 ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : miCaja.diferencia>0 ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-red-100 text-red-700 border-red-200"
                      }`}>
                        {miCaja.diferencia===0 ? "✓ Cuadre exacto"
                          : miCaja.diferencia>0 ? `💙 Sobrante: ${fmt(miCaja.diferencia)}`
                          : `⚠️ Faltante: ${fmt(Math.abs(miCaja.diferencia))}`}
                      </div>
                    )}
                  </div>

                  {miCaja.resumen && (
                    <>
                      {/* KPIs de mi caja — ahora incluye desembolsos */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
                        {[
                          { label:"Total cobrado",    value:fmt(miCaja.resumen.totalCobrado),       color:"text-emerald-700" },
                          { label:"En efectivo",      value:fmt(miCaja.resumen.totalEfectivo),      color:"text-blue-700"    },
                          { label:"Desembolsado",     value:fmt(miCaja.resumen.totalDesembolsado),  color:"text-red-600"     },
                          { label:"Efectivo en caja", value:fmt(miCaja.resumen.efectivoEnCaja),     color:"text-gray-700"    },
                        ].map((k) => (
                          <div key={k.label} className="bg-white rounded-xl border border-white/80 px-3 py-2.5 shadow-sm">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{k.label}</p>
                            <p className={`text-base font-bold ${k.color} mt-0.5`}>{k.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Cobros por método */}
                      {Object.keys(miCaja.resumen.pagosPorMetodo ?? {}).length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Cobros por método</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Object.entries(miCaja.resumen.pagosPorMetodo).map(([metodo, info]) => (
                              <div key={metodo} className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${METODO_COLOR[metodo] ?? "bg-gray-50 border-gray-200"}`}>
                                <span>{METODO_ICON[metodo] ?? "💰"}</span>
                                <div>
                                  <p className="text-[10px] font-bold opacity-60">{METODO_LABEL[metodo] ?? metodo}</p>
                                  <p className="text-sm font-bold">{fmt(info.monto)}</p>
                                  <p className="text-[10px] opacity-50">{info.cantidad} pagos</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Desembolsos de mi caja ── */}
                      {miCaja.resumen.desembolsos?.length > 0 && (
                        <div className="mt-4 bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-red-100 bg-red-50">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-red-600 uppercase tracking-wide">
                                💸 Desembolsos del día ({miCaja.resumen.cantidadDesembolsos})
                              </p>
                              <span className="text-xs font-bold text-red-700">{fmt(miCaja.resumen.totalDesembolsado)}</span>
                            </div>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {miCaja.resumen.desembolsos.map((d) => (
                              <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">
                                    {d.prestamo?.cliente?.nombre} {d.prestamo?.cliente?.apellido}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">{d.concepto} · {fmtHora(d.createdAt)}</p>
                                </div>
                                <p className="text-sm font-bold text-red-600 shrink-0">{fmt(d.monto)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tabla de pagos */}
                      {miCaja.resumen?.pagos?.length > 0 && (
                        <div className="mt-4 bg-white rounded-xl border border-white/80 shadow-sm overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pagos de mi caja ({miCaja.resumen?.pagos?.length ?? 0})</p>
                          </div>
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-gray-50 text-gray-500 uppercase tracking-wide border-b border-gray-100">
                                <th className="px-3 py-2 text-left font-semibold">Hora</th>
                                <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                                <th className="px-3 py-2 text-right font-semibold">Capital</th>
                                <th className="px-3 py-2 text-right font-semibold">Interés</th>
                                <th className="px-3 py-2 text-right font-semibold">Mora</th>
                                <th className="px-3 py-2 text-right font-semibold">Total</th>
                                <th className="px-3 py-2 text-left font-semibold">Método</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {miCaja.resumen.pagos.map((p) => (
                                  <tr key={p.id} className="hover:bg-blue-50/20">
                                    <td className="px-3 py-2 text-gray-400 font-mono">{fmtHora(p.createdAt)}</td>
                                    <td className="px-3 py-2 font-medium text-gray-700">{p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{fmt(p.capital)}</td>
                                    <td className="px-3 py-2 text-right text-amber-600">{fmt(p.interes)}</td>
                                    <td className="px-3 py-2 text-right text-red-500">{p.mora > 0 ? fmt(p.mora) : "—"}</td>
                                    <td className="px-3 py-2 text-right font-bold text-gray-800">{fmt(p.montoTotal)}</td>
                                    <td className="px-3 py-2">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${METODO_COLOR[p.metodo] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                        {METODO_LABEL[p.metodo] ?? p.metodo}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                  <td colSpan={2} className="px-3 py-2 text-xs font-bold text-gray-600">Totales</td>
                                  <td className="px-3 py-2 text-right text-xs font-bold text-blue-700">{fmt(miCaja.resumen.totalCapital)}</td>
                                  <td className="px-3 py-2 text-right text-xs font-bold text-amber-700">{fmt(miCaja.resumen.totalInteres)}</td>
                                  <td className="px-3 py-2 text-right text-xs font-bold text-red-600">{fmt(miCaja.resumen.totalMora)}</td>
                                  <td className="px-3 py-2 text-right text-xs font-bold text-gray-800">{fmt(miCaja.resumen.totalCobrado)}</td>
                                  <td/>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          <div className="sm:hidden divide-y divide-gray-50">
                            {miCaja.resumen.pagos.map((p) => (
                              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido}</p>
                                  <p className="text-xs text-gray-400 font-mono mt-0.5">{fmtHora(p.createdAt)}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-gray-800">{fmt(p.montoTotal)}</p>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${METODO_COLOR[p.metodo] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                    {METODO_LABEL[p.metodo] ?? p.metodo}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : esHoy ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-2">🔓</div>
                  <p className="font-bold text-amber-800">No tienes caja abierta hoy</p>
                  <p className="text-sm text-amber-600 mt-1">Abre tu caja para comenzar a registrar cobros del día</p>
                  <button onClick={() => setModalAbrir(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm transition-all">
                    Abrir caja ahora
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center text-gray-400">
                  <div className="text-4xl mb-2">📅</div>
                  <p className="font-medium">No hubo caja abierta este día</p>
                </div>
              )}

              {/* Vista Admin */}
              {isAdmin && resumenDia && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Resumen global del día</h2>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label:"Total cobrado",    value:fmt(resumenDia.resumen.totalCobrado),      color:"text-emerald-700", bg:"bg-emerald-50 border-emerald-100" },
                      { label:"Total desembolsado",value:fmt(resumenDia.resumen.totalDesembolsado),color:"text-red-700",     bg:"bg-red-50 border-red-100"         },
                      { label:"Efectivo sistema",value:fmt(resumenDia.resumen.efectivoSistema ?? 0),color:"text-blue-700",    bg:"bg-blue-50 border-blue-100"        },
                      { label:"Total en efectivo",value:fmt(resumenDia.resumen.totalEfectivo ?? 0), color:"text-indigo-700", bg:"bg-indigo-50 border-indigo-100" },
                    ].map((k) => (
                      <div key={k.label} className={`${k.bg} border rounded-2xl px-4 py-3`}>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{k.label}</p>
                        <p className={`text-xl font-bold ${k.color} mt-0.5`}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Cobros por método — admin */}
                  {Object.keys(resumenDia.pagosPorMetodo ?? {}).length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cobros por método de pago</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(resumenDia.pagosPorMetodo).map(([metodo, info]) => (
                          <div key={metodo} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 ${METODO_COLOR[metodo] ?? "bg-gray-50 border-gray-200"}`}>
                            <span className="text-lg">{METODO_ICON[metodo] ?? "💰"}</span>
                            <div>
                              <p className="text-[10px] font-bold opacity-60 uppercase">{METODO_LABEL[metodo] ?? metodo}</p>
                              <p className="text-sm font-bold">{fmt(info.monto)}</p>
                              <p className="text-[10px] opacity-50">{info.cantidad} pagos</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Tabs admin — ahora incluye Desembolsos */}
                    <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
                      {[
                        { key:"cajas",       label:`Cajas (${resumenDia.cajas?.length ?? 0})`              },
                        { key:"desembolsos", label:`Desembolsos (${resumenDia.desembolsos?.length ?? 0})` },
                        { key:"pagos",       label:`Pagos (${resumenDia.pagos?.length ?? 0})`              },
                      ].map(({ key, label }) => (
                        <button key={key} onClick={() => setTabAdmin(key)}
                          className={`px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap shrink-0 ${
                            tabAdmin===key ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab cajas */}
                    {tabAdmin === "cajas" && (
                      (resumenDia.cajas?.length ?? 0) === 0
                        ? <div className="text-center py-12 text-gray-400"><p className="font-medium">No hay cajas registradas este día</p></div>
                        : <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                                <th className="px-4 py-3 text-left font-semibold">Cajero</th>
                                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                <th className="px-4 py-3 text-right font-semibold">Inicial</th>
                                <th className="px-4 py-3 text-right font-semibold">Cierre</th>
                                <th className="px-4 py-3 text-right font-semibold">Diferencia</th>
                                <th className="px-4 py-3 text-left font-semibold">Observaciones</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {resumenDia.cajas.map((c) => (
                                  <tr key={c.id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3 font-semibold text-gray-800">{c.usuario?.nombre}</td>
                                    <td className="px-4 py-3"><EstadoCajaBadge estado={c.estado}/></td>
                                    <td className="px-4 py-3 text-right text-gray-600">{fmt(c.montoInicial)}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{c.montoCierre!=null?fmt(c.montoCierre):"—"}</td>
                                    <td className="px-4 py-3 text-right">
                                      {c.diferencia!=null ? (
                                        <span className={`font-bold ${c.diferencia===0?"text-emerald-600":c.diferencia>0?"text-blue-600":"text-red-600"}`}>
                                          {c.diferencia===0?"✓ Exacto":c.diferencia>0?`+${fmt(c.diferencia)}`:fmt(c.diferencia)}
                                        </span>
                                      ):"—"}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400">{c.observaciones||"—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                    )}

                    {/* ── Tab desembolsos admin ── */}
                    {tabAdmin === "desembolsos" && (
                      !resumenDia.desembolsos?.length
                        ? <div className="text-center py-12 text-gray-400"><div className="text-3xl mb-2">💸</div><p className="font-medium">No hay desembolsos este día</p></div>
                        : <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-red-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                                <th className="px-4 py-3 text-left font-semibold">Hora</th>
                                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                                <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                                <th className="px-4 py-3 text-right font-semibold">Monto</th>
                                <th className="px-4 py-3 text-left font-semibold">Desembolsado por</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {resumenDia.desembolsos.map((d) => (
                                  <tr key={d.id} className="hover:bg-red-50/20">
                                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{fmtHora(d.createdAt)}</td>
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-gray-800 text-xs">{d.prestamo?.cliente?.nombre} {d.prestamo?.cliente?.apellido}</p>
                                      <p className="text-[10px] text-gray-400 font-mono">{d.prestamo?.cliente?.cedula}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">{d.concepto}</td>
                                    <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(d.monto)}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{d.usuario?.nombre ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-red-50 border-t-2 border-red-100">
                                <tr>
                                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Total desembolsado</td>
                                  <td className="px-4 py-3 text-right text-xs font-bold text-red-700">{fmt(resumenDia.resumen.totalDesembolsado)}</td>
                                  <td/>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                    )}

                    {/* Tab pagos */}
                    {tabAdmin === "pagos" && (
                      (resumenDia.pagos?.length ?? 0) === 0
                        ? <div className="text-center py-12 text-gray-400"><p className="font-medium">No hay pagos este día</p></div>
                        : <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                                <th className="px-4 py-3 text-left font-semibold">Hora</th>
                                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                                <th className="px-4 py-3 text-right font-semibold">Capital</th>
                                <th className="px-4 py-3 text-right font-semibold">Interés</th>
                                <th className="px-4 py-3 text-right font-semibold">Mora</th>
                                <th className="px-4 py-3 text-right font-semibold">Total</th>
                                <th className="px-4 py-3 text-left font-semibold">Método</th>
                                <th className="px-4 py-3 text-left font-semibold">Cobrado por</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {resumenDia.pagos.map((p) => (
                                  <tr key={p.id} className="hover:bg-blue-50/20">
                                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{fmtHora(p.createdAt)}</td>
                                    <td className="px-4 py-3"><p className="font-semibold text-gray-800 text-xs">{p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido}</p><p className="text-[10px] text-gray-400 font-mono">{p.prestamo?.cliente?.cedula}</p></td>
                                    <td className="px-4 py-3 text-right text-xs text-gray-600">{fmt(p.capital)}</td>
                                    <td className="px-4 py-3 text-right text-xs text-amber-600">{fmt(p.interes)}</td>
                                    <td className="px-4 py-3 text-right text-xs text-red-500">{p.mora>0?fmt(p.mora):"—"}</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(p.montoTotal)}</td>
                                    <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${METODO_COLOR[p.metodo]??"bg-gray-100 text-gray-600 border-gray-200"}`}>{METODO_LABEL[p.metodo]??p.metodo}</span></td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{p.usuario?.nombre??"—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-100 border-t-2 border-gray-200">
                                <tr>
                                  <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Totales</td>
                                  <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">{fmt(resumenDia.resumen.totalCapital)}</td>
                                  <td className="px-4 py-3 text-right text-xs font-bold text-amber-700">{fmt(resumenDia.resumen.totalInteres)}</td>
                                  <td className="px-4 py-3 text-right text-xs font-bold text-red-600">{fmt(resumenDia.resumen.totalMora)}</td>
                                  <td className="px-4 py-3 text-right text-xs font-bold text-gray-800">{fmt(resumenDia.resumen.totalCobrado)}</td>
                                  <td colSpan={2}/>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}