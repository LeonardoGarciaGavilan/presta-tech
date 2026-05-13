//Reportes.jsx
import { useState, useRef, useEffect } from "react";
import EstadoCuenta from "../components/EstadoCuenta";
import api from "../services/api";
import { formatCurrency, formatDate, formatCedula } from "../utils/prestamosUtils";
import * as XLSX from "xlsx";
import { PROVINCIAS } from "../utils/provincias-municipios";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmtFechaCorta = (f) => new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(f));
const fmtHora = (d) => new Intl.DateTimeFormat("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(d));

const ESTADO_COLOR = {
  ACTIVO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ATRASADO: "bg-red-100 text-red-700 border-red-200",
  PAGADO: "bg-blue-100 text-blue-700 border-blue-200",
  CANCELADO: "bg-gray-100 text-gray-500 border-gray-200",
};
const METODO_LABEL = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta", CHEQUE: "Cheque" };
const METODO_COLOR = { EFECTIVO: "bg-emerald-100 text-emerald-700 border-emerald-200", TRANSFERENCIA: "bg-blue-100 text-blue-700 border-blue-200", TARJETA: "bg-violet-100 text-violet-700 border-violet-200", CHEQUE: "bg-amber-100 text-amber-700 border-amber-200" };
const FRECUENCIA_LABEL = { DIARIO: "Diario", SEMANAL: "Semanal", QUINCENAL: "Quincenal", MENSUAL: "Mensual" };

if (typeof document !== "undefined" && !document.getElementById("reportes-styles")) {
  const s = document.createElement("style");
  s.id = "reportes-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium
      ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
      {type === "success" ? "✅" : "❌"} {message}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100 text-lg">×</button>
    </div>
  );
};

const Skeleton = ({ className }) => <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} />;

const SumCard = ({ label, value, color = "text-gray-900", bg = "bg-white", sub }) => (
  <div className={`${bg} rounded-xl border border-gray-100 shadow-sm px-4 py-3`}>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>}
  </div>
);

