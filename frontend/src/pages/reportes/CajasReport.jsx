// CajasReport.jsx — Tab de reporte de cajas con sub-tabs
import { useState } from "react";
import { formatCurrency, formatCedula } from "../../utils/prestamosUtils";
import { METODO_LABEL, METODO_COLOR } from "./reporteConstants";
import { SumCard, Tabla } from "./reporteShared";
import { fmtFechaCorta, fmtHora } from "./reporteHelpers";

export default function CajasReport({ data }) {
  const [tabCaja, setTabCaja] = useState("resumen");

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Cards resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SumCard label="Total cobrado" value={formatCurrency(data.resumen.totalCobrado)} color="text-emerald-700" bg="bg-emerald-50" sub={`${data.resumen.cantidadPagos} pagos`} />
        <SumCard label="Total efectivo" value={formatCurrency(data.resumen.totalEfectivo)} color="text-blue-700" bg="bg-blue-50" />
        <SumCard label="Efectivo sistema" value={formatCurrency(data.resumen.efectivoSistema ?? 0)} color="text-indigo-700" bg="bg-indigo-50" />
        <SumCard label="Sesiones caja" value={data.resumen.cantidadCajas} color="text-gray-700" bg="bg-gray-50" sub={`${data.resumen.cajasCerradas} cerradas`} />
      </div>

      {/* Desglose por método */}
      {Object.keys(data.pagosPorMetodo).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cobros por método de pago</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(data.pagosPorMetodo).map(([metodo, info]) => (
              <div key={metodo} className={`rounded-xl border px-3 py-2.5 ${METODO_COLOR[metodo] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
                <p className="text-xs font-bold opacity-70">{METODO_LABEL[metodo] ?? metodo}</p>
                <p className="text-base font-bold mt-0.5">{formatCurrency(info.monto)}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{info.cantidad} pagos</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs internos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {[
            { key: "resumen", label: `Por cajero (${data.resumenPorUsuario.length})` },
            { key: "dias", label: `Por día (${data.resumenPorDia.length})` },
            { key: "sesiones", label: `Sesiones (${data.cajas.length})` },
            { key: "pagos", label: `Pagos (${data.pagos.length})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTabCaja(key)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors
                ${tabCaja === key ? "border-blue-600 text-blue-700 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Por cajero */}
        {tabCaja === "resumen" && (
          <>
            <div className="hidden sm:block p-4">
              <Tabla
                headers={[
                  { key: "nombre", label: "Cajero" },
                  { key: "cajasAbiertas", label: "Días", right: true, render: (r) => r.cajasAbiertas + r.cajasCerradas },
                  { key: "cajasCerradas", label: "Cerradas", right: true },
                  { key: "cantidadPagos", label: "Pagos", right: true },
                  { key: "totalCobrado", label: "Total cobrado", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.totalCobrado)}</span> },
                  { key: "totalEfectivo", label: "En efectivo", right: true, render: (r) => formatCurrency(r.totalEfectivo) },
                  { key: "diferenciasNegativas", label: "Faltantes", right: true, render: (r) => r.diferenciasNegativas > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(r.diferenciasNegativas)}</span> : <span className="text-emerald-500">✓</span> },
                  { key: "diferenciasPositivas", label: "Sobrantes", right: true, render: (r) => r.diferenciasPositivas > 0 ? <span className="text-blue-600">{formatCurrency(r.diferenciasPositivas)}</span> : "—" },
                ]}
                rows={data.resumenPorUsuario}
                emptyMsg="Sin datos de cajeros"
                footer={[
                  { value: "Totales", color: "text-gray-700" },
                  { value: "", right: true }, { value: "", right: true },
                  { value: data.resumen.cantidadPagos, right: true, color: "text-gray-700" },
                  { value: formatCurrency(data.resumen.totalCobrado), right: true, color: "text-emerald-700" },
                  { value: formatCurrency(data.resumen.totalEfectivo), right: true, color: "text-gray-700" },
                  { value: "", right: true }, { value: "", right: true },
                ]}
              />
            </div>
            <div className="sm:hidden divide-y divide-gray-50 p-3 space-y-2">
              {data.resumenPorUsuario.map((u, i) => (
                <div key={i} className="pt-2 first:pt-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-gray-800">{u.nombre}</p>
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(u.totalCobrado)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Pagos</p><p className="font-bold text-gray-700">{u.cantidadPagos}</p></div>
                    <div className="bg-emerald-50 rounded p-1.5 text-center"><p className="text-emerald-400">Efectivo</p><p className="font-bold text-emerald-700">{formatCurrency(u.totalEfectivo)}</p></div>
                    <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Cerradas</p><p className="font-bold text-blue-700">{u.cajasCerradas}</p></div>
                  </div>
                  {u.diferenciasNegativas > 0 && (
                    <p className="text-[10px] text-red-600 mt-1 font-semibold">⚠ Faltantes: {formatCurrency(u.diferenciasNegativas)}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Por día */}
        {tabCaja === "dias" && (
          <>
            <div className="hidden sm:block p-4">
              <Tabla
                headers={[
                  { key: "fecha", label: "Fecha", render: (r) => fmtFechaCorta(r.fecha) },
                  { key: "cajasAbiertas", label: "Cajas abiertas", right: true },
                  { key: "cajasCerradas", label: "Cajas cerradas", right: true },
                  { key: "cantidadPagos", label: "Pagos", right: true },
                  { key: "totalCobrado", label: "Total cobrado", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.totalCobrado)}</span> },
                ]}
                rows={data.resumenPorDia}
                emptyMsg="Sin datos por día"
              />
            </div>
            <div className="sm:hidden divide-y divide-gray-50">
              {data.resumenPorDia.map((d, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-800">{fmtFechaCorta(d.fecha)}</p>
                    <span className="text-sm font-bold text-emerald-700">{formatCurrency(d.totalCobrado)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Cajas</p><p className="font-bold text-gray-700">{d.cajasAbiertas + d.cajasCerradas}</p></div>
                    <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Pagos</p><p className="font-bold text-gray-700">{d.cantidadPagos}</p></div>
                    <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Cerradas</p><p className="font-bold text-blue-700">{d.cajasCerradas}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Sesiones */}
        {tabCaja === "sesiones" && (
          <>
            <div className="hidden sm:block p-4">
              <Tabla
                headers={[
                  { key: "fecha", label: "Fecha", render: (r) => fmtFechaCorta(r.fecha) },
                  { key: "cajero", label: "Cajero" },
                  {
                    key: "estado", label: "Estado", render: (r) => r.estado === "ABIERTA"
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Abierta</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Cerrada</span>
                  },
                  { key: "montoInicial", label: "Inicial", right: true, render: (r) => formatCurrency(r.montoInicial) },
                  { key: "montoCierre", label: "Cierre", right: true, render: (r) => r.montoCierre != null ? formatCurrency(r.montoCierre) : "—" },
                  {
                    key: "diferencia", label: "Diferencia", right: true, render: (r) => r.diferencia != null
                      ? <span className={r.diferencia === 0 ? "text-emerald-600 font-bold" : r.diferencia > 0 ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                          {r.diferencia === 0 ? "Exacto" : r.diferencia > 0 ? `+${formatCurrency(r.diferencia)}` : formatCurrency(r.diferencia)}
                        </span>
                      : "—"
                  },
                  { key: "observaciones", label: "Observaciones", render: (r) => <span className="text-xs text-gray-400">{r.observaciones || "—"}</span> },
                ]}
                rows={data.cajas}
                emptyMsg="Sin sesiones de caja"
              />
            </div>
            <div className="sm:hidden divide-y divide-gray-50">
              {data.cajas.map((c, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-800">{c.cajero}</p>
                      <p className="text-xs text-gray-400">{fmtFechaCorta(c.fecha)}</p>
                    </div>
                    {c.estado === "ABIERTA"
                      ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Abierta</span>
                      : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Cerrada</span>
                    }
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Inicial</p><p className="font-bold">{formatCurrency(c.montoInicial)}</p></div>
                    <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Cierre</p><p className="font-bold">{c.montoCierre != null ? formatCurrency(c.montoCierre) : "—"}</p></div>
                    <div className={`rounded p-1.5 text-center ${c.diferencia != null && c.diferencia < 0 ? "bg-red-50" : "bg-gray-50"}`}>
                      <p className="text-gray-400">Diferencia</p>
                      <p className={`font-bold ${c.diferencia === 0 ? "text-emerald-600" : c.diferencia > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {c.diferencia != null ? (c.diferencia === 0 ? "✓" : formatCurrency(Math.abs(c.diferencia))) : "—"}
                      </p>
                    </div>
                  </div>
                  {c.observaciones && <p className="text-[10px] text-gray-400 italic">{c.observaciones}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagos del período */}
        {tabCaja === "pagos" && (
          <>
            <div className="hidden sm:block p-4">
              <Tabla
                headers={[
                  { key: "fecha", label: "Fecha/Hora", render: (r) => <span className="text-xs font-mono text-gray-500">{fmtHora(r.fecha)}<br /><span className="text-[10px]">{fmtFechaCorta(r.fecha)}</span></span> },
                  { key: "cajero", label: "Cajero" },
                  { key: "cliente", label: "Cliente" },
                  { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
                  { key: "capital", label: "Capital", right: true, render: (r) => formatCurrency(r.capital) },
                  { key: "interes", label: "Interés", right: true, render: (r) => formatCurrency(r.interes) },
                  { key: "mora", label: "Mora", right: true, render: (r) => r.mora > 0 ? <span className="text-red-600">{formatCurrency(r.mora)}</span> : "—" },
                  { key: "total", label: "Total", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.total)}</span> },
                  { key: "metodo", label: "Método", render: (r) => <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${METODO_COLOR[r.metodo] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{METODO_LABEL[r.metodo] ?? r.metodo}</span> },
                ]}
                rows={data.pagos}
                emptyMsg="Sin pagos en el período"
                footer={[
                  { value: "Totales" }, { value: "" }, { value: "" }, { value: "" },
                  { value: formatCurrency(data.resumen.totalCapital), right: true, color: "text-blue-700" },
                  { value: formatCurrency(data.resumen.totalInteres), right: true, color: "text-amber-700" },
                  { value: formatCurrency(data.resumen.totalMora), right: true, color: "text-red-700" },
                  { value: formatCurrency(data.resumen.totalCobrado), right: true, color: "text-emerald-700" },
                  { value: "" },
                ]}
              />
            </div>
            <div className="sm:hidden divide-y divide-gray-50">
              {data.pagos.length === 0
                ? <p className="text-center py-8 text-gray-400">Sin pagos en el período</p>
                : data.pagos.map((r, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                        <p className="text-xs text-gray-400">{r.cajero} · {fmtHora(r.fecha)}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-700 shrink-0">{formatCurrency(r.total)}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap text-[10px]">
                      <span className={`font-bold px-1.5 py-0.5 rounded-full border ${METODO_COLOR[r.metodo] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>{METODO_LABEL[r.metodo] ?? r.metodo}</span>
                      <span className="text-gray-400">Cap: {formatCurrency(r.capital)}</span>
                      <span className="text-amber-600">Int: {formatCurrency(r.interes)}</span>
                      {r.mora > 0 && <span className="text-red-600">Mora: {formatCurrency(r.mora)}</span>}
                    </div>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
