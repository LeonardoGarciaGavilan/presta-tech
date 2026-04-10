// src/pages/Amortizacion.jsx
// Simulador de tabla de amortización + vista de préstamo existente
import { useState, useMemo, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { calcularAmortizacion as calcularAmortizacionUtils } from "../utils/prestamosUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n = 0) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency", currency: "DOP", minimumFractionDigits: 2,
  }).format(n);

const fmtShort = (n = 0) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency", currency: "DOP", minimumFractionDigits: 0,
  }).format(n);

const FRECUENCIAS = [
  { value: "DIARIO",    label: "Diario"    },
  { value: "SEMANAL",   label: "Semanal"   },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "MENSUAL",   label: "Mensual"   },
];

// ─── Tooltip personalizado ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">Cuota #{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmtShort(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Input numérico ───────────────────────────────────────────────────────────
const NumInput = ({ label, value, onChange, prefix, suffix, min, max, step = "1", hint }) => (
  <div>
    <label className="block text-xs font-bold text-gray-600 mb-1.5">{label}</label>
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white transition-all">
      {prefix && <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm font-semibold border-r border-gray-200 shrink-0">{prefix}</span>}
      <input
        type="number" value={value} onChange={(e) => onChange(e.target.value)}
        min={min} max={max} step={step}
        className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white font-medium text-gray-800"
      />
      {suffix && <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-l border-gray-200 shrink-0">{suffix}</span>}
    </div>
    {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Amortizacion() {
  const [monto,        setMonto]        = useState("50000");
  const [tasaInteres,  setTasaInteres]  = useState("5");
  const [numeroCuotas, setNumeroCuotas] = useState("12");
  const [frecuencia,   setFrecuencia]   = useState("MENSUAL");
  const [fechaInicio,  setFechaInicio]  = useState(new Date().toISOString().slice(0, 10));
  const [mostrarTabla, setMostrarTabla] = useState(false);
  const [vistaGrafico, setVistaGrafico] = useState("barra");

  // En móvil: alterna entre panel de parámetros y resultados
  const [panelMobile, setPanelMobile] = useState("params"); // "params" | "results"

  const resultado = useMemo(() => {
    const m = parseFloat(monto)       || 0;
    const t = parseFloat(tasaInteres) || 0;
    const n = parseInt(numeroCuotas)  || 0;
    if (m <= 0 || t <= 0 || n <= 0) return null;
    const r = calcularAmortizacionUtils(m, t, n, frecuencia);
    return {
      cuotas:         r.cuotas,
      cuotaFija:      r.cuotaInicial,
      totalPagar:     r.montoTotal,
      totalIntereses: r.totalIntereses,
      totalCapital:   m,
    };
  }, [monto, tasaInteres, numeroCuotas, frecuencia]);

  const datosGrafico = useMemo(() => {
    if (!resultado) return [];
    const { cuotas } = resultado;
    const paso = cuotas.length > 24 ? Math.ceil(cuotas.length / 24) : 1;
    return cuotas
      .filter((_, i) => i % paso === 0 || i === cuotas.length - 1)
      .map((c) => ({
        name:    c.numero,
        Capital: Math.round(c.capital      * 100) / 100,
        Interés: Math.round(c.interes      * 100) / 100,
        Saldo:   Math.round(c.saldoRestante * 100) / 100,
      }));
  }, [resultado]);

  const handleSimular = useCallback(() => {
    if (resultado) { setMostrarTabla(true); setPanelMobile("results"); }
  }, [resultado]);

  const fmtFecha = (d) =>
    new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tabla de Amortización</h1>
          <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">Simula un préstamo y visualiza el plan de pagos completo</p>
        </div>
      </div>

      {/* ── Tabs móvil ── */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white xl:hidden">
        <button onClick={() => setPanelMobile("params")}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${panelMobile==="params" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          Parámetros
        </button>
        <button onClick={() => setPanelMobile("results")} disabled={!resultado}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${panelMobile==="results" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          Resultados {resultado ? `(${resultado.cuotas.length})` : ""}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ════════════════════════════
            PANEL IZQUIERDO — Parámetros
        ════════════════════════════ */}
        <div className={`xl:col-span-1 space-y-4 ${panelMobile==="params" ? "block" : "hidden xl:block"}`}>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Parámetros del préstamo</h2>
            <div className="space-y-4">

              {/* En móvil, los 2 primeros inputs van en grid de 2 columnas para ahorrar espacio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                <NumInput label="Monto del préstamo"        value={monto}        onChange={setMonto}        prefix="RD$" min="1"   step="1000" />
                <NumInput label="Tasa de interés mensual"   value={tasaInteres}  onChange={setTasaInteres}  suffix="%"   min="0.1" max="100" step="0.5" hint="Porcentaje mensual sobre el capital" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                <NumInput label="Número de cuotas" value={numeroCuotas} onChange={setNumeroCuotas} min="1" max="360" step="1" />

                {/* Frecuencia */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Frecuencia de pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FRECUENCIAS.map((f) => (
                      <button key={f.value} onClick={() => setFrecuencia(f.value)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          frecuencia === f.value
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                        }`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fecha inicio */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Fecha de inicio</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium text-gray-800" />
              </div>

              <button onClick={handleSimular} disabled={!resultado}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                📊 Calcular tabla
              </button>
            </div>
          </div>

          {/* Resumen rápido */}
          {resultado && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resumen</h2>
              {/* En móvil mostramos en grid 2 cols para compactar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                {[
                  { label: "Cuota estimada",  value: fmt(resultado.cuotaFija),      color: "text-blue-600",    bg: "bg-blue-50"    },
                  { label: "Total a pagar",   value: fmt(resultado.totalPagar),     color: "text-gray-800",    bg: "bg-gray-50"    },
                  { label: "Total capital",   value: fmt(resultado.totalCapital),   color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Total intereses", value: fmt(resultado.totalIntereses), color: "text-amber-600",   bg: "bg-amber-50"   },
                  { label: "Costo financiero",
                    value: `${((resultado.totalIntereses / parseFloat(monto || 1)) * 100).toFixed(1)}%`,
                    color: "text-red-600", bg: "bg-red-50" },
                ].map((k) => (
                  <div key={k.label} className={`${k.bg} rounded-xl px-3 py-2.5 flex items-center justify-between`}>
                    <span className="text-xs font-semibold text-gray-500">{k.label}</span>
                    <span className={`text-sm font-bold ${k.color}`}>{k.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════
            PANEL DERECHO — Gráfico + Tabla
        ════════════════════════════ */}
        <div className={`xl:col-span-2 space-y-4 ${panelMobile==="results" ? "block" : "hidden xl:block"}`}>

          {!mostrarTabla && !resultado && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-24 text-gray-400">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-base font-semibold text-gray-500">Configura los parámetros y presiona</p>
              <p className="text-sm mt-1 font-bold text-blue-600">Calcular tabla</p>
            </div>
          )}

          {resultado && (
            <>
              {/* Gráfico */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Distribución Capital vs Interés</h2>
                  <div className="flex gap-1 shrink-0">
                    {[
                      { id: "barra", label: "Barras" },
                      { id: "area",  label: "Área"   },
                    ].map((v) => (
                      <button key={v.id} onClick={() => setVistaGrafico(v.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                          vistaGrafico === v.id
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
                        }`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-48 sm:h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    {vistaGrafico === "barra" ? (
                      <BarChart data={datosGrafico} barSize={6}>
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Capital" fill="#3b82f6" radius={[3,3,0,0]} />
                        <Bar dataKey="Interés" fill="#f59e0b" radius={[3,3,0,0]} />
                      </BarChart>
                    ) : (
                      <AreaChart data={datosGrafico}>
                        <defs>
                          <linearGradient id="gCap" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                          <linearGradient id="gInt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                          <linearGradient id="gSal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                        </defs>
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="Saldo"   stroke="#10b981" fill="url(#gSal)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="Capital" stroke="#3b82f6" fill="url(#gCap)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="Interés" stroke="#f59e0b" fill="url(#gInt)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabla de amortización */}
              {mostrarTabla && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Plan de pagos — {resultado.cuotas.length} cuotas
                    </h2>
                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg font-mono shrink-0">
                      {FRECUENCIAS.find(f => f.value === frecuencia)?.label}
                    </span>
                  </div>

                  {/* Tabla: sm en adelante */}
                  <div className="hidden sm:block overflow-x-auto max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-100">
                          {["#", "Fecha", "Capital", "Interés", "Cuota", "Saldo restante"].map((h, i) => (
                            <th key={h} className={`px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] ${i >= 2 ? "text-right" : "text-left"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {resultado.cuotas.map((c, i) => (
                          <tr key={c.numero} className={`${i%2===0?"bg-white":"bg-gray-50/50"} hover:bg-blue-50/40 transition-colors`}>
                            <td className="px-4 py-2.5 font-mono font-bold text-gray-400">{c.numero}</td>
                            <td className="px-4 py-2.5 text-gray-600">{fmtFecha(c.fechaVencimiento)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-blue-600">{fmt(c.capital)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-amber-600">{fmt(c.interes)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-gray-800">{fmt(c.monto)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmt(c.saldoRestante)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-200">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Totales</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-blue-700">{fmt(resultado.totalCapital)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-amber-700">{fmt(resultado.totalIntereses)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-gray-800">{fmt(resultado.totalPagar)}</td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Tarjetas: solo móvil */}
                  <div className="sm:hidden max-h-[480px] overflow-y-auto divide-y divide-gray-50">
                    {resultado.cuotas.map((c, i) => (
                      <div key={c.numero} className={`px-4 py-3 ${i%2===0?"bg-white":"bg-gray-50/50"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{c.numero}</span>
                            <span className="text-xs text-gray-500">{fmtFecha(c.fechaVencimiento)}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-800">{fmt(c.monto)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          <div className="bg-blue-50 rounded-lg p-1.5 text-center">
                            <p className="text-blue-400">Capital</p>
                            <p className="font-bold text-blue-700">{fmt(c.capital)}</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-1.5 text-center">
                            <p className="text-amber-400">Interés</p>
                            <p className="font-bold text-amber-700">{fmt(c.interes)}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-1.5 text-center">
                            <p className="text-emerald-400">Saldo</p>
                            <p className="font-bold text-emerald-700">{fmt(c.saldoRestante)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Total al pie en móvil */}
                    <div className="px-4 py-3 bg-gray-100 border-t-2 border-gray-200">
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">Totales</p>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div className="bg-white rounded-lg p-1.5 text-center"><p className="text-gray-400">Capital</p><p className="font-bold text-blue-700">{fmt(resultado.totalCapital)}</p></div>
                        <div className="bg-white rounded-lg p-1.5 text-center"><p className="text-gray-400">Intereses</p><p className="font-bold text-amber-700">{fmt(resultado.totalIntereses)}</p></div>
                        <div className="bg-white rounded-lg p-1.5 text-center"><p className="text-gray-400">Total</p><p className="font-bold text-gray-800">{fmt(resultado.totalPagar)}</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}