// ─── Tabla genérica ───────────────────────────────────────────────────────────
const Tabla = ({ headers, rows, emptyMsg = "Sin datos", footer }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-100">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
          {headers.map((h) => (
            <th key={h.key} className={`px-4 py-3 font-semibold ${h.right ? "text-right" : "text-left"}`}>{h.label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.length === 0
          ? <tr><td colSpan={headers.length} className="text-center py-10 text-gray-400">{emptyMsg}</td></tr>
          : rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
              {headers.map((h) => (
                <td key={h.key} className={`px-4 py-3 ${h.right ? "text-right" : ""}`}>
                  {h.render ? h.render(row) : row[h.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))
        }
      </tbody>
      {footer && (
        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
          <tr>{footer.map((f, i) => (
            <td key={i} className={`px-4 py-3 text-xs font-bold ${f.right ? "text-right" : ""} ${f.color ?? "text-gray-600"}`}>
              {f.value}
            </td>
          ))}</tr>
        </tfoot>
      )}
    </table>
  </div>
);

// ─── Exportar Excel ───────────────────────────────────────────────────────────
const exportarExcel = (sheets, filename) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ─── Exportar PDF ─────────────────────────────────────────────────────────────
const exportarPDF = (contenidoRef, titulo) => {
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
    setTimeout(() => { ventana.focus(); ventana.print(); }, 400);
    setTimeout(() => { try { if (!ventana.closed) ventana.close(); } catch (e) { console.error(e); } }, 15000);
  } catch (err) {
    console.error("Error al exportar PDF:", err);
  }
};

const TABS = [
  { id: "cobros", label: "Cobros", labelFull: "Cobros por período", icon: "💰" },
  { id: "cartera", label: "Cartera", labelFull: "Cartera vencida", icon: "⚠️" },
  { id: "estado", label: "Estado", labelFull: "Estado general", icon: "📊" },
  { id: "cliente", label: "Cliente", labelFull: "Historial por cliente", icon: "👤" },
  { id: "cajas", label: "Cajas", labelFull: "Reporte de cajas", icon: "🗃️" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  // Cajas: lista de usuarios para filtro
  const [usuarios, setUsuarios] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [tabCaja, setTabCaja] = useState("resumen"); // resumen|sesiones|pagos|cajeros

  useEffect(() => {
    if (tab === "cajas") {
      api.get("/usuarios").then(r => setUsuarios(r.data)).catch(() => { });
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

  const handleExcel = () => {
    if (!data) return;
    if (tab === "cobros") {
      exportarExcel([{
        name: "Cobros", data: data.pagos.map((p) => ({
          Fecha: new Date(p.fecha).toLocaleDateString("es-DO"), Cliente: p.cliente, Cédula: p.cedula,
          Capital: p.capital, Interés: p.interes, Mora: p.mora, Total: p.total,
          Método: METODO_LABEL[p.metodo] || p.metodo, Referencia: p.referencia, Cobrador: p.cobrador,
          Provincia: p.provincia || "—", Municipio: p.municipio || "—",
        }))
      }], `Cobros_${desde}_${hasta}`);
    }
    if (tab === "cartera") {
      exportarExcel([{
        name: "Cartera Vencida", data: data.prestamos.map((p) => ({
          Cliente: p.cliente, Cédula: p.cedula, Teléfono: p.telefono,
          "Monto Original": p.montoOriginal, "Saldo Pendiente": p.saldoPendiente,
          "Mora Acumulada": p.moraAcumulada, "Cuotas Vencidas": p.cuotasVencidas,
          "Días Atraso": p.diasMaxAtraso, Provincia: p.provincia || "—",
        }))
      }], "Cartera_Vencida");
    }
    if (tab === "estado") {
      exportarExcel([{
        name: "Estado Préstamos", data: data.prestamos.map((p) => ({
          Cliente: p.cliente, Cédula: p.cedula, "Monto Original": p.montoOriginal,
          "Saldo Pendiente": p.saldoPendiente, "Tasa %": p.tasaInteres,
          Frecuencia: FRECUENCIA_LABEL[p.frecuencia] || p.frecuencia, Estado: p.estado,
          "Cuotas Pendientes": p.cuotasPendientes,
        }))
      }], "Estado_General");
    }
    if (tab === "cliente" && data) {
      const pagos = data.prestamos.flatMap((pr) => pr.pagos.map((pg) => ({
        Fecha: new Date(pg.fecha).toLocaleDateString("es-DO"), Préstamo: formatCurrency(pr.monto),
        Capital: pg.capital, Interés: pg.interes, Mora: pg.mora, Total: pg.total,
        Método: METODO_LABEL[pg.metodo] || pg.metodo, Cobrador: pg.cobrador,
      })));
      exportarExcel([{ name: "Historial", data: pagos }],
        `Historial_${data.cliente.nombre.replace(/ /g, "_")}`);
    }
    if (tab === "cajas" && data) {
      exportarExcel([
        {
          name: "Resumen Cajeros", data: data.resumenPorUsuario.map((u) => ({
            Cajero: u.nombre, "Días trabajados": u.cajasAbiertas + u.cajasCerradas,
            "Cajas cerradas": u.cajasCerradas, "Total cobrado": u.totalCobrado,
            "En efectivo": u.totalEfectivo, "Total pagos": u.cantidadPagos,
            "Sobrantes": u.diferenciasPositivas,
            "Faltantes": u.diferenciasNegativas,
          }))
        },
        {
          name: "Resumen por Día", data: data.resumenPorDia.map((d) => ({
            Fecha: fmtFechaCorta(d.fecha), "Cajas abiertas": d.cajasAbiertas,
            "Cajas cerradas": d.cajasCerradas, "Total cobrado": d.totalCobrado,
            "Cantidad pagos": d.cantidadPagos,
          }))
        },
        {
          name: "Sesiones Caja", data: data.cajas.map((c) => ({
            Fecha: fmtFechaCorta(c.fecha), Cajero: c.cajero, Estado: c.estado,
            "Monto inicial": c.montoInicial, "Efectivo sistema": c.efectivoSistema ?? "—",
            "Efectivo real": c.efectivoReal ?? "—", Diferencia: c.diferencia ?? "—",
            Observaciones: c.observaciones ?? "",
          }))
        },
        {
          name: "Pagos", data: data.pagos.map((p) => ({
            Fecha: new Date(p.fecha).toLocaleDateString("es-DO"), Cajero: p.cajero,
            Cliente: p.cliente, Cédula: p.cedula, Capital: p.capital,
            Interés: p.interes, Mora: p.mora, Total: p.total,
            Método: METODO_LABEL[p.metodo] || p.metodo,
          }))
        },
      ], `Reporte_Cajas_${desde}_${hasta}`);
    }
    showToast("Archivo Excel exportado");
  };

  const fechaReporte = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

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

            {/* Fechas — cobros y cajas */}
            {(tab === "cobros" || tab === "cajas") && (
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

            {/* Filtro usuario — solo cajas */}
            {tab === "cajas" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Cajero <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="w-full sm:min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                  <option value="">Todos los cajeros</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
            )}

            {/* Filtro provincia */}
            {(tab === "cobros" || tab === "cartera" || tab === "estado") && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Provincia <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select value={filtroProvincia} onChange={(e) => setFiltroProvincia(e.target.value)}
                  className="w-full sm:min-w-44 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                  <option value="">Todas las provincias</option>
                  {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* Buscar cliente */}
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
                            <span className="text-gray-400 ml-2 text-xs font-mono">{formatCedula(c.cedula || "")}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Botones */}
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

            {/* Encabezado */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4">
              <h2 className="text-base font-bold text-gray-800">
                {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.labelFull}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {empresa} · Generado el {fechaReporte}
                {(tab === "cobros" || tab === "cajas") && ` · Período: ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)}`}
              </p>
            </div>

            {/* ══════════════════════════════════════════
                REPORTE DE CAJAS
            ══════════════════════════════════════════ */}
            {tab === "cajas" && (
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

                  {/* ── Por cajero ── */}
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
                      {/* Tarjetas móvil */}
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

                  {/* ── Por día ── */}
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

                  {/* ── Sesiones ── */}
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

                  {/* ── Pagos del período ── */}
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
            )}

            {/* ══ COBROS ══ */}
            {tab === "cobros" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SumCard label="Total cobrado" value={formatCurrency(data.totalCobrado)} color="text-emerald-600" bg="bg-emerald-50" />
                  <SumCard label="Total capital" value={formatCurrency(data.totalCapital)} color="text-blue-600" />
                  <SumCard label="Total intereses" value={formatCurrency(data.totalInteres)} color="text-amber-600" />
                  <SumCard label="Total mora" value={formatCurrency(data.totalMora)} color="text-red-600" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                  <p className="text-xs text-gray-400 mb-3">{data.totalPagos} pagos registrados</p>
                  <div className="hidden sm:block">
                    <Tabla
                      headers={[
                        { key: "fecha", label: "Fecha", render: (r) => formatDate(r.fecha) },
                        { key: "cliente", label: "Cliente" },
                        { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
                        { key: "provincia", label: "Provincia", render: (r) => r.provincia || "—" },
                        { key: "capital", label: "Capital", right: true, render: (r) => formatCurrency(r.capital) },
                        { key: "interes", label: "Interés", right: true, render: (r) => formatCurrency(r.interes) },
                        { key: "mora", label: "Mora", right: true, render: (r) => r.mora > 0 ? <span className="text-red-600">{formatCurrency(r.mora)}</span> : "—" },
                        { key: "total", label: "Total", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.total)}</span> },
                        { key: "metodo", label: "Método", render: (r) => METODO_LABEL[r.metodo] || r.metodo },
                        { key: "cobrador", label: "Cobrador" },
                      ]}
                      rows={data.pagos}
                      emptyMsg="Sin pagos en este período"
                    />
                  </div>
                  <div className="sm:hidden space-y-2">
                    {data.pagos.length === 0
                      ? <p className="text-center py-8 text-gray-400">Sin pagos en este período</p>
                      : data.pagos.map((r, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                              <p className="text-xs text-gray-400 font-mono">{formatCedula(r.cedula)} · {formatDate(r.fecha)}</p>
                            </div>
                            <p className="text-sm font-bold text-emerald-700 shrink-0">{formatCurrency(r.total)}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[10px]">
                            <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Capital</p><p className="font-bold text-blue-700">{formatCurrency(r.capital)}</p></div>
                            <div className="bg-amber-50 rounded p-1.5 text-center"><p className="text-amber-400">Interés</p><p className="font-bold text-amber-700">{formatCurrency(r.interes)}</p></div>
                            <div className="bg-red-50 rounded p-1.5 text-center"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{r.mora > 0 ? formatCurrency(r.mora) : "—"}</p></div>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}

            {/* ══ CARTERA VENCIDA ══ */}
            {tab === "cartera" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <SumCard label="Préstamos atrasados" value={data.totalPrestamos} color="text-red-600" bg="bg-red-50" />
                  <SumCard label="Saldo total vencido" value={formatCurrency(data.totalSaldoVencido)} color="text-gray-800" />
                  <SumCard label="Mora acumulada total" value={formatCurrency(data.totalMora)} color="text-amber-600" bg="bg-amber-50" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                  <div className="hidden sm:block">
                    <Tabla
                      headers={[
                        { key: "cliente", label: "Cliente" },
                        { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
                        { key: "telefono", label: "Teléfono" },
                        { key: "saldoPendiente", label: "Saldo", right: true, render: (r) => formatCurrency(r.saldoPendiente) },
                        { key: "moraAcumulada", label: "Mora", right: true, render: (r) => <span className="text-red-600 font-semibold">{formatCurrency(r.moraAcumulada)}</span> },
                        { key: "cuotasVencidas", label: "Cuotas venc.", right: true },
                        { key: "diasMaxAtraso", label: "Días atraso", right: true, render: (r) => <span className={r.diasMaxAtraso > 30 ? "text-red-600 font-bold" : "text-amber-600"}>{r.diasMaxAtraso}</span> },
                      ]}
                      rows={data.prestamos}
                      emptyMsg="No hay préstamos atrasados"
                    />
                  </div>
                  <div className="sm:hidden space-y-2">
                    {data.prestamos.map((r, i) => (
                      <div key={i} className="border border-red-100 rounded-xl p-3 bg-red-50/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                            <p className="text-xs text-gray-400 font-mono">{formatCedula(r.cedula)}</p>
                          </div>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${r.diasMaxAtraso > 30 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.diasMaxAtraso}d</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          <div className="bg-white rounded p-1.5 text-center border border-gray-100"><p className="text-gray-400">Saldo</p><p className="font-bold">{formatCurrency(r.saldoPendiente)}</p></div>
                          <div className="bg-red-50 rounded p-1.5 text-center border border-red-100"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{formatCurrency(r.moraAcumulada)}</p></div>
                          <div className="bg-white rounded p-1.5 text-center border border-gray-100"><p className="text-gray-400">Cuotas</p><p className="font-bold">{r.cuotasVencidas}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══ ESTADO GENERAL ══ */}
            {tab === "estado" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SumCard label="Activos" value={data.resumen.activos} color="text-emerald-600" bg="bg-emerald-50" />
                  <SumCard label="Atrasados" value={data.resumen.atrasados} color="text-red-600" bg="bg-red-50" />
                  <SumCard label="Pagados" value={data.resumen.pagados} color="text-blue-600" />
                  <SumCard label="Cartera activa" value={formatCurrency(data.resumen.totalCartera)} color="text-gray-800" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                  <p className="text-xs text-gray-400 mb-3">Total desembolsado: <strong>{formatCurrency(data.resumen.totalDesembolsado)}</strong></p>
                  <div className="hidden sm:block">
                    <Tabla
                      headers={[
                        { key: "cliente", label: "Cliente" },
                        { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
                        { key: "montoOriginal", label: "Monto", right: true, render: (r) => formatCurrency(r.montoOriginal) },
                        { key: "saldoPendiente", label: "Saldo", right: true, render: (r) => formatCurrency(r.saldoPendiente) },
                        { key: "tasaInteres", label: "Tasa", right: true, render: (r) => `${r.tasaInteres}%` },
                        { key: "frecuencia", label: "Frecuencia", render: (r) => FRECUENCIA_LABEL[r.frecuencia] || r.frecuencia },
                        { key: "estado", label: "Estado", render: (r) => <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[r.estado]}`}>{r.estado}</span> },
                        { key: "cuotasPendientes", label: "Cuotas pend.", right: true },
                      ]}
                      rows={data.prestamos}
                      emptyMsg="Sin préstamos registrados"
                    />
                  </div>
                  <div className="sm:hidden space-y-2">
                    {data.prestamos.map((r, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                            <p className="text-xs text-gray-400 font-mono">{formatCedula(r.cedula)}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[r.estado]}`}>{r.estado}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Monto</p><p className="font-bold">{formatCurrency(r.montoOriginal)}</p></div>
                          <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Saldo</p><p className="font-bold text-blue-700">{formatCurrency(r.saldoPendiente)}</p></div>
                          <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Cuotas</p><p className="font-bold">{r.cuotasPendientes}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══ HISTORIAL POR CLIENTE ══ */}
            {tab === "cliente" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-lg font-bold text-blue-700 shrink-0">
                      {data.cliente.nombre[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800">{data.cliente.nombre}</p>
                      <p className="text-xs text-gray-400 font-mono">{formatCedula(data.cliente.cedula)} · {data.cliente.telefono}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
                    <button onClick={() => setEstadoCuentaId(clienteSelected?.id)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all">
                      Ver Estado de Cuenta
                    </button>
                    <div className="grid grid-cols-2 gap-3 sm:ml-auto">
                      <SumCard label="Préstamos" value={data.totalPrestamos} color="text-blue-600" />
                      <SumCard label="Total pagado" value={formatCurrency(data.totalPagado)} color="text-emerald-600" bg="bg-emerald-50" />
                    </div>
                  </div>
                </div>
                {data.prestamos.map((pr, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">Préstamo {i + 1}</span>
                        <span className="text-sm text-gray-500">{formatCurrency(pr.monto)}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[pr.estado]}`}>{pr.estado}</span>
                      </div>
                      <p className="text-xs text-gray-400">{pr.cuotasPagadas} / {pr.totalCuotas} cuotas · Saldo: <strong>{formatCurrency(pr.saldo)}</strong></p>
                    </div>
                    <div className="hidden sm:block">
                      <Tabla
                        headers={[
                          { key: "fecha", label: "Fecha", render: (r) => formatDate(r.fecha) },
                          { key: "capital", label: "Capital", right: true, render: (r) => formatCurrency(r.capital) },
                          { key: "interes", label: "Interés", right: true, render: (r) => formatCurrency(r.interes) },
                          { key: "mora", label: "Mora", right: true, render: (r) => r.mora > 0 ? <span className="text-red-600">{formatCurrency(r.mora)}</span> : "—" },
                          { key: "total", label: "Total", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.total)}</span> },
                          { key: "metodo", label: "Método", render: (r) => METODO_LABEL[r.metodo] || r.metodo },
                          { key: "cobrador", label: "Cobrador" },
                        ]}
                        rows={pr.pagos}
                        emptyMsg="Sin pagos registrados"
                      />
                    </div>
                    <div className="sm:hidden space-y-2">
                      {pr.pagos.map((r, j) => (
                        <div key={j} className="border border-gray-100 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-500">{formatDate(r.fecha)}</p>
                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(r.total)}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[10px]">
                            <div className="bg-blue-50 rounded p-1 text-center"><p className="text-blue-400">Capital</p><p className="font-bold text-blue-700">{formatCurrency(r.capital)}</p></div>
                            <div className="bg-amber-50 rounded p-1 text-center"><p className="text-amber-400">Interés</p><p className="font-bold text-amber-700">{formatCurrency(r.interes)}</p></div>
                            <div className="bg-red-50 rounded p-1 text-center"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{r.mora > 0 ? formatCurrency(r.mora) : "—"}</p></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer PDF */}
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