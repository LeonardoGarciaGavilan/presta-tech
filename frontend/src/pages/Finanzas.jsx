// Finanzas.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import api from "../services/api";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";

// ─── Inyectar animaciones ─────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("finanzas-styles")) {
  const s = document.createElement("style");
  s.id = "finanzas-styles";
  s.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hoy          = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const hace6Meses   = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const fmtCurrency = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n);
const fmtCurrencyFull = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n);

const MESES_OPTS = [
  { value: "3",  label: "Últimos 3 meses"  },
  { value: "6",  label: "Últimos 6 meses"  },
  { value: "12", label: "Últimos 12 meses" },
  { value: "custom", label: "Rango personalizado" },
];

const CATEGORIA_COLORES = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#84cc16","#f97316","#ec4899","#6b7280",
];

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:w-auto z-[9999]
      flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium
      ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                           : "bg-red-50 border-red-200 text-red-800"}`}>
      {type === "success" ? "✅" : "❌"} {message}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ className }) => <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, accent, icon, delay = 0, positive }) => (
  <div
    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
    style={{ animation: `fadeUp 0.4s ease ${delay}ms both` }}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${accent}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
    </div>
    <p className={`text-xl sm:text-2xl font-bold leading-tight break-all
      ${positive === undefined ? "text-gray-900" : positive ? "text-emerald-600" : "text-red-600"}`}>
      {value}
    </p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ─── Tooltip personalizado ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[160px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </span>
          <span className="font-bold" style={{ color: p.color }}>{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Exportar Excel ───────────────────────────────────────────────────────────
const exportarExcel = (data, desde, hasta) => {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen mensual
  const resumenData = data.meses.map((m) => ({
    "Mes":            m.mes,
    "Cobrado (RD$)":  m.cobrado,
    "Gastado (RD$)":  m.gastado,
    "Balance (RD$)":  m.balance,
    "Capital":        m.capital,
    "Interés":        m.interes,
    "Mora":           m.mora,
    "Pagos":          m.cantidadPagos,
    "Gastos":         m.cantidadGastos,
  }));
  // Fila de totales
  resumenData.push({
    "Mes":            "TOTAL",
    "Cobrado (RD$)":  data.totales.totalCobrado,
    "Gastado (RD$)":  data.totales.totalGastado,
    "Balance (RD$)":  data.totales.totalBalance,
    "Capital":        data.totales.totalCapital,
    "Interés":        data.totales.totalInteres,
    "Mora":           data.totales.totalMora,
    "Pagos":          data.totales.totalPagos,
    "Gastos":         data.totales.totalGastos,
  });

  const ws1 = XLSX.utils.json_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen Mensual");

  // Hoja 2: Gastos por categoría
  const catData = Object.entries(data.porCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, monto]) => ({
      "Categoría":   cat,
      "Total (RD$)": monto,
      "% del total": data.totales.totalGastado > 0
        ? `${((monto / data.totales.totalGastado) * 100).toFixed(1)}%`
        : "0%",
    }));
  const ws2 = XLSX.utils.json_to_sheet(catData);
  XLSX.utils.book_append_sheet(wb, ws2, "Gastos por Categoría");

  XLSX.writeFile(wb, `Finanzas_${desde}_${hasta}.xlsx`);
};

// ─── Exportar PDF ─────────────────────────────────────────────────────────────
const exportarPDF = (ref, empresa, desde, hasta, totales) => {
  const fmtFecha = (f) => new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(f + "T12:00:00"));

  const ventana = window.open("", "_blank", "width=1000,height=700");
  ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Finanzas ${empresa}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:28px;font-size:12px}
      h1{font-size:20px;font-weight:800;margin-bottom:4px}
      p.sub{color:#64748b;font-size:11px;margin-bottom:20px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
      .card .val{font-size:18px;font-weight:800}.card .lbl{font-size:10px;color:#94a3b8;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0}
      td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
      .right{text-align:right}.pos{color:#16a34a;font-weight:700}.neg{color:#dc2626;font-weight:700}
      tfoot td{font-weight:800;background:#f1f5f9;font-size:11px}
      .footer{margin-top:24px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
      @media print{@page{margin:12mm}}
    </style></head><body>
    <h1>📊 Estado Financiero — ${empresa}</h1>
    <p class="sub">Período: ${fmtFecha(desde)} – ${fmtFecha(hasta)} · Generado el ${new Intl.DateTimeFormat("es-DO",{day:"2-digit",month:"long",year:"numeric"}).format(new Date())}</p>
    <div class="grid">
      <div class="card"><div class="val" style="color:#16a34a">RD$ ${totales.totalCobrado.toLocaleString("es-DO",{minimumFractionDigits:2})}</div><div class="lbl">Total cobrado</div></div>
      <div class="card"><div class="val" style="color:#dc2626">RD$ ${totales.totalGastado.toLocaleString("es-DO",{minimumFractionDigits:2})}</div><div class="lbl">Total gastado</div></div>
      <div class="card"><div class="val" style="color:${totales.totalBalance>=0?"#2563eb":"#dc2626"}">RD$ ${totales.totalBalance.toLocaleString("es-DO",{minimumFractionDigits:2})}</div><div class="lbl">Balance neto</div></div>
      <div class="card"><div class="val" style="color:#7c3aed">${totales.margenPct}%</div><div class="lbl">Margen operacional</div></div>
    </div>
    ${ref.current?.innerHTML ?? ""}
    <div class="footer">${empresa} · Reporte Financiero · ${new Date().toLocaleDateString("es-DO")}</div>
  </body></html>`);
  ventana.document.close();
  setTimeout(() => { ventana.print(); ventana.close(); }, 400);
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Finanzas() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);
  const [periodo, setPeriodo] = useState("6");
  const [desde,   setDesde]   = useState(hace6Meses());
  const [hasta,   setHasta]   = useState(hoy());
  const [vista,   setVista]   = useState("barras"); // barras | area | tabla
  const contenidoRef = useRef(null);

  const empresa = JSON.parse(localStorage.getItem("user") || "{}").empresa || "Mi Empresa";
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/finanzas/resumen";
      if (periodo === "custom") {
        url += `?desde=${desde}&hasta=${hasta}`;
      } else {
        url += `?meses=${periodo}`;
      }
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al cargar finanzas", "error");
    } finally {
      setLoading(false);
    }
  }, [periodo, desde, hasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Top categorías para gráfico de dona ────────────────────────────────────
  const topCats = useMemo(() => {
    if (!data?.porCategoria) return [];
    return Object.entries(data.porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [data]);

  const totalCats = topCats.reduce((s, [, v]) => s + v, 0);

  // ─── Datos para gráficas ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data?.meses) return [];
    return data.meses.map((m) => ({
      mes:    m.mes,
      cobrado: m.cobrado,
      gastado: m.gastado,
      balance: m.balance,
    }));
  }, [data]);

  const t = data?.totales;

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Finanzas</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Cobros vs gastos — balance operacional</p>
          </div>

          {/* Acciones export */}
          {data && (
            <div className="flex gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => exportarExcel(data,
                  periodo === "custom" ? desde : data.periodo.desde,
                  periodo === "custom" ? hasta : data.periodo.hasta,
                )}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel
              </button>
              <button
                onClick={() => exportarPDF(contenidoRef, empresa,
                  data.periodo.desde, data.periodo.hasta, t,
                )}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                PDF
              </button>
            </div>
          )}
        </div>

        {/* ── Filtros de período ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-2 items-end">
            {/* Botones rápidos */}
            <div className="flex flex-wrap gap-1.5">
              {MESES_OPTS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPeriodo(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${periodo === o.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {/* Rango personalizado */}
            {periodo === "custom" && (
              <div className="flex gap-2 flex-wrap">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Desde</label>
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1">Hasta</label>
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {/* Selector de vista de gráfica */}
            <div className="ml-auto flex gap-1.5">
              {[
                { key: "barras", icon: "▤", title: "Barras agrupadas" },
                { key: "area",   icon: "◿", title: "Área comparativa" },
                { key: "tabla",  icon: "☰", title: "Tabla detallada"  },
              ].map((v) => (
                <button key={v.key} title={v.title} onClick={() => setVista(v.key)}
                  className={`w-8 h-8 rounded-lg text-sm transition-all
                    ${vista === v.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {v.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Skeleton ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Sk key={i} className="h-24" />)}
            </div>
            <Sk className="h-72" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Sk className="lg:col-span-2 h-64" />
              <Sk className="h-64" />
            </div>
          </div>
        )}

        {/* ── Contenido ──────────────────────────────────────────────────────── */}
        {!loading && data && (
          <div ref={contenidoRef} className="space-y-4 sm:space-y-5">

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Total cobrado"
                value={fmtCurrencyFull(t.totalCobrado)}
                sub={`${t.totalPagos} pagos`}
                icon="💰" accent="bg-emerald-50" delay={0}
                positive={true}
              />
              <KpiCard
                label="Total gastado"
                value={fmtCurrencyFull(t.totalGastado)}
                sub={`${t.totalGastos} gastos`}
                icon="💸" accent="bg-red-50" delay={60}
                positive={false}
              />
              <KpiCard
                label="Balance neto"
                value={fmtCurrencyFull(t.totalBalance)}
                sub={t.totalBalance >= 0 ? "Superávit ✅" : "Déficit ⚠️"}
                icon="⚖️" accent="bg-blue-50" delay={120}
                positive={t.totalBalance >= 0}
              />
              <KpiCard
                label="Margen operacional"
                value={`${t.margenPct}%`}
                sub="sobre lo cobrado"
                icon="📈" accent="bg-violet-50" delay={180}
                positive={t.margenPct >= 0}
              />
            </div>

            {/* ── Stats secundarias ── */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3"
              style={{ animation: "fadeUp 0.4s ease 0.2s both" }}>
              {[
                { label: "Capital",  value: fmtCurrency(t.totalCapital), color: "text-blue-600"   },
                { label: "Interés",  value: fmtCurrency(t.totalInteres), color: "text-amber-600"  },
                { label: "Mora",     value: fmtCurrency(t.totalMora),    color: "text-red-600"    },
                { label: "Pagos",    value: t.totalPagos,                color: "text-gray-800"   },
                { label: "Gastos",   value: t.totalGastos,               color: "text-gray-800"   },
                { label: "Meses",    value: data.meses.length,           color: "text-violet-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 px-2 py-2.5 sm:px-3 text-center shadow-sm">
                  <p className={`text-sm sm:text-base font-bold ${color}`}>{value}</p>
                  <p className="text-[9px] sm:text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* ── Gráfica principal ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
              style={{ animation: "fadeUp 0.4s ease 0.25s both" }}>
              <h2 className="text-sm font-bold text-gray-700 mb-4">
                {vista === "barras" ? "Cobros vs Gastos por mes" :
                 vista === "area"   ? "Evolución comparativa" :
                                     "Resumen mensual detallado"}
              </h2>

              {/* ── Vista BARRAS ── */}
              {vista === "barras" && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="cobrado" name="Cobrado" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="gastado" name="Gastado" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="balance" name="Balance" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={40}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.balance >= 0 ? "#3b82f6" : "#f97316"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* ── Vista ÁREA ── */}
              {vista === "area" && (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradGastado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Area type="monotone" dataKey="cobrado" name="Cobrado" stroke="#10b981"
                      strokeWidth={2.5} fill="url(#gradCobrado)" dot={{ fill: "#10b981", r: 3 }} />
                    <Area type="monotone" dataKey="gastado" name="Gastado" stroke="#ef4444"
                      strokeWidth={2.5} fill="url(#gradGastado)" dot={{ fill: "#ef4444", r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* ── Vista TABLA ── */}
              {vista === "tabla" && (
                <>
                  {/* DESKTOP */}
                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-400 tracking-wide">
                          <th className="px-4 py-3 text-left font-semibold">Mes</th>
                          <th className="px-4 py-3 text-right font-semibold">Cobrado</th>
                          <th className="px-4 py-3 text-right font-semibold">Capital</th>
                          <th className="px-4 py-3 text-right font-semibold">Interés</th>
                          <th className="px-4 py-3 text-right font-semibold">Mora</th>
                          <th className="px-4 py-3 text-right font-semibold">Gastado</th>
                          <th className="px-4 py-3 text-right font-semibold">Balance</th>
                          <th className="px-4 py-3 text-right font-semibold">Margen</th>
                          <th className="px-4 py-3 text-right font-semibold">Pagos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.meses.map((m, i) => {
                          const margen = m.cobrado > 0
                            ? Math.round((m.balance / m.cobrado) * 1000) / 10
                            : 0;
                          return (
                            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-3 font-semibold text-gray-700">{m.mes}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtCurrencyFull(m.cobrado)}</td>
                              <td className="px-4 py-3 text-right text-blue-600">{fmtCurrencyFull(m.capital)}</td>
                              <td className="px-4 py-3 text-right text-amber-600">{fmtCurrencyFull(m.interes)}</td>
                              <td className="px-4 py-3 text-right text-red-500 text-xs">{m.mora > 0 ? fmtCurrencyFull(m.mora) : "—"}</td>
                              <td className="px-4 py-3 text-right font-bold text-red-600">{fmtCurrencyFull(m.gastado)}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-bold ${m.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                                  {fmtCurrencyFull(m.balance)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                                  ${margen >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                  {margen}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-500 text-xs">{m.cantidadPagos}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td className="px-4 py-3 text-xs font-bold text-gray-600">TOTAL</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">{fmtCurrencyFull(t.totalCobrado)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-blue-600">{fmtCurrencyFull(t.totalCapital)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-amber-600">{fmtCurrencyFull(t.totalInteres)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{fmtCurrencyFull(t.totalMora)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-red-700">{fmtCurrencyFull(t.totalGastado)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold">
                            <span className={t.totalBalance >= 0 ? "text-blue-700" : "text-red-700"}>
                              {fmtCurrencyFull(t.totalBalance)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold">
                            <span className={t.margenPct >= 0 ? "text-emerald-700" : "text-red-700"}>
                              {t.margenPct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-gray-600">{t.totalPagos}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* MÓVIL */}
                  <div className="sm:hidden space-y-2">
                    {data.meses.map((m, i) => {
                      const margen = m.cobrado > 0
                        ? Math.round((m.balance / m.cobrado) * 1000) / 10
                        : 0;
                      return (
                        <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-700">{m.mes}</p>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                              ${margen >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                              {margen}% margen
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                            <div className="bg-emerald-50 rounded p-1.5 text-center">
                              <p className="text-emerald-400">Cobrado</p>
                              <p className="font-bold text-emerald-700">{fmtCurrency(m.cobrado)}</p>
                            </div>
                            <div className="bg-red-50 rounded p-1.5 text-center">
                              <p className="text-red-400">Gastado</p>
                              <p className="font-bold text-red-600">{fmtCurrency(m.gastado)}</p>
                            </div>
                            <div className={`rounded p-1.5 text-center ${m.balance >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
                              <p className={m.balance >= 0 ? "text-blue-400" : "text-orange-400"}>Balance</p>
                              <p className={`font-bold ${m.balance >= 0 ? "text-blue-700" : "text-orange-600"}`}>
                                {fmtCurrency(m.balance)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 text-[10px] text-gray-400">
                            <span>Cap: {fmtCurrency(m.capital)}</span>
                            <span>·</span>
                            <span>Int: {fmtCurrency(m.interes)}</span>
                            {m.mora > 0 && <><span>·</span><span className="text-red-500">Mora: {fmtCurrency(m.mora)}</span></>}
                            <span className="ml-auto">{m.cantidadPagos} pagos</span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Total móvil */}
                    <div className="border-2 border-blue-200 bg-blue-50/30 rounded-xl p-3 space-y-2">
                      <p className="font-bold text-blue-800 text-xs">TOTAL DEL PERÍODO</p>
                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div className="bg-emerald-50 rounded p-1.5 text-center">
                          <p className="text-emerald-400">Cobrado</p>
                          <p className="font-bold text-emerald-700">{fmtCurrency(t.totalCobrado)}</p>
                        </div>
                        <div className="bg-red-50 rounded p-1.5 text-center">
                          <p className="text-red-400">Gastado</p>
                          <p className="font-bold text-red-600">{fmtCurrency(t.totalGastado)}</p>
                        </div>
                        <div className={`rounded p-1.5 text-center ${t.totalBalance >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
                          <p className={t.totalBalance >= 0 ? "text-blue-400" : "text-orange-400"}>Balance</p>
                          <p className={`font-bold ${t.totalBalance >= 0 ? "text-blue-700" : "text-orange-600"}`}>
                            {fmtCurrency(t.totalBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Fila inferior: gastos por categoría + balance visual ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5"
              style={{ animation: "fadeUp 0.4s ease 0.3s both" }}>

              {/* ── Gastos por categoría ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <h2 className="text-sm font-bold text-gray-700 mb-4">Gastos por categoría</h2>
                {topCats.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sin gastos</div>
                ) : (
                  <div className="space-y-3">
                    {topCats.map(([cat, monto], i) => {
                      const pct = totalCats > 0 ? (monto / totalCats) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 truncate mr-2 max-w-[55%]">{cat}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-gray-400">{pct.toFixed(0)}%</span>
                              <span className="text-xs font-bold text-gray-800">{fmtCurrency(monto)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: CATEGORIA_COLORES[i % CATEGORIA_COLORES.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Total gastos</span>
                      <span className="font-bold text-red-600">{fmtCurrencyFull(t.totalGastado)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Balance visual + desglose cobros ── */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <h2 className="text-sm font-bold text-gray-700 mb-4">Desglose de cobros</h2>

                {/* Barra de desglose */}
                <div className="mb-5">
                  <div className="flex h-6 rounded-xl overflow-hidden gap-0.5">
                    {t.totalCobrado > 0 && [
                      { label: "Capital", val: t.totalCapital, color: "#3b82f6" },
                      { label: "Interés", val: t.totalInteres, color: "#f59e0b" },
                      { label: "Mora",    val: t.totalMora,    color: "#ef4444" },
                    ].filter(s => s.val > 0).map((seg) => (
                      <div
                        key={seg.label}
                        className="h-full transition-all duration-700"
                        style={{
                          width: `${(seg.val / t.totalCobrado) * 100}%`,
                          background: seg.color,
                        }}
                        title={`${seg.label}: ${fmtCurrencyFull(seg.val)}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-4 mt-2 flex-wrap">
                    {[
                      { label: "Capital", val: t.totalCapital, color: "bg-blue-500"  },
                      { label: "Interés", val: t.totalInteres, color: "bg-amber-400" },
                      { label: "Mora",    val: t.totalMora,    color: "bg-red-500"   },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                        {s.label}: <span className="font-semibold text-gray-800">{fmtCurrencyFull(s.val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Semáforo financiero */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      titulo: "Mejor mes",
                      valor:  data.meses.length ? data.meses.reduce((a, b) => a.balance > b.balance ? a : b) : null,
                      color:  "border-emerald-200 bg-emerald-50",
                      tColor: "text-emerald-700",
                    },
                    {
                      titulo: "Mes más reciente",
                      valor:  data.meses.length ? data.meses[data.meses.length - 1] : null,
                      color:  "border-blue-200 bg-blue-50",
                      tColor: "text-blue-700",
                    },
                    {
                      titulo: "Peor mes",
                      valor:  data.meses.length ? data.meses.reduce((a, b) => a.balance < b.balance ? a : b) : null,
                      color:  "border-red-200 bg-red-50",
                      tColor: "text-red-700",
                    },
                  ].map(({ titulo, valor, color, tColor }) => (
                    <div key={titulo} className={`rounded-xl border p-3 ${color}`}>
                      <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1">{titulo}</p>
                      {valor ? (
                        <>
                          <p className="text-xs font-bold text-gray-700">{valor.mes}</p>
                          <p className={`text-sm font-bold mt-0.5 ${tColor}`}>
                            {fmtCurrencyFull(valor.balance)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            ↑ {fmtCurrency(valor.cobrado)} · ↓ {fmtCurrency(valor.gastado)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">Sin datos</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Estado vacío ── */}
        {!loading && !data && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📊</div>
            <p className="font-medium text-gray-500">Cargando datos financieros…</p>
          </div>
        )}
      </div>
    </>
  );
}