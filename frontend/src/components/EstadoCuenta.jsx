// src/components/EstadoCuenta.jsx
import { useState, useEffect, useRef } from "react";
import api from "../services/api";

const fmt = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style:"currency", currency:"DOP", minimumFractionDigits:2 }).format(n);
const fmtFecha = (d) =>
  d ? new Intl.DateTimeFormat("es-DO", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(d)) : "—";
const fmtCedula = (v = "") => {
  const d = v.replace(/\D/g,"");
  if (d.length <= 3) return d;
  if (d.length <= 10) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,10)}-${d.slice(10)}`;
};

const ESTADO_STYLE = {
  ACTIVO:    { badge:"bg-emerald-100 text-emerald-700 border-emerald-200", label:"Activo"    },
  ATRASADO:  { badge:"bg-red-100 text-red-700 border-red-200",            label:"Atrasado"  },
  PAGADO:    { badge:"bg-blue-100 text-blue-700 border-blue-200",         label:"Pagado"    },
  CANCELADO: { badge:"bg-gray-100 text-gray-500 border-gray-200",         label:"Cancelado" },
};
const FRECUENCIA_LABEL = { DIARIO:"Diario", SEMANAL:"Semanal", QUINCENAL:"Quincenal", MENSUAL:"Mensual" };
const METODO_LABEL     = { EFECTIVO:"Efectivo", TRANSFERENCIA:"Transferencia", TARJETA:"Tarjeta", CHEQUE:"Cheque" };

const imprimirPDF = (ref, titulo) => {
  const ventana = window.open("", "_blank", "width=900,height=700");
  ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>${titulo}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;padding:20px;font-size:11px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e2e8f0}
    .empresa{font-size:16px;font-weight:800;color:#1e40af}.titulo{font-size:13px;font-weight:700;margin-top:2px}.fecha{font-size:10px;color:#94a3b8}
    .section{margin-bottom:14px}.section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #f1f5f9}
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.info-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px}
    .info-label{font-size:9px;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:2px}.info-value{font-size:11px;font-weight:600;color:#1e293b}
    .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px}
    .kpi{text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px}.kpi-val{font-size:13px;font-weight:800}.kpi-lbl{font-size:9px;color:#94a3b8;margin-top:1px}
    .prestamo-box{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;overflow:hidden}
    .prestamo-header{background:#f8fafc;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}
    .prestamo-title{font-size:12px;font-weight:700}.badge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700;border:1px solid}
    .badge-activo{background:#d1fae5;color:#065f46;border-color:#a7f3d0}.badge-atrasado{background:#fee2e2;color:#991b1b;border-color:#fca5a5}
    .badge-pagado{background:#dbeafe;color:#1e40af;border-color:#93c5fd}.badge-cancelado{background:#f1f5f9;color:#64748b;border-color:#cbd5e1}
    table{width:100%;border-collapse:collapse;font-size:10px}th{background:#f8fafc;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #e2e8f0}
    td{padding:5px 8px;border-bottom:1px solid #f8fafc}.right{text-align:right}.text-red{color:#dc2626}.text-green{color:#059669}
    .footer{margin-top:16px;padding-top:8px;border-top:1px dashed #e2e8f0;text-align:center;font-size:9px;color:#94a3b8}
    @media print{@page{margin:10mm}}
  </style></head><body>${ref.current.innerHTML}</body></html>`);
  ventana.document.close(); ventana.focus();
  setTimeout(() => { ventana.print(); ventana.close(); }, 400);
};

