// src/components/RefinanciarModal.jsx
import { useState, useMemo } from "react";
import api from "../services/api";

const fmt = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style:"currency", currency:"DOP", minimumFractionDigits:2 }).format(n);
const fmtFecha = (d) =>
  new Intl.DateTimeFormat("es-DO", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d));

const FRECUENCIAS = {
  DIARIO:    { label:"Diario",    dias:1  },
  SEMANAL:   { label:"Semanal",   dias:7  },
  QUINCENAL: { label:"Quincenal", dias:15 },
  MENSUAL:   { label:"Mensual",   dias:30 },
};

function calcularPreview({ saldo, tasa, cuotas, frecuencia, fechaBase }) {
  if (!saldo || !tasa || !cuotas || saldo <= 0 || tasa <= 0 || cuotas <= 0) return null;
  const diasFrecuencia = FRECUENCIAS[frecuencia]?.dias ?? 30;
  const tasaPeriodo    = (tasa / 100 / 30) * diasFrecuencia;
  const capitalFijo    = Math.round((saldo / cuotas) * 100) / 100;
  let saldoAct = saldo, totalIntereses = 0;
  const filas = [];

  // Si hay fechaBase, usarla como punto de partida; sino, hoy
  const base = fechaBase ? new Date(fechaBase) : new Date();

  for (let i = 1; i <= cuotas; i++) {
    const interes    = Math.round(saldoAct * tasaPeriodo * 100) / 100;
    const capital    = i === cuotas ? Math.round(saldoAct * 100) / 100 : capitalFijo;
    const montoCuota = Math.round((capital + interes) * 100) / 100;
    const fecha      = new Date(base);
    fecha.setDate(fecha.getDate() + diasFrecuencia * i);
    saldoAct = Math.max(0, Math.round((saldoAct - capital) * 100) / 100);
    totalIntereses += interes;
    filas.push({ numero:i, capital, interes, monto:montoCuota, saldo:saldoAct, fecha });
  }
  return {
    cuotaEstimada:  filas[0]?.monto ?? 0,
    totalPagar:     Math.round((saldo + totalIntereses) * 100) / 100,
    totalIntereses: Math.round(totalIntereses * 100) / 100,
    primeraFecha:   filas[0]?.fecha,
    ultimaFecha:    filas[filas.length - 1]?.fecha,
  };
}

const CompRow = ({ label, antes, despues, format = (v) => v, highlight = false }) => {
  const cambio = typeof antes === "number" && typeof despues === "number" ? despues - antes : null;
  const mejor = cambio !== null && cambio < 0;
  return (
    <div className={`grid grid-cols-3 gap-2 py-2.5 border-b border-gray-100 last:border-0 ${highlight ? "bg-blue-50/50 -mx-4 px-4 rounded" : ""}`}>
      <span className="text-xs text-gray-500 font-medium self-center">{label}</span>
      <span className="text-xs font-semibold text-gray-600 text-center self-center">{format(antes)}</span>
      <div className="flex items-center justify-center gap-1.5">
        <span className={`text-xs font-bold ${highlight ? "text-blue-700" : "text-gray-800"}`}>{format(despues)}</span>
        {cambio !== null && cambio !== 0 && typeof antes === "number" && typeof despues === "number" && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${mejor ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {mejor ? "▼" : "▲"} {fmt(Math.abs(cambio))}
          </span>
        )}
      </div>
    </div>
  );
};

