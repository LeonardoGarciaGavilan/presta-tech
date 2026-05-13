import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(v || 0);

const fmtFull = (v) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(v || 0);

const fmtPct = (v) =>
  v === null || v === undefined ? "N/A" : `${Number(v).toFixed(1)}%`;

// ─── Skeletons ─────────────────────────────────────────────────────────────
const Sk = ({ h = "h-24", w = "w-full" }) => (
  <div className={`${h} ${w} rounded-2xl bg-gray-100 animate-pulse`} />
);

// ─── Toast ─────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold backdrop-blur-sm border transition-all ${
        type === "success"
          ? "bg-emerald-600/95 text-white border-emerald-500"
          : "bg-red-600/95 text-white border-red-500"
      }`}
      style={{ animation: "slideInRight 0.25s ease" }}
    >
      {type === "success" ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100 text-lg leading-none font-light">×</button>
    </div>
  );
}

// ─── Bottom Sheet / Modal ───────────────────────────────────────────────────
function Sheet({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: "92dvh", animation: "sheetUp 0.28s cubic-bezier(0.32,0.72,0,1)" }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-8 space-y-4" style={{ maxHeight: "calc(92dvh - 80px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Form helpers ───────────────────────────────────────────────────────────
function MoneyInput({ value, onChange, accentClass, max, label }) {
  const num = parseFloat(value) || 0;
  const overMax = max !== undefined && num > max && num > 0;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</label>
      <div className={`flex items-center border-2 rounded-2xl overflow-hidden transition-all ${
        overMax ? "border-red-400 bg-red-50" : `border-gray-200 focus-within:${accentClass}`
      }`}>
        <span className="px-4 py-3 text-sm font-bold text-gray-400 bg-gray-50 border-r-2 border-gray-200">RD$</span>
        <input
          type="number"
          min="1"
          step="0.01"
          value={value}
          onChange={onChange}
          placeholder="0.00"
          className={`flex-1 px-4 py-3 text-base font-bold focus:outline-none bg-transparent ${overMax ? "text-red-600" : "text-gray-900"}`}
          autoFocus
        />
      </div>
      {overMax && (
        <p className="text-xs text-red-500 mt-1.5 font-medium">Máximo: {fmt(max)}</p>
      )}
    </div>
  );
}

function ConceptInput({ value, onChange, accentClass, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Concepto</label>
      <textarea
        rows={2}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full border-2 border-gray-200 focus:${accentClass} rounded-2xl px-4 py-3 text-sm text-gray-900 resize-none focus:outline-none transition-all`}
      />
    </div>
  );
}

function ActionBtn({ onClick, disabled, loading, color, children }) {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300",
    emerald: "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300",
    amber: "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex-1 py-3.5 rounded-2xl text-white text-sm font-bold transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 ${colors[color]}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, colorClass, delay = 0 }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3"
      style={{ animation: `fadeUp 0.4s ease ${delay}ms both` }}
    >
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>{icon}</div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right leading-tight">{label}</p>
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Segmented Bar ──────────────────────────────────────────────────────────
function SegmentedBar({ segments }) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  return (
    <div className="h-2.5 rounded-full overflow-hidden flex gap-0.5">
      {total === 0 ? (
        <div className="h-full w-full bg-gray-100 rounded-full" />
      ) : (
        segments.map((seg) => {
          const pct = (seg.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.label}
              className={`h-full ${seg.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${fmt(seg.value)}`}
            />
          );
        })
      )}
    </div>
  );
}

