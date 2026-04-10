// src/components/TablaAmortizacionModal.jsx
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../services/api";

const fmt = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style:"currency", currency:"DOP", minimumFractionDigits:2 }).format(n);
const fmtFecha = (d) =>
  d ? new Intl.DateTimeFormat("es-DO", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d)) : "—";

const ESTADO_CUOTA = {
  pagada:   { bg:"bg-emerald-50",  text:"text-emerald-700", badge:"bg-emerald-100 text-emerald-700 border-emerald-200", label:"Pagada"   },
  vencida:  { bg:"bg-red-50",      text:"text-red-600",     badge:"bg-red-100 text-red-700 border-red-200",             label:"Vencida"  },
  pendiente:{ bg:"bg-white",       text:"text-gray-700",    badge:"bg-gray-100 text-gray-500 border-gray-200",           label:"Pendiente"},
  proxima:  { bg:"bg-blue-50/60",  text:"text-blue-700",    badge:"bg-blue-100 text-blue-700 border-blue-200",          label:"Próxima"  },
};

const getEstadoCuota = (cuota) => {
  if (cuota.pagada) return "pagada";
  const hoy   = new Date(); hoy.setHours(0,0,0,0);
  const vence = new Date(cuota.fechaVencimiento); vence.setHours(0,0,0,0);
  if (vence < hoy) return "vencida";
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 3);
  if (vence <= manana) return "proxima";
  return "pendiente";
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">Cuota #{label}</p>
      {payload.map((p) => <p key={p.name} style={{ color:p.color }} className="font-semibold">{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

if (typeof document !== "undefined" && !document.getElementById("tamo-styles")) {
  const s = document.createElement("style");
  s.id = "tamo-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

export default function TablaAmortizacionModal({ prestamoId, onClose }) {
  const [prestamo, setPrestamo] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [filtro,   setFiltro]   = useState("todas");

  useEffect(() => {
    api.get(`/prestamos/${prestamoId}`)
      .then((r) => setPrestamo(r.data))
      .catch(() => setError("Error al cargar el préstamo"))
      .finally(() => setLoading(false));
  }, [prestamoId]);

  const cuotasOrdenadas = useMemo(() =>
    prestamo?.cuotas ? [...prestamo.cuotas].sort((a,b) => a.numero - b.numero) : []
  , [prestamo]);

  const cuotasFiltradas = useMemo(() => {
    if (filtro === "todas")      return cuotasOrdenadas;
    if (filtro === "pagadas")    return cuotasOrdenadas.filter((c) => c.pagada);
    if (filtro === "pendientes") return cuotasOrdenadas.filter((c) => !c.pagada);
    if (filtro === "vencidas")   return cuotasOrdenadas.filter((c) => !c.pagada && getEstadoCuota(c) === "vencida");
    return cuotasOrdenadas;
  }, [cuotasOrdenadas, filtro]);

  const resumen = useMemo(() => {
    if (!cuotasOrdenadas.length) return null;
    const pagadas    = cuotasOrdenadas.filter((c) => c.pagada);
    const pendientes = cuotasOrdenadas.filter((c) => !c.pagada);
    const vencidas   = pendientes.filter((c) => getEstadoCuota(c) === "vencida");
    return {
      totalCuotas:    cuotasOrdenadas.length,
      pagadas:        pagadas.length,
      pendientes:     pendientes.length,
      vencidas:       vencidas.length,
      montoPagado:    pagadas.reduce((s,c) => s + c.monto, 0),
      montoPendiente: pendientes.reduce((s,c) => s + c.monto + (c.mora || 0), 0),
      progreso:       (pagadas.length / cuotasOrdenadas.length) * 100,
    };
  }, [cuotasOrdenadas]);

  const datosGrafico = useMemo(() => {
    if (!cuotasOrdenadas.length) return [];
    const paso = cuotasOrdenadas.length > 24 ? Math.ceil(cuotasOrdenadas.length / 24) : 1;
    return cuotasOrdenadas
      .filter((_,i) => i % paso === 0 || i === cuotasOrdenadas.length - 1)
      .map((c) => ({ name:c.numero, Capital:Math.round(c.capital*100)/100, Interés:Math.round(c.interes*100)/100, Mora:Math.round((c.mora||0)*100)/100 }));
  }, [cuotasOrdenadas]);

  const FILTROS = [
    { id:"todas",      label:"Todas",      count:resumen?.totalCuotas   },
    { id:"pagadas",    label:"Pagadas",    count:resumen?.pagadas,    color:"text-emerald-600" },
    { id:"pendientes", label:"Pendientes", count:resumen?.pendientes, color:"text-gray-500"    },
    { id:"vencidas",   label:"Vencidas",   count:resumen?.vencidas,   color:"text-red-600"     },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start overflow-y-auto py-3 sm:py-6 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-5xl mx-2 sm:mx-4 shadow-2xl" style={{ animation:"fadeUp 0.2s ease" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Tabla de Amortización</h2>
            {prestamo && (
              <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                {prestamo.cliente?.nombre} {prestamo.cliente?.apellido} · {fmt(prestamo.monto)} · {prestamo.tasaInteres}% mensual
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}
          {error   && <div className="text-center py-16 text-red-500"><div className="text-4xl mb-2">❌</div><p>{error}</p></div>}

          {!loading && !error && prestamo && resumen && (
            <>
              {/* KPIs — 2 cols móvil, 4 sm+ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label:"Cuotas pagadas",  value:`${resumen.pagadas}/${resumen.totalCuotas}`, color:"text-emerald-600", bg:"bg-emerald-50" },
                  { label:"Cuotas vencidas", value:resumen.vencidas,                           color:"text-red-600",    bg:"bg-red-50"     },
                  { label:"Monto pagado",    value:fmt(resumen.montoPagado),                   color:"text-emerald-600",bg:"bg-emerald-50" },
                  { label:"Saldo pendiente", value:fmt(prestamo.saldoPendiente),               color:"text-gray-800",   bg:"bg-gray-50"    },
                ].map((k) => (
                  <div key={k.label} className={`${k.bg} rounded-xl border border-gray-100 px-3 py-2.5 text-center`}>
                    <p className={`text-sm sm:text-base font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Progreso */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-semibold">
                  <span>Progreso del préstamo</span><span>{resumen.progreso.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width:`${resumen.progreso}%`, background:resumen.progreso>=100?"#10b981":`linear-gradient(90deg,#3b82f6 ${resumen.progreso*0.7}%,#10b981)` }} />
                </div>
              </div>

              {/* Gráfico */}
              <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Distribución por cuota</p>
                <div className="h-36 sm:h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={datosGrafico}>
                      <defs>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize:9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize:9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize:11 }} />
                      <Area type="monotone" dataKey="Capital" stroke="#3b82f6" fill="url(#gC)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="Interés" stroke="#f59e0b" fill="url(#gI)" strokeWidth={2} dot={false} />
                      {datosGrafico.some((d) => d.Mora > 0) && (
                        <Area type="monotone" dataKey="Mora" stroke="#ef4444" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex gap-1.5 flex-wrap">
                {FILTROS.map((f) => (
                  <button key={f.id} onClick={() => setFiltro(f.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      filtro === f.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}>
                    {f.label}
                    {f.count !== undefined && (
                      <span className={`${filtro===f.id?"text-white/70":(f.color||"text-gray-400")} font-bold text-[10px]`}>{f.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tabla sm+ */}
              <div className="hidden sm:block rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
                      <tr>
                        {["#","Vencimiento","Capital","Interés","Mora","Cuota","Estado"].map((h,i) => (
                          <th key={h} className={`px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] ${i>=2&&i<=5?"text-right":"text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cuotasFiltradas.length === 0
                        ? <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No hay cuotas en esta categoría</td></tr>
                        : cuotasFiltradas.map((c) => {
                            const estadoKey = getEstadoCuota(c);
                            const est       = ESTADO_CUOTA[estadoKey];
                            return (
                              <tr key={c.id} className={`${est.bg} hover:brightness-95 transition-all`}>
                                <td className={`px-4 py-2.5 font-mono font-bold ${est.text}`}>{c.numero}</td>
                                <td className={`px-4 py-2.5 ${est.text}`}>{fmtFecha(c.fechaVencimiento)}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-blue-600">{fmt(c.capital)}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-amber-600">{fmt(c.interes)}</td>
                                <td className="px-4 py-2.5 text-right">{c.mora>0?<span className="font-semibold text-red-600">{fmt(c.mora)}</span>:<span className="text-gray-300">—</span>}</td>
                                <td className={`px-4 py-2.5 text-right font-bold ${est.text}`}>{fmt(c.monto+(c.mora||0))}</td>
                                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${est.badge}`}>{est.label}</span></td>
                              </tr>
                            );
                          })
                      }
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-100 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase">{filtro==="todas"?"Totales":`Subtotal (${cuotasFiltradas.length})`}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-bold text-blue-700">{fmt(cuotasFiltradas.reduce((s,c)=>s+c.capital,0))}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-bold text-amber-700">{fmt(cuotasFiltradas.reduce((s,c)=>s+c.interes,0))}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-bold text-red-600">{fmt(cuotasFiltradas.reduce((s,c)=>s+(c.mora||0),0))}</td>
                        <td className="px-4 py-3 text-right text-[10px] font-bold text-gray-800">{fmt(cuotasFiltradas.reduce((s,c)=>s+c.monto+(c.mora||0),0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Tarjetas móvil */}
              <div className="sm:hidden space-y-2">
                {cuotasFiltradas.length === 0
                  ? <p className="text-center py-8 text-gray-400 text-sm">No hay cuotas en esta categoría</p>
                  : cuotasFiltradas.map((c) => {
                      const estadoKey = getEstadoCuota(c);
                      const est       = ESTADO_CUOTA[estadoKey];
                      return (
                        <div key={c.id} className={`rounded-xl border p-3 space-y-2 ${est.bg}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${est.badge.includes("emerald")?"bg-emerald-100 text-emerald-700":est.badge.includes("red")?"bg-red-100 text-red-700":est.badge.includes("blue")?"bg-blue-100 text-blue-700":"bg-gray-100 text-gray-500"}`}>
                                {c.numero}
                              </span>
                              <span className={`text-xs ${est.text}`}>{fmtFecha(c.fechaVencimiento)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold ${est.text}`}>{fmt(c.monto+(c.mora||0))}</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${est.badge}`}>{est.label}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[10px]">
                            <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Capital</p><p className="font-bold text-blue-700">{fmt(c.capital)}</p></div>
                            <div className="bg-amber-50 rounded p-1.5 text-center"><p className="text-amber-400">Interés</p><p className="font-bold text-amber-700">{fmt(c.interes)}</p></div>
                            <div className="bg-red-50 rounded p-1.5 text-center"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{c.mora>0?fmt(c.mora):"—"}</p></div>
                          </div>
                        </div>
                      );
                    })
                }
                {/* Total móvil */}
                {cuotasFiltradas.length > 0 && (
                  <div className="bg-gray-100 rounded-xl p-3 border-2 border-gray-200">
                    <p className="text-[10px] font-bold text-gray-600 uppercase mb-2">{filtro==="todas"?"Totales":`Subtotal (${cuotasFiltradas.length})`}</p>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <div className="bg-white rounded p-1.5 text-center"><p className="text-gray-400">Capital</p><p className="font-bold text-blue-700">{fmt(cuotasFiltradas.reduce((s,c)=>s+c.capital,0))}</p></div>
                      <div className="bg-white rounded p-1.5 text-center"><p className="text-gray-400">Interés</p><p className="font-bold text-amber-700">{fmt(cuotasFiltradas.reduce((s,c)=>s+c.interes,0))}</p></div>
                      <div className="bg-white rounded p-1.5 text-center"><p className="text-gray-400">Total</p><p className="font-bold text-gray-800">{fmt(cuotasFiltradas.reduce((s,c)=>s+c.monto+(c.mora||0),0))}</p></div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}