if (typeof document !== "undefined" && !document.getElementById("ec-styles")) {
  const s = document.createElement("style");
  s.id = "ec-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

export default function EstadoCuenta({ clienteId, onClose }) {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [tabPrestamo, setTabPrestamo] = useState(0);
  const contenidoRef = useRef(null);

  const empresa = JSON.parse(localStorage.getItem("user") || "{}").empresa || "Sistema de Préstamos";
  const fechaGenerado = new Intl.DateTimeFormat("es-DO", { day:"2-digit", month:"long", year:"numeric" }).format(new Date());

  useEffect(() => {
    api.get(`/reportes/cliente/${clienteId}`)
      .then((r) => setData(r.data))
      .catch(() => setError("Error al cargar el estado de cuenta"))
      .finally(() => setLoading(false));
  }, [clienteId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start overflow-y-auto py-3 sm:py-6 z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-4xl mx-2 sm:mx-4 shadow-2xl" style={{ animation:"fadeUp 0.2s ease" }}>

        {/* Header modal */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Estado de Cuenta</h2>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Documento oficial del cliente</p>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button onClick={() => imprimirPDF(contenidoRef, `Estado de Cuenta - ${data.cliente.nombre}`)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs sm:text-sm font-semibold border border-red-200 transition-all active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                <span className="hidden sm:inline">Imprimir / </span>PDF
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}
          {error && <div className="text-center py-16 text-red-500"><div className="text-4xl mb-2">❌</div><p>{error}</p></div>}

          {!loading && !error && data && (
            <div ref={contenidoRef}>

              {/* Encabezado documento */}
              <div className="header flex items-start justify-between mb-5 sm:mb-6 pb-4 border-b-2 border-gray-100">
                <div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm mb-2">
                    {empresa.slice(0,2).toUpperCase()}
                  </div>
                  <p className="empresa text-base sm:text-lg font-bold text-blue-700">{empresa}</p>
                  <p className="titulo text-sm font-bold text-gray-800 mt-0.5">ESTADO DE CUENTA</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Generado el</p>
                  <p className="text-sm font-semibold text-gray-700">{fechaGenerado}</p>
                  <p className="text-xs text-gray-400 mt-1">Cliente desde</p>
                  <p className="text-sm font-semibold text-gray-700">{fmtFecha(data.prestamos[data.prestamos.length - 1]?.fechaInicio)}</p>
                </div>
              </div>

              {/* Info cliente — 2 cols móvil, 3 cols sm+ */}
              <div className="section mb-4 sm:mb-5">
                <p className="section-title text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Información del Cliente</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label:"Nombre completo", value:data.cliente.nombre },
                    { label:"Cédula",           value:fmtCedula(data.cliente.cedula) },
                    { label:"Teléfono",         value:data.cliente.telefono },
                    { label:"Celular",          value:data.cliente.celular },
                    { label:"Email",            value:data.cliente.email },
                    { label:"Ocupación",        value:data.cliente.ocupacion },
                    { label:"Provincia",        value:data.cliente.provincia },
                    { label:"Municipio",        value:data.cliente.municipio },
                    { label:"Dirección",        value:data.cliente.direccion },
                  ].map((f) => (
                    <div key={f.label} className="info-item bg-gray-50 border border-gray-100 rounded-xl p-2.5 sm:p-3">
                      <p className="info-label text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400">{f.label}</p>
                      <p className="info-value text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 truncate">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs — 3 cols móvil, 5 sm+ */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4 sm:mb-5">
                {[
                  { label:"Préstamos",      value:data.totalPrestamos,      color:"text-gray-800"    },
                  { label:"Activos",        value:data.prestamosActivos,    color:"text-emerald-600", bg:"bg-emerald-50" },
                  { label:"Total pagado",   value:fmt(data.totalPagado),    color:"text-blue-600",   bg:"bg-blue-50"    },
                  { label:"Saldo",          value:fmt(data.totalSaldo),     color:"text-gray-800"    },
                  { label:"Mora",           value:fmt(data.totalMora),      color:"text-red-600",    bg:"bg-red-50"     },
                ].map((k) => (
                  <div key={k.label} className={`${k.bg || "bg-white"} rounded-xl border border-gray-100 shadow-sm px-2 sm:px-3 py-2.5 sm:py-3 text-center`}>
                    <p className={`text-sm sm:text-base font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Préstamos */}
              <div className="section">
                <p className="section-title text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Detalle de Préstamos</p>

                {/* Tabs préstamos — scroll horizontal en móvil */}
                {data.prestamos.length > 1 && (
                  <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-0.5">
                    {data.prestamos.map((p, i) => (
                      <button key={i} onClick={() => setTabPrestamo(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${tabPrestamo === i ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        Préstamo {i + 1} — {fmt(p.monto)}
                        <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ESTADO_STYLE[p.estado]?.badge}`}>{ESTADO_STYLE[p.estado]?.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {data.prestamos.map((pr, i) => (
                  <div key={i} className={`prestamo-box border border-gray-100 rounded-2xl overflow-hidden mb-4 ${data.prestamos.length > 1 && tabPrestamo !== i ? "hidden print:block" : ""}`}>

                    {/* Header préstamo — apilado en móvil */}
                    <div className="prestamo-header bg-gray-50 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">Préstamo {i + 1}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_STYLE[pr.estado]?.badge}`}>{ESTADO_STYLE[pr.estado]?.label}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500 flex-wrap">
                        <span>Inicio: <strong>{fmtFecha(pr.fechaInicio)}</strong></span>
                        <span>Plazo: <strong>{pr.totalCuotas} cuotas</strong></span>
                        <span>Tasa: <strong>{pr.tasaInteres}%</strong></span>
                        <span className="hidden sm:inline">Frecuencia: <strong>{FRECUENCIA_LABEL[pr.frecuencia] || pr.frecuencia}</strong></span>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">

                      {/* Resumen préstamo — 2 cols móvil, 4 sm+ */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        {[
                          { label:"Monto original",  value:fmt(pr.monto),        color:"text-gray-800" },
                          { label:"Saldo pendiente", value:fmt(pr.saldo),         color:pr.saldo>0?"text-gray-800":"text-emerald-600" },
                          { label:"Mora acumulada",  value:fmt(pr.moraAcumulada), color:pr.moraAcumulada>0?"text-red-600":"text-gray-400" },
                          { label:"Cuotas pagadas",  value:`${pr.cuotasPagadas}/${pr.totalCuotas}`, color:"text-blue-600" },
                        ].map((k) => (
                          <div key={k.label} className="bg-gray-50 rounded-xl border border-gray-100 px-2.5 sm:px-3 py-2 sm:py-2.5 text-center">
                            <p className={`text-xs sm:text-sm font-bold ${k.color}`}>{k.value}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">{k.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Cuotas pendientes */}
                      {pr.cuotasPendientesDetalle?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cuotas pendientes ({pr.cuotasPendientesDetalle.length})</p>

                          {/* Tabla sm+ */}
                          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-gray-50 border-b border-gray-100">
                                {["#","Vencimiento","Monto","Estado"].map((h,hi) => (
                                  <th key={h} className={`px-3 py-2 text-[10px] uppercase font-bold text-gray-400 ${hi>=2?"text-right":"text-left"}`}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {pr.cuotasPendientesDetalle.map((c) => (
                                  <tr key={c.numero} className={c.vencida?"bg-red-50/40":"hover:bg-gray-50/60"}>
                                    <td className="px-3 py-2 font-mono text-gray-500">{c.numero}</td>
                                    <td className={`px-3 py-2 ${c.vencida?"text-red-600 font-semibold":"text-gray-700"}`}>{fmtFecha(c.fechaVencimiento)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(c.monto)}</td>
                                    <td className="px-3 py-2 text-right">
                                      {c.vencida
                                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Vencida</span>
                                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Pendiente</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Tarjetas móvil */}
                          <div className="sm:hidden space-y-1.5">
                            {pr.cuotasPendientesDetalle.map((c) => (
                              <div key={c.numero} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${c.vencida?"bg-red-50 border-red-100":"bg-gray-50 border-gray-100"}`}>
                                <div>
                                  <span className="font-mono text-gray-500 mr-2">#{c.numero}</span>
                                  <span className={c.vencida?"text-red-600 font-semibold":"text-gray-700"}>{fmtFecha(c.fechaVencimiento)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800">{fmt(c.monto)}</span>
                                  {c.vencida
                                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Vencida</span>
                                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendiente</span>
                                  }
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Historial pagos */}
                      {pr.pagos?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Historial de pagos ({pr.pagos.length})</p>

                          {/* Tabla sm+ */}
                          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full text-xs">
                              <thead><tr className="bg-gray-50 border-b border-gray-100">
                                {["Fecha","Capital","Interés","Mora","Total","Método","Cobrador"].map((h,hi) => (
                                  <th key={h} className={`px-3 py-2 text-[10px] uppercase font-bold text-gray-400 ${hi>=1&&hi<=4?"text-right":"text-left"}`}>{h}</th>
                                ))}
                              </tr></thead>
                              <tbody className="divide-y divide-gray-50">
                                {pr.pagos.map((pg, pi) => (
                                  <tr key={pi} className="hover:bg-gray-50/60">
                                    <td className="px-3 py-2 text-gray-600">{fmtFecha(pg.fecha)}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">{fmt(pg.capital)}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">{fmt(pg.interes)}</td>
                                    <td className="px-3 py-2 text-right">{pg.mora>0?<span className="text-red-600 font-semibold">{fmt(pg.mora)}</span>:<span className="text-gray-300">—</span>}</td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(pg.total)}</td>
                                    <td className="px-3 py-2 text-gray-600">{METODO_LABEL[pg.metodo]||pg.metodo}</td>
                                    <td className="px-3 py-2 text-gray-500">{pg.cobrador}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot><tr className="bg-gray-50 border-t border-gray-200 font-bold">
                                <td className="px-3 py-2 text-xs text-gray-500">Total</td>
                                <td className="px-3 py-2 text-right text-xs">{fmt(pr.pagos.reduce((s,p)=>s+p.capital,0))}</td>
                                <td className="px-3 py-2 text-right text-xs">{fmt(pr.pagos.reduce((s,p)=>s+p.interes,0))}</td>
                                <td className="px-3 py-2 text-right text-xs text-red-600">{fmt(pr.pagos.reduce((s,p)=>s+p.mora,0))}</td>
                                <td className="px-3 py-2 text-right text-xs text-emerald-700">{fmt(pr.pagos.reduce((s,p)=>s+p.total,0))}</td>
                                <td colSpan={2} />
                              </tr></tfoot>
                            </table>
                          </div>

                          {/* Tarjetas móvil */}
                          <div className="sm:hidden space-y-2">
                            {pr.pagos.map((pg, pi) => (
                              <div key={pi} className="border border-gray-100 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs text-gray-500">{fmtFecha(pg.fecha)}</p>
                                  <p className="text-sm font-bold text-emerald-700">{fmt(pg.total)}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-[10px]">
                                  <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Capital</p><p className="font-bold text-blue-700">{fmt(pg.capital)}</p></div>
                                  <div className="bg-amber-50 rounded p-1.5 text-center"><p className="text-amber-400">Interés</p><p className="font-bold text-amber-700">{fmt(pg.interes)}</p></div>
                                  <div className="bg-red-50 rounded p-1.5 text-center"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{pg.mora>0?fmt(pg.mora):"—"}</p></div>
                                </div>
                                <div className="flex gap-2 text-[10px] text-gray-400">
                                  <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium">{METODO_LABEL[pg.metodo]||pg.metodo}</span>
                                  {pg.cobrador && <span>por {pg.cobrador}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!pr.pagos?.length && !pr.cuotasPendientesDetalle?.length && (
                        <p className="text-center text-gray-400 text-sm py-4">Sin movimientos registrados</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="footer mt-4 sm:mt-5 pt-4 border-t border-dashed border-gray-200 text-center text-xs text-gray-400">
                <p>{empresa} · Estado de cuenta generado el {fechaGenerado}</p>
                <p className="mt-1">Este documento es de carácter informativo y no constituye un comprobante fiscal.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}