// ─── Capital Breakdown Card ──────────────────────────────────────────────────
function CapitalBreakdown({ capitalTotal, capitalRetirable, dineroEnCaja, dineroEnCalle, reservaOperativa }) {
  const rows = [
    { label: "En calle", sub: "préstamos activos", value: dineroEnCalle, color: "bg-orange-400", dot: "bg-orange-400" },
    { label: "En caja", sub: "operación diaria", value: dineroEnCaja, color: "bg-emerald-400", dot: "bg-emerald-400" },
    { label: "Reserva operativa", sub: "mínimo para operar", value: reservaOperativa, color: "bg-gray-200", dot: "bg-gray-300" },
    { label: "Disponible para retirar", sub: "libre", value: capitalRetirable, color: "bg-amber-400", dot: "bg-amber-400" },
  ];

  const segments = rows.map((r) => ({ label: r.label, value: r.value, color: r.color }));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tu capital total</p>
          <p className="text-2xl font-extrabold text-gray-900">{fmt(capitalTotal)}</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
      </div>

      <SegmentedBar segments={segments} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((row) => {
          const pct = capitalTotal > 0 ? ((row.value / capitalTotal) * 100).toFixed(1) : "0.0";
          return (
            <div key={row.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${row.dot} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-700 truncate">{row.label}</p>
                <p className="text-[11px] text-gray-400 font-medium">{row.sub}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900">{fmt(row.value)}</p>
                <p className="text-[11px] text-gray-400">{pct}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Distribution Bar ────────────────────────────────────────────────────────
function DistributionBar({ capital, ganancias }) {
  const total = capital + ganancias;
  const capitalPct = total > 0 ? (capital / total) * 100 : 0;
  const gananciasPct = total > 0 ? (ganancias / total) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Patrimonio total</p>
          <p className="text-2xl font-extrabold text-gray-900">{fmt(total)}</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
      </div>

      <SegmentedBar
        segments={[
          { label: "Capital", value: capital, color: "bg-blue-500" },
          { label: "Ganancias", value: ganancias, color: "bg-emerald-500" },
        ]}
      />

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Capital</p>
            <p className="text-sm font-bold text-gray-800">{fmt(capital)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Ganancias</p>
            <p className="text-sm font-bold text-gray-800">{fmt(ganancias)}</p>
          </div>
        </div>
        {total > 0 && (
          <div className="ml-auto text-right">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Rendimiento</p>
            <p className="text-sm font-bold text-emerald-600">+{gananciasPct.toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metric Chip ─────────────────────────────────────────────────────────────
function MetricChip({ label, value, sub, isPercent, positive }) {
  const color =
    value === null || value === undefined
      ? "text-gray-400"
      : positive === true
      ? "text-emerald-600"
      : positive === false
      ? "text-red-500"
      : "text-gray-900";

  const display = isPercent
    ? fmtPct(value)
    : value === null || value === undefined
    ? "N/A"
    : Math.abs(value) < 200
    ? `${value}%`
    : fmt(value);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 leading-tight">{label}</p>
      <p className={`text-xl font-extrabold ${color} leading-none`}>{display}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1.5 font-medium leading-tight">{sub}</p>}
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────
function Alert({ alerta }) {
  const cfg = {
    CRITICAL: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )},
    WARNING: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )},
    INFO: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
  };
  const c = cfg[alerta.tipo] || cfg.INFO;

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-4 flex items-start gap-3`}>
      <div className={`${c.text} mt-0.5 flex-shrink-0`}>{c.icon}</div>
      <div>
        <p className={`text-sm font-semibold ${c.text}`}>{alerta.mensaje}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">
          Código: {alerta.codigo}
          {alerta.umbral && ` · Umbral: ${fmt(alerta.umbral)}`}
        </p>
      </div>
    </div>
  );
}

// ─── Movement Row ─────────────────────────────────────────────────────────────
const MOV_CONFIG = {
  PAGO_RECIBIDO:    { label: "Pago recibido",    bg: "bg-emerald-100", text: "text-emerald-700", credit: true },
  DESEMBOLSO:       { label: "Desembolso",        bg: "bg-amber-100",   text: "text-amber-700",   credit: false },
  GASTO:            { label: "Gasto",             bg: "bg-red-100",     text: "text-red-700",     credit: false },
  INYECCION_CAPITAL:{ label: "Inyección capital", bg: "bg-blue-100",    text: "text-blue-700",    credit: true },
  RETIRO_GANANCIAS: { label: "Retiro ganancias",  bg: "bg-orange-100",  text: "text-orange-700",  credit: false },
  RETIRO_CAPITAL:   { label: "Retiro capital",    bg: "bg-red-100",     text: "text-red-700",     credit: false },
  CIERRE_CAJA:      { label: "Cierre caja",       bg: "bg-gray-100",    text: "text-gray-700",    credit: false },
  CORRECCION:       { label: "Corrección",        bg: "bg-purple-100",  text: "text-purple-700",  credit: false },
};

const MOV_ICONS = {
  PAGO_RECIBIDO: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  ),
  DESEMBOLSO: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  GASTO: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  INYECCION_CAPITAL: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  RETIRO_GANANCIAS: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3L22 4M16 6H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3" />
    </svg>
  ),
  RETIRO_CAPITAL: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  CIERRE_CAJA: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  CORRECCION: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

function MovRow({ mov }) {
  const c = MOV_CONFIG[mov.tipo] || MOV_CONFIG.CORRECCION;
  const icon = MOV_ICONS[mov.tipo] || MOV_ICONS.CORRECCION;
  const hora = new Date(mov.fecha).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{mov.descripcion || c.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-gray-400 font-medium">{hora}</p>
          {mov.usuario?.nombre && (
            <>
              <span className="text-gray-200">·</span>
              <p className="text-[11px] text-gray-400 font-medium">{mov.usuario.nombre}</p>
            </>
          )}
        </div>
        {(mov.interes > 0 || mov.mora > 0) && (
          <div className="flex items-center gap-3 mt-1.5">
            {mov.interes > 0 && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Int: {fmt(mov.interes)}
              </span>
            )}
            {mov.mora > 0 && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                Mora: {fmt(mov.mora)}
              </span>
            )}
          </div>
        )}
      </div>
      <p className={`text-sm font-bold flex-shrink-0 ${c.credit ? "text-emerald-600" : "text-red-500"}`}>
        {c.credit ? "+" : "−"}{fmt(mov.monto)}
      </p>
    </div>
  );
}

// ─── Resumen Row ──────────────────────────────────────────────────────────────
function ResRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{fmtFull(value)}</p>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Finanzas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMov, setLoadingMov] = useState(true);

  // Modals
  const [modal, setModal] = useState(null); // "inyeccion" | "retiro" | "retiroCapital"

  // Forms
  const [forms, setForms] = useState({
    inyeccion: { monto: "", concepto: "" },
    retiro: { monto: "", concepto: "" },
    retiroCapital: { monto: "", concepto: "" },
  });

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState(null);
  const [toast, setToast] = useState(null);

  const closeModal = () => {
    setModal(null);
    setErrorSubmit(null);
  };

  const patchForm = (key, patch) =>
    setForms((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/finanzas/dashboard");
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar datos financieros");
    } finally {
      setLoading(false);
    }

    setLoadingMov(true);
    try {
      const res = await api.get("/finanzas/movimientos?limite=50");
      setMovimientos(res.data || []);
    } catch {
      // silent
    } finally {
      setLoadingMov(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const submit = async (endpoint, formKey, successMsg, resetForm) => {
    setErrorSubmit(null);
    setLoadingSubmit(true);
    try {
      await api.post(endpoint, {
        monto: parseFloat(forms[formKey].monto),
        concepto: forms[formKey].concepto,
      });
      closeModal();
      resetForm();
      setToast({ message: successMsg, type: "success" });
      loadDashboard();
    } catch (err) {
      setErrorSubmit(err.response?.data?.message || "Ocurrió un error");
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Derived
  const capitalTotal     = data?.capital?.total         || 0;
  const capitalRetirable = data?.capital?.retirable      ?? 0;
  const gananciasVisuales   = data?.ganancias?.brutas   ?? 0;
  const gananciasDisponibles = data?.ganancias?.netas   ?? 0;
  const dineroEnCaja     = data?.dinero?.enCaja          || 0;
  const dineroEnCalle    = data?.dinero?.enCalle         || 0;
  const RESERVA          = 5000;
  const metricas         = data?.metricas                || {};
  const alertas          = data?.alertas                 || [];
  const resumen          = data?.resumen                 || {};
  const capital          = data?.capital                 || {};

  const montoIny = parseFloat(forms.inyeccion.monto) || 0;
  const montoRet = parseFloat(forms.retiro.monto) || 0;
  const montoRetCap = parseFloat(forms.retiroCapital.monto) || 0;

  // Group movements by date
  const movByDate = movimientos.reduce((acc, mov) => {
    const d = new Date(mov.fecha).toLocaleDateString("es-DO", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!acc[d]) acc[d] = [];
    acc[d].push(mov);
    return acc;
  }, {});

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-gray-900">Error al cargar</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-5 py-2.5 rounded-2xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ── Inyectar Capital ─────────────────────────────────────── */}
      <Sheet
        isOpen={modal === "inyeccion"}
        onClose={closeModal}
        title="Inyectar capital"
      >
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">Capital actual</p>
            <p className="text-xl font-extrabold text-blue-700">{fmt(capitalTotal)}</p>
          </div>
        </div>

        <MoneyInput
          label="Monto a inyectar"
          value={forms.inyeccion.monto}
          onChange={(e) => patchForm("inyeccion", { monto: e.target.value })}
          accentClass="border-blue-400"
        />
        <ConceptInput
          value={forms.inyeccion.concepto}
          onChange={(e) => patchForm("inyeccion", { concepto: e.target.value })}
          accentClass="border-blue-400"
          placeholder="Ej: Aumento de capital para nuevos préstamos"
        />

        {montoIny > 0 && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Nuevo capital total</p>
            <p className="text-base font-extrabold text-emerald-700">{fmt(capitalTotal + montoIny)}</p>
          </div>
        )}

        {errorSubmit && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
            <p className="text-sm text-red-600 font-medium">{errorSubmit}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={closeModal}
            className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all"
          >
            Cancelar
          </button>
          <ActionBtn
            color="blue"
            loading={loadingSubmit}
            disabled={montoIny <= 0 || !forms.inyeccion.concepto.trim()}
            onClick={() => submit("/finanzas/inyeccion", "inyeccion", "Capital inyectado correctamente", () => patchForm("inyeccion", { monto: "", concepto: "" }))}
          >
            Confirmar
          </ActionBtn>
        </div>
      </Sheet>

      {/* ── Retirar Ganancias ─────────────────────────────────────── */}
      <Sheet
        isOpen={modal === "retiro"}
        onClose={closeModal}
        title="Retirar ganancias"
      >
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Disponible para retirar</p>
            <p className="text-xl font-extrabold text-emerald-700">{fmt(gananciasDisponibles)}</p>
          </div>
        </div>

        <MoneyInput
          label="Monto a retirar"
          value={forms.retiro.monto}
          onChange={(e) => patchForm("retiro", { monto: e.target.value })}
          accentClass="border-emerald-400"
          max={gananciasDisponibles}
        />
        <ConceptInput
          value={forms.retiro.concepto}
          onChange={(e) => patchForm("retiro", { concepto: e.target.value })}
          accentClass="border-emerald-400"
          placeholder="Ej: Retiro ganancias mes de mayo"
        />

        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-700 font-medium">Las ganancias disponibles disminuirán tras el retiro.</p>
        </div>

        {errorSubmit && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
            <p className="text-sm text-red-600 font-medium">{errorSubmit}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={closeModal} className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">
            Cancelar
          </button>
          <ActionBtn
            color="emerald"
            loading={loadingSubmit}
            disabled={montoRet <= 0 || montoRet > gananciasDisponibles || !forms.retiro.concepto.trim()}
            onClick={() => submit("/finanzas/retiro", "retiro", "Retiro de ganancias realizado", () => patchForm("retiro", { monto: "", concepto: "" }))}
          >
            Confirmar retiro
          </ActionBtn>
        </div>
      </Sheet>

      {/* ── Retirar Capital ───────────────────────────────────────── */}
      <Sheet
        isOpen={modal === "retiroCapital"}
        onClose={closeModal}
        title="Retirar capital"
      >
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M10 6V4a2 2 0 012-2h4a2 2 0 012 2v2m0 0v6a2 2 0 01-2 2H6" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Capital retirable</p>
            <p className="text-xl font-extrabold text-amber-700">{fmt(capitalRetirable)}</p>
          </div>
        </div>

        {/* Mini breakdown */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">Capital total</span>
            <span className="font-bold text-gray-900">{fmt(capitalTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 font-medium">En operación + reserva</span>
            <span className="font-bold text-red-500">−{fmt(capitalTotal - capitalRetirable)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
            <span className="font-bold text-gray-700">Disponible</span>
            <span className="font-extrabold text-amber-600">{fmt(capitalRetirable)}</span>
          </div>
        </div>

        <MoneyInput
          label="Monto a retirar"
          value={forms.retiroCapital.monto}
          onChange={(e) => patchForm("retiroCapital", { monto: e.target.value })}
          accentClass="border-amber-400"
          max={capitalRetirable}
        />
        <ConceptInput
          value={forms.retiroCapital.concepto}
          onChange={(e) => patchForm("retiroCapital", { concepto: e.target.value })}
          accentClass="border-amber-400"
          placeholder="Ej: Retiro de capital para uso personal"
        />

        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-700 font-medium">Reducirá tu inversión total. No afecta préstamos ni caja activos.</p>
        </div>

        {errorSubmit && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5">
            <p className="text-sm text-red-600 font-medium">{errorSubmit}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={closeModal} className="flex-1 py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">
            Cancelar
          </button>
          <ActionBtn
            color="amber"
            loading={loadingSubmit}
            disabled={montoRetCap <= 0 || montoRetCap > capitalRetirable || !forms.retiroCapital.concepto.trim()}
            onClick={() => submit("/finanzas/retiro-capital", "retiroCapital", "Retiro de capital realizado", () => patchForm("retiroCapital", { monto: "", concepto: "" }))}
          >
            Confirmar retiro
          </ActionBtn>
        </div>
      </Sheet>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Finanzas</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-medium">Estado financiero de tu negocio</p>
          </div>
          <button
            onClick={loadDashboard}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
            title="Actualizar"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <button
            onClick={() => setModal("inyeccion")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-bold whitespace-nowrap flex-shrink-0 hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Inyectar
          </button>
          <button
            onClick={() => setModal("retiro")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold whitespace-nowrap flex-shrink-0 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shadow-emerald-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Ganancias
          </button>
          <button
            onClick={() => capitalRetirable > 0 && setModal("retiroCapital")}
            disabled={capitalRetirable <= 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap flex-shrink-0 transition-all ${
              capitalRetirable > 0
                ? "bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-sm shadow-amber-200"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M10 6V4a2 2 0 012-2h4a2 2 0 012 2v2m0 0v6a2 2 0 01-2 2H6" />
            </svg>
            Capital
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Sk h="h-28" /> <Sk h="h-28" /> <Sk h="h-28" /> <Sk h="h-28" />
            </div>
            <Sk h="h-52" />
            <Sk h="h-36" />
            <div className="grid grid-cols-2 gap-3">
              <Sk h="h-24" /> <Sk h="h-24" /> <Sk h="h-24" /> <Sk h="h-24" />
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Capital"
                value={fmt(capitalTotal)}
                sub={capital.tieneCapitalRegistrado ? "Tu inversión total" : "Sin registrar"}
                colorClass="bg-blue-50"
                delay={0}
                icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <KpiCard
                label="Ganancias"
                value={fmt(gananciasVisuales)}
                sub="Generadas por el negocio"
                colorClass="bg-emerald-50"
                delay={60}
                icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              />
              <KpiCard
                label="En caja"
                value={fmt(dineroEnCaja)}
                sub="Disponible hoy"
                colorClass="bg-green-50"
                delay={120}
                icon={<svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>}
              />
              <KpiCard
                label="En calle"
                value={fmt(dineroEnCalle)}
                sub="Prestado a clientes"
                colorClass="bg-orange-50"
                delay={180}
                icon={<svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              />
            </div>

            {/* Capital Breakdown */}
            <CapitalBreakdown
              capitalTotal={capitalTotal}
              capitalRetirable={capitalRetirable}
              dineroEnCaja={dineroEnCaja}
              dineroEnCalle={dineroEnCalle}
              reservaOperativa={RESERVA}
            />

            {/* Patrimonio */}
            <DistributionBar capital={capitalTotal} ganancias={gananciasDisponibles} />

            {/* Métricas */}
            <div>
              <SectionHeader title="Indicadores" />
              <div className="grid grid-cols-2 gap-3">
                <MetricChip
                  label="Rentabilidad"
                  value={metricas.rentabilidad}
                  sub="Sobre tu capital"
                  positive={metricas.rentabilidad > 0}
                />
                <MetricChip
                  label="Eficiencia"
                  value={metricas.eficienciaCobranza}
                  sub="Cobrado vs esperado"
                  positive={metricas.eficienciaCobranza > 80}
                />
                <MetricChip
                  label="Dinero ocioso"
                  value={metricas.dineroOcioso}
                  sub="Sin generar retorno"
                  positive={metricas.dineroOcioso === 0}
                />
                <MetricChip
                  label="Crecimiento"
                  value={metricas.crecimientoMensual}
                  sub="Vs mes anterior"
                  positive={metricas.crecimientoMensual >= 0}
                />
              </div>
            </div>

            {/* Alertas */}
            {alertas.length > 0 && (
              <div>
                <SectionHeader title="Alertas" />
                <div className="space-y-2">
                  {alertas.map((a, i) => <Alert key={i} alerta={a} />)}
                </div>
              </div>
            )}

            {/* Resumen financiero */}
            <div>
              <SectionHeader title="Resumen financiero" />
              <div className="bg-white rounded-2xl border border-gray-100 px-5 py-2 divide-y divide-gray-50">
                <ResRow label="Total cobrado"      value={resumen.totalCobrado}    color="text-emerald-600" />
                <ResRow label="Total gastado"      value={resumen.totalGastos}     color="text-red-500" />
                <ResRow label="Balance neto"       value={resumen.balanceNeto}     color={resumen.balanceNeto >= 0 ? "text-blue-600" : "text-red-500"} />
                <ResRow label="Total desembolsado" value={resumen.totalDesembolsos} color="text-orange-600" />
                {resumen.totalInteres !== undefined && (
                  <>
                    <ResRow label="Interés total" value={resumen.totalInteres} color="text-amber-600" />
                    <ResRow label="Mora total"    value={resumen.totalMora}    color="text-red-500" />
                  </>
                )}
              </div>
            </div>

            {/* Capital Details */}
            {capital.tieneCapitalRegistrado && (
              <div>
                <SectionHeader title="Detalles del capital" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">Capital inicial</p>
                    <p className="text-xl font-extrabold text-blue-700">{fmt(capital.inicial)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Inyecciones</p>
                    <p className="text-xl font-extrabold text-emerald-700">{fmt(capital.totalInyecciones)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamp */}
            {data.timestamp && (
              <p className="text-[11px] text-gray-300 text-center font-medium">
                Actualizado {new Date(data.timestamp).toLocaleString("es-DO")}
              </p>
            )}

            {/* Movimientos */}
            <div>
              <SectionHeader title="Movimientos" />
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {loadingMov ? (
                  <div className="p-5 space-y-3">
                    {[...Array(4)].map((_, i) => <Sk key={i} h="h-14" />)}
                  </div>
                ) : movimientos.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400 font-medium">Sin movimientos registrados</p>
                  </div>
                ) : (
                  <div className="max-h-[28rem] overflow-y-auto overscroll-contain">
                    {Object.entries(movByDate).map(([fecha, movs]) => (
                      <div key={fecha}>
                        <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm px-5 py-2.5 border-b border-gray-100 border-t first:border-t-0">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{fecha}</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {movs.map((mov) => <MovRow key={mov.id} mov={mov} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}