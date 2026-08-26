//Reportes.jsx — Orquestador de reportes (slim)
import { useState, useRef, useEffect } from "react";
import EstadoCuenta from "../components/EstadoCuenta";
import api from "../services/api";
import { formatCurrency } from "../utils/prestamosUtils";
import { PROVINCIAS } from "../utils/provincias-municipios";
import { TABS } from "./reportes/reporteConstants";
import { hoy, primerDiaMes, exportarExcel, exportarPDF, fechaReporte } from "./reportes/reporteHelpers";
import { Toast, Skeleton } from "./reportes/reporteShared";
import CobrosReport from "./reportes/CobrosReport";
import CarteraReport from "./reportes/CarteraReport";
import EstadoReport from "./reportes/EstadoReport";
import ClienteReport from "./reportes/ClienteReport";
import CajasReport from "./reportes/CajasReport";
import FlujoCajaReport from "./reportes/FlujoCajaReport";
import DesempenoCobradorReport from "./reportes/DesempenoCobradorReport";
import ProyeccionCuotasReport from "./reportes/ProyeccionCuotasReport";

if (typeof document !== "undefined" && !document.getElementById("reportes-styles")) {
  const s = document.createElement("style");
  s.id = "reportes-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

export default function Reportes() {
  const [tab, setTab] = useState("cobros");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);
  const contenidoRef = useRef(null);

  const [desde, setDesde] = useState(primerDiaMes());
  const [hasta, setHasta] = useState(hoy());
  const [filtroProvincia, setFiltroProvincia] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [clientesSuger, setClientesSuger] = useState([]);
  const [clienteSelected, setClienteSelected] = useState(null);
  const [buscandoCli, setBuscandoCli] = useState(false);
  const [estadoCuentaId, setEstadoCuentaId] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");

  useEffect(() => {
    if (tab === "cajas") {
      api.get("/usuarios").then(r => setUsuarios(r.data)).catch(() => {});
    }
  }, [tab]);

  const empresa = JSON.parse(localStorage.getItem("user") || "{}").empresa || "Sistema de Préstamos";
  const showToast = (message, type = "success") => setToast({ message, type });
  const cambiarTab = (t) => { setTab(t); setData(null); setFiltroProvincia(""); setFiltroUsuario(""); };

  const generar = async () => {
    setLoading(true); setData(null);
    try {
      let res;
      const provQ = filtroProvincia ? `&provincia=${encodeURIComponent(filtroProvincia)}` : "";
      const provQS = filtroProvincia ? `?provincia=${encodeURIComponent(filtroProvincia)}` : "";
      if (tab === "cobros") res = await api.get(`/reportes/cobros?desde=${desde}&hasta=${hasta}${provQ}`);
      if (tab === "cartera") res = await api.get(`/reportes/cartera-vencida${provQS}`);
      if (tab === "estado") res = await api.get(`/reportes/estado-general${provQS}`);
      if (tab === "cajas") {
        const uQ = filtroUsuario ? `&usuarioId=${filtroUsuario}` : "";
        res = await api.get(`/reportes/cajas?desde=${desde}&hasta=${hasta}${uQ}`);
      }
      if (tab === "cliente") {
        if (!clienteSelected) { showToast("Selecciona un cliente primero", "error"); setLoading(false); return; }
        res = await api.get(`/reportes/cliente/${clienteSelected.id}`);
      }
      if (tab === "flujo") {
        const uQ = filtroUsuario ? `&usuarioId=${filtroUsuario}` : "";
        res = await api.get(`/reportes/flujo-caja?desde=${desde}&hasta=${hasta}${uQ}`);
      }
      if (tab === "cobrador") {
        const uQ = filtroUsuario ? `&usuarioId=${filtroUsuario}` : "";
        const dQ = desde ? `&desde=${desde}` : "";
        const hQ = hasta ? `&hasta=${hasta}` : "";
        res = await api.get(`/reportes/desempeno-cobrador?${dQ}${hQ}${uQ}`);
      }
      if (tab === "proyeccion") {
        res = await api.get(`/reportes/proyeccion-cuotas${provQS}`);
      }
      setData(res.data);
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al generar reporte", "error");
    } finally { setLoading(false); }
  };

  const buscarClientes = async (q) => {
    setClienteQuery(q);
    if (q.length < 2) { setClientesSuger([]); return; }
    setBuscandoCli(true);
    try {
      const res = await api.get(`/clientes?search=${encodeURIComponent(q)}`);
      const lista = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setClientesSuger(lista.slice(0, 6));
    } catch { /* silencioso */ }
    finally { setBuscandoCli(false); }
  };

  // ─── Export helpers ──────────────────────────────────────────────────────────
  const handleExcel = () => {
    if (!data) return;
    if (tab === "cobros") {
      exportarExcel([{ name: "Cobros", data: data.pagos.map((p) => ({
        Fecha: new Date(p.fecha).toLocaleDateString("es-DO"), Cliente: p.cliente, Cédula: p.cedula,
        Capital: p.capital, Interés: p.interes, Mora: p.mora, Total: p.total,
        Método: p.metodo, Referencia: p.referencia, Cobrador: p.cobrador,
        Provincia: p.provincia || "—", Municipio: p.municipio || "—",
      })) }], `Cobros_${desde}_${hasta}`);
    }
    if (tab === "cartera") {
      exportarExcel([{ name: "Cartera Vencida", data: data.prestamos.map((p) => ({
        Cliente: p.cliente, Cédula: p.cedula, Teléfono: p.telefono,
        "Monto Original": p.montoOriginal, "Saldo Pendiente": p.saldoPendiente,
        "Mora Acumulada": p.moraAcumulada, "Cuotas Vencidas": p.cuotasVencidas,
        "Días Atraso": p.diasMaxAtraso, Provincia: p.provincia || "—",
      })) }], "Cartera_Vencida");
    }
    if (tab === "estado") {
      exportarExcel([{ name: "Estado Préstamos", data: data.prestamos.map((p) => ({
        Cliente: p.cliente, Cédula: p.cedula, "Monto Original": p.montoOriginal,
        "Saldo Pendiente": p.saldoPendiente, "Tasa %": p.tasaInteres,
        Frecuencia: p.frecuencia, Estado: p.estado,
        "Cuotas Pendientes": p.cuotasPendientes,
      })) }], "Estado_General");
    }
    if (tab === "cliente" && data) {
      const pagos = data.prestamos.flatMap((pr) => pr.pagos.map((pg) => ({
        Fecha: new Date(pg.fecha).toLocaleDateString("es-DO"), Préstamo: formatCurrency(pr.monto),
        Capital: pg.capital, Interés: pg.interes, Mora: pg.mora, Total: pg.total,
        Método: pg.metodo, Cobrador: pg.cobrador,
      })));
      exportarExcel([{ name: "Historial", data: pagos }], `Historial_${data.cliente.nombre.replace(/ /g, "_")}`);
    }
    if (tab === "cajas" && data) {
      exportarExcel([
        { name: "Resumen Cajeros", data: data.resumenPorUsuario.map((u) => ({
          Cajero: u.nombre, "Días trabajados": u.cajasAbiertas + u.cajasCerradas,
          "Cajas cerradas": u.cajasCerradas, "Total cobrado": u.totalCobrado,
          "En efectivo": u.totalEfectivo, "Total pagos": u.cantidadPagos,
          "Sobrantes": u.diferenciasPositivas, "Faltantes": u.diferenciasNegativas,
        })) },
        { name: "Resumen por Día", data: data.resumenPorDia.map((d) => ({
          Fecha: new Date(d.fecha).toLocaleDateString("es-DO"), "Cajas abiertas": d.cajasAbiertas,
          "Cajas cerradas": d.cajasCerradas, "Total cobrado": d.totalCobrado,
          "Cantidad pagos": d.cantidadPagos,
        })) },
        { name: "Sesiones Caja", data: data.cajas.map((c) => ({
          Fecha: new Date(c.fecha).toLocaleDateString("es-DO"), Cajero: c.cajero, Estado: c.estado,
          "Monto inicial": c.montoInicial, Diferencia: c.diferencia ?? "—",
          Observaciones: c.observaciones ?? "",
        })) },
        { name: "Pagos", data: data.pagos.map((p) => ({
          Fecha: new Date(p.fecha).toLocaleDateString("es-DO"), Cajero: p.cajero,
          Cliente: p.cliente, Cédula: p.cedula, Capital: p.capital,
          Interés: p.interes, Mora: p.mora, Total: p.total, Método: p.metodo,
        })) },
      ], `Reporte_Cajas_${desde}_${hasta}`);
    }
    if (tab === "flujo") {
      exportarExcel([{ name: "Flujo de Caja", data: data.porDia.map((d) => ({
        Fecha: d.fecha, Entradas: d.entradas, Salidas: d.salidas, Neto: d.neto,
      })) }], `Flujo_Caja_${desde}_${hasta}`);
    }
    if (tab === "cobrador") {
      exportarExcel([{ name: "Desempeño Cobrador", data: data.cobradores.map((c) => ({
        Cobrador: c.nombre, Pagos: c.cantidadPagos, "Días activos": c.diasActivos,
        "Total cobrado": c.totalCobrado, Capital: c.totalCapital, Interés: c.totalInteres,
        Mora: c.totalMora, "Promedio/pago": c.promedioPorPago, "Promedio/día": c.promedioPorDia,
      })) }], "Desempeno_Cobrador");
    }
    if (tab === "proyeccion") {
      exportarExcel([
        { name: "Resumen por Mes", data: data.porMes.map((m) => ({
          Mes: m.month, Cuotas: m.cantidadCuotas, Capital: m.montoCapital,
          Interés: m.montoInteres, Mora: m.montoMora, Total: m.montoTotal, Vencidas: m.vencidas,
        })) },
        { name: "Detalle Cuotas", data: data.detalles.map((d) => ({
          Cliente: d.cliente, Cédula: d.cedula, "Préstamo #": d.prestamoId.slice(0, 8),
          "Cuota #": d.numeroCuota, Monto: d.monto, Vencimiento: new Date(d.fechaVencimiento).toLocaleDateString("es-DO"),
          Vencida: d.vencida ? "Sí" : "No",
        })) },
      ], "Proyeccion_Cuotas");
    }
    showToast("Archivo Excel exportado");
  };

  return (
    <>
      {estadoCuentaId && <EstadoCuenta clienteId={estadoCuentaId} onClose={() => setEstadoCuentaId(null)} />}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-4" style={{ animation: "fadeUp 0.3s ease both" }}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-400 mt-0.5 hidden sm:block">Genera y exporta reportes del sistema</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => cambiarTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0
                ${tab === t.id ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              <span>{t.icon}</span>
              <span className="sm:hidden">{t.label}</span>
              <span className="hidden sm:inline">{t.labelFull}</span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
            {(tab === "cobros" || tab === "cajas" || tab === "flujo") && (
              <div className="grid grid-cols-2 sm:flex gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Desde</label>
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Hasta</label>
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {(tab === "cajas" || tab === "flujo" || tab === "cobrador") && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Cajero <span className="text-gray-400 font-normal">(opcional)</span></label>
                <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="w-full sm:min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                  <option value="">Todos los cajeros</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            )}

            {(tab === "cobros" || tab === "cartera" || tab === "estado" || tab === "proyeccion") && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Provincia <span className="text-gray-400 font-normal">(opcional)</span></label>
                <select value={filtroProvincia} onChange={(e) => setFiltroProvincia(e.target.value)}
                  className="w-full sm:min-w-44 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                  <option value="">Todas las provincias</option>
                  {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {tab === "cliente" && (
              <div className="w-full sm:flex-1 sm:min-w-64 relative">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Buscar cliente</label>
                {clienteSelected ? (
                  <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-semibold text-emerald-800 flex-1">{clienteSelected.nombre} {clienteSelected.apellido}</span>
                    <button onClick={() => { setClienteSelected(null); setClienteQuery(""); setData(null); }} className="text-emerald-600 hover:text-red-500 text-lg leading-none">×</button>
                  </div>
                ) : (
                  <>
                    <input type="text" value={clienteQuery} onChange={(e) => buscarClientes(e.target.value)}
                      placeholder="Nombre o cédula…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {clientesSuger.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                        {clientesSuger.map((c) => (
                          <button key={c.id} onClick={() => { setClienteSelected(c); setClientesSuger([]); setClienteQuery(""); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm transition-colors border-b border-gray-50 last:border-0">
                            <span className="font-semibold">{c.nombre} {c.apellido}</span>
                            <span className="text-gray-400 ml-2 text-xs font-mono">{c.cedula || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <button onClick={generar} disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                }
                Generar
              </button>
              {data && (
                <>
                  <button onClick={() => exportarPDF(contenidoRef, TABS.find(t => t.id === tab)?.labelFull)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold border border-red-200 transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    <span className="hidden sm:inline">Imprimir / </span>PDF
                  </button>
                  <button onClick={handleExcel}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold border border-emerald-200 transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Excel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            <Skeleton className="h-64" />
          </div>
        )}

        {/* Resultado */}
        {!loading && data && (
          <div ref={contenidoRef}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4">
              <h2 className="text-base font-bold text-gray-800">
                {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.labelFull}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {empresa} · Generado el {fechaReporte}
                {(tab === "cobros" || tab === "cajas" || tab === "flujo") && ` · Período: ${new Date(desde).toLocaleDateString("es-DO")} – ${new Date(hasta).toLocaleDateString("es-DO")}`}
              </p>
            </div>

            {tab === "cobros" && <CobrosReport data={data} />}
            {tab === "cartera" && <CarteraReport data={data} />}
            {tab === "estado" && <EstadoReport data={data} />}
            {tab === "cliente" && (
              <ClienteReport
                data={data}
                onVerEstadoCuenta={() => setEstadoCuentaId(clienteSelected?.id)}
              />
            )}
            {tab === "cajas" && <CajasReport data={data} />}
            {tab === "flujo" && <FlujoCajaReport data={data} />}
            {tab === "cobrador" && <DesempenoCobradorReport data={data} />}
            {tab === "proyeccion" && <ProyeccionCuotasReport data={data} />}

            <div className="mt-4 pt-3 border-t border-dashed border-gray-200 text-center text-xs text-gray-400">
              {empresa} · Reporte generado el {fechaReporte}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!loading && !data && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium text-gray-500 text-center px-4">Configura los filtros y presiona <strong>Generar</strong></p>
            <p className="text-xs mt-1">Los datos se mostrarán aquí listos para exportar</p>
          </div>
        )}
      </div>
    </>
  );
}