if (typeof document !== "undefined" && !document.getElementById("refi-styles")) {
  const s = document.createElement("style");
  s.id = "refi-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

// Fecha de hoy en formato YYYY-MM-DD para el input date
const hoyISO = () => new Date().toISOString().split("T")[0];
// Mínimo: mañana
const mananaISO = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export default function RefinanciarModal({ prestamo, onClose, onSuccess }) {
  const cuotasPendientes = prestamo.cuotas?.filter((c) => !c.pagada) ?? [];
  const cuotasPagadas    = prestamo.cuotas?.filter((c) =>  c.pagada) ?? [];
  const capitalPendiente = cuotasPendientes.reduce((s,c) => s + c.capital, 0);
  const morasPendientes  = cuotasPendientes.reduce((s,c) => s + (c.mora || 0), 0);
  const saldoRefinanciar = Math.round((capitalPendiente + morasPendientes) * 100) / 100;
  const cuotaActual      = prestamo.cuotaMensual ?? (cuotasPendientes[0]?.monto ?? 0);

  const [nuevasCuotas,   setNuevasCuotas]   = useState(String(cuotasPendientes.length));
  const [nuevaTasa,      setNuevaTasa]       = useState(String(prestamo.tasaInteres));
  const [nuevaFrecuencia,setNuevaFrecuencia] = useState(prestamo.frecuenciaPago);
  const [nuevaFechaPago, setNuevaFechaPago]  = useState(""); // vacío = no cambiar
  const [motivo,         setMotivo]          = useState("");
  const [submitting,     setSubmitting]      = useState(false);
  const [error,          setError]           = useState(null);
  const [paso,           setPaso]            = useState(1);

  // Detectar qué cambió para mostrar badges en el paso 2
  const cambios = useMemo(() => {
    const lista = [];
    if (parseInt(nuevasCuotas) !== cuotasPendientes.length) lista.push("cuotas");
    if (parseFloat(nuevaTasa)  !== prestamo.tasaInteres)    lista.push("tasa");
    if (nuevaFrecuencia        !== prestamo.frecuenciaPago) lista.push("frecuencia");
    if (nuevaFechaPago)                                      lista.push("fecha");
    return lista;
  }, [nuevasCuotas, nuevaTasa, nuevaFrecuencia, nuevaFechaPago, prestamo, cuotasPendientes.length]);

  const preview = useMemo(() => calcularPreview({
    saldo:     saldoRefinanciar,
    tasa:      parseFloat(nuevaTasa) || 0,
    cuotas:    parseInt(nuevasCuotas) || 0,
    frecuencia: nuevaFrecuencia,
    fechaBase: nuevaFechaPago || null,
  }), [saldoRefinanciar, nuevaTasa, nuevasCuotas, nuevaFrecuencia, nuevaFechaPago]);

  const valido = preview && parseFloat(nuevaTasa) > 0 && parseInt(nuevasCuotas) > 0;

  const handleSubmit = async () => {
    setError(null); setSubmitting(true);
    try {
      await api.patch(`/prestamos/${prestamo.id}/refinanciar`, {
        nuevasCuotas:    parseInt(nuevasCuotas),
        nuevaTasa:       parseFloat(nuevaTasa),
        nuevaFrecuencia: nuevaFrecuencia !== prestamo.frecuenciaPago ? nuevaFrecuencia : undefined,
        nuevaFechaPago:  nuevaFechaPago || undefined,
        motivo:          motivo || undefined,
      });
      onSuccess?.(); onClose();
    } catch (err) { setError(err.response?.data?.message ?? "Error al refinanciar"); }
    finally { setSubmitting(false); }
  };

  const frecLabel      = FRECUENCIAS[prestamo.frecuenciaPago]?.label ?? prestamo.frecuenciaPago;
  const frecLabelNueva = FRECUENCIAS[nuevaFrecuencia]?.label ?? nuevaFrecuencia;

  const CAMBIO_BADGE = {
    cuotas:    { label:"Cuotas modificadas",    color:"bg-blue-100 text-blue-700"     },
    tasa:      { label:"Tasa modificada",        color:"bg-amber-100 text-amber-700"   },
    frecuencia:{ label:"Frecuencia modificada",  color:"bg-violet-100 text-violet-700" },
    fecha:     { label:"Fecha de pago cambiada", color:"bg-emerald-100 text-emerald-700"},
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start overflow-y-auto py-3 sm:py-6 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-2 sm:mx-4 shadow-2xl" style={{ animation:"fadeUp 0.2s ease" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Refinanciar Préstamo</h2>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
              {prestamo.cliente?.nombre} {prestamo.cliente?.apellido} · {cuotasPagadas.length} pagadas · {cuotasPendientes.length} pendientes
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">

          {/* Info saldo */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 sm:px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Saldo a refinanciar: {fmt(saldoRefinanciar)}</p>
              <p className="text-amber-600 text-xs mt-0.5">
                Capital {fmt(capitalPendiente)}{morasPendientes > 0 && ` + Moras ${fmt(morasPendientes)}`} · {frecLabel}
              </p>
            </div>
          </div>

          {paso === 1 && (
            <>
              {/* Grid de parámetros — 1 col móvil, 2 cols sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

                {/* Nuevas cuotas */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Nuevas cuotas <span className="text-gray-400 font-normal">(actual: {cuotasPendientes.length})</span>
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                    <input type="number" min="1" max="360" value={nuevasCuotas} onChange={(e) => setNuevasCuotas(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-medium" />
                    <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-xs border-l border-gray-200">{frecLabelNueva}s</span>
                  </div>
                </div>

                {/* Nueva tasa */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Nueva tasa <span className="text-gray-400 font-normal">(actual: {prestamo.tasaInteres}%)</span>
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                    <input type="number" min="0.1" max="100" step="0.5" value={nuevaTasa} onChange={(e) => setNuevaTasa(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-medium" />
                    <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-xs border-l border-gray-200">%</span>
                  </div>
                </div>

                {/* Nueva frecuencia */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Frecuencia de pago <span className="text-gray-400 font-normal">(actual: {frecLabel})</span>
                  </label>
                  <select value={nuevaFrecuencia} onChange={(e) => setNuevaFrecuencia(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium">
                    {Object.entries(FRECUENCIAS).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}{key === prestamo.frecuenciaPago ? " (actual)" : ""}</option>
                    ))}
                  </select>
                </div>

                {/* Nueva fecha de próxima cuota */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Fecha próxima cuota <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    min={mananaISO()}
                    value={nuevaFechaPago}
                    onChange={(e) => setNuevaFechaPago(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                  />
                  {!nuevaFechaPago && (
                    <p className="text-[10px] text-gray-400 mt-1">Sin seleccionar: las cuotas inician desde hoy</p>
                  )}
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Motivo <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Dificultades económicas del cliente, cambio de frecuencia solicitado…"
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
              </div>

              {/* Badges de cambios detectados */}
              {cambios.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cambios.map(c => (
                    <span key={c} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${CAMBIO_BADGE[c]?.color ?? "bg-gray-100 text-gray-600"}`}>
                      ● {CAMBIO_BADGE[c]?.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Comparativa */}
              {preview ? (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Comparativa antes / después</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <span className="text-[10px] text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-500 text-center uppercase tracking-wide">Antes</span>
                    <span className="text-[10px] font-bold text-blue-600 text-center uppercase tracking-wide">Después</span>
                  </div>
                  <CompRow label="Cuota estimada"    antes={cuotaActual}             despues={preview.cuotaEstimada}      format={fmt}                  highlight />
                  <CompRow label="Cuotas pendientes" antes={cuotasPendientes.length} despues={parseInt(nuevasCuotas)||0}  format={(v) => `${v} cuotas`} />
                  <CompRow label="Tasa interés"      antes={prestamo.tasaInteres}    despues={parseFloat(nuevaTasa)||0}   format={(v) => `${v}%`}       />
                  <CompRow label="Frecuencia"        antes={frecLabel}               despues={frecLabelNueva}             />
                  <CompRow label="Total a pagar"     antes={cuotasPendientes.reduce((s,c)=>s+c.monto+(c.mora||0),0)} despues={preview.totalPagar}  format={fmt} />
                  <CompRow label="Total intereses"   antes={cuotasPendientes.reduce((s,c)=>s+c.interes,0)}           despues={preview.totalIntereses} format={fmt} />
                  <div className="mt-3 pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-gray-500">
                    <span>Primera cuota: <strong className="text-gray-700">{preview.primeraFecha ? fmtFecha(preview.primeraFecha) : "—"}</strong></span>
                    <span>Última cuota: <strong className="text-gray-700">{preview.ultimaFecha ? fmtFecha(preview.ultimaFecha) : "—"}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
                  Ingresa las nuevas cuotas y tasa para ver la comparativa
                </div>
              )}

              <button onClick={() => setPaso(2)} disabled={!valido}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                Revisar y confirmar →
              </button>
            </>
          )}

          {paso === 2 && preview && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 sm:px-4 py-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div className="text-sm">
                  <p className="font-bold text-red-800">Esta acción es irreversible</p>
                  <p className="text-red-600 text-xs mt-0.5">Las {cuotasPendientes.length} cuotas pendientes serán reemplazadas por {nuevasCuotas} nuevas.</p>
                </div>
              </div>

              {/* Badges de cambios en paso 2 */}
              {cambios.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">Cambios que se aplicarán:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cambios.map(c => (
                      <span key={c} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${CAMBIO_BADGE[c]?.color ?? "bg-gray-100 text-gray-600"}`}>
                        ✓ {CAMBIO_BADGE[c]?.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {[
                  { label:"Saldo refinanciado",      value:fmt(saldoRefinanciar)                },
                  { label:"Nuevas cuotas",            value:`${nuevasCuotas} ${frecLabelNueva}s` },
                  { label:"Nueva tasa",               value:`${nuevaTasa}%`                      },
                  { label:"Frecuencia",               value:frecLabelNueva,
                    changed: nuevaFrecuencia !== prestamo.frecuenciaPago },
                  { label:"Nueva cuota estimada",     value:fmt(preview.cuotaEstimada), bold:true },
                  { label:"Primera cuota",            value:preview.primeraFecha ? fmtFecha(preview.primeraFecha) : "—",
                    changed: !!nuevaFechaPago },
                  { label:"Total nuevo a pagar",      value:fmt(preview.totalPagar), bold:true   },
                  ...(motivo ? [{ label:"Motivo", value:motivo }] : []),
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center px-3 sm:px-4 py-3">
                    <span className="text-sm text-gray-500">{r.label}</span>
                    <span className={`text-sm ${r.bold ? "font-bold text-gray-900" : r.changed ? "font-bold text-blue-700" : "font-semibold text-gray-700"}`}>
                      {r.value}
                      {r.changed && <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">Nuevo</span>}
                    </span>
                  </div>
                ))}
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">❌ {error}</div>}

              <div className="flex gap-3">
                <button onClick={() => { setPaso(1); setError(null); }}
                  className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">
                  ← Volver
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
                    : "✓ Confirmar refinanciamiento"
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}