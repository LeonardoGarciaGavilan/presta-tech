// src/pages/Prestamos.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import TablaAmortizacionModal from "../components/TablaAmortizacionModal";
import { useAuth } from "../context/AuthContext";
import {
  formatCurrency, formatDate, formatCedula,
  EstadoBadge, ESTADO_CONFIG, FRECUENCIA_LABEL,
} from "../utils/prestamosUtils";

const POR_PAGINA = 20;

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const FLUJO_CONFIG = {
  SOLICITADO:  { label: "Solicitado",  bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200",    dot: "bg-sky-500"    },
  EN_REVISION: { label: "En Revisión", bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
  APROBADO:    { label: "Aprobado",    bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200",dot: "bg-emerald-500"},
  RECHAZADO:   { label: "Rechazado",   bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500"    },
};
const ESTADOS_FLUJO = ["SOLICITADO", "EN_REVISION", "APROBADO", "RECHAZADO"];

const FlujoBadge = ({ estado }) => {
  const cfg = FLUJO_CONFIG[estado];
  if (!cfg) return <EstadoBadge estado={estado} />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const ModalCambiarEstado = ({ prestamo, accion, onConfirm, onClose, loading }) => {
  const [motivo, setMotivo] = useState("");
  const CONFIG = {
    EN_REVISION:  { titulo: "Poner en Revisión",   desc: "El préstamo pasará a estado EN REVISIÓN.",                                         color: "from-violet-500 to-violet-600",  btn: "bg-violet-600 hover:bg-violet-700",  icon: "🔍", pedirMotivo: false },
    APROBADO:     { titulo: "Aprobar Préstamo",     desc: "El préstamo quedará APROBADO y pendiente de desembolso.",                           color: "from-emerald-500 to-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700", icon: "✅", pedirMotivo: false },
    RECHAZADO:    { titulo: "Rechazar Préstamo",    desc: "El préstamo será RECHAZADO. Esta acción no se puede deshacer.",                    color: "from-red-500 to-red-600",         btn: "bg-red-600 hover:bg-red-700",        icon: "❌", pedirMotivo: true  },
    DESEMBOLSADO: { titulo: "Desembolsar Préstamo", desc: "Se generarán las cuotas, el monto saldrá de tu caja y el préstamo quedará ACTIVO.", color: "from-blue-500 to-blue-700",       btn: "bg-blue-600 hover:bg-blue-700",      icon: "💰", pedirMotivo: false },
  };
  const cfg = CONFIG[accion];
  if (!cfg) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ animation: "fadeUp 0.2s ease" }}>
        <div className={`bg-gradient-to-r ${cfg.color} px-5 py-4 text-white`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">{cfg.icon}</div>
            <div>
              <h3 className="font-bold text-base">{cfg.titulo}</h3>
              <p className="text-xs opacity-80">{prestamo.cliente?.nombre} {prestamo.cliente?.apellido}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">Monto</span><span className="font-semibold">{formatCurrency(prestamo.monto)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cuotas</span><span className="font-semibold">{prestamo.numeroCuotas} · {prestamo.tasaInteres}% mensual</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Frecuencia</span><span className="font-semibold">{FRECUENCIA_LABEL[prestamo.frecuenciaPago]}</span></div>
          </div>
          <p className="text-sm text-gray-600">{cfg.desc}</p>
          {cfg.pedirMotivo && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Motivo del rechazo <span className="text-red-500">*</span></label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                placeholder="Explica el motivo del rechazo…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => onConfirm(accion, motivo)}
              disabled={loading || (cfg.pedirMotivo && !motivo.trim())}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 ${cfg.btn}`}>
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : cfg.icon}
              {loading ? "Procesando…" : cfg.titulo}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Spinner = () => (
  <div className="flex justify-center items-center py-20">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
  </div>
);

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium ${type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"}`}>
      {type === "success"
        ? <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        : <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>}
      {message}
    </div>
  );
};

const StatCard = ({ label, value, sub, color = "blue" }) => {
  const colors = { blue: "from-blue-600 to-blue-700", emerald: "from-emerald-600 to-emerald-700", red: "from-red-500 to-red-600", amber: "from-amber-500 to-amber-600", sky: "from-sky-500 to-sky-600" };
  return (
    <div className={`bg-gradient-to-br ${colors[color] ?? colors.blue} rounded-xl p-4 text-white shadow-lg`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</p>
      <p className="text-xl md:text-2xl font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
};

const Paginacion = ({ pagina, totalPaginas, total, porPagina, onChange, loading }) => {
  if (totalPaginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const pages = [];
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || (i >= pagina - 1 && i <= pagina + 1)) pages.push(i);
  }
  const withEllipsis = []; let prev = null;
  for (const p of pages) { if (prev && p - prev > 1) withEllipsis.push("..."); withEllipsis.push(p); prev = p; }
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 order-2 sm:order-1">
        Mostrando <span className="font-semibold text-gray-600">{desde}–{hasta}</span> de{" "}
        <span className="font-semibold text-gray-600">{total}</span> préstamos
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button onClick={() => onChange(pagina - 1)} disabled={pagina === 1 || loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        {withEllipsis.map((p, i) =>
          p === "..." ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
          : <button key={p} onClick={() => onChange(p)} disabled={loading}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all ${p === pagina ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>
        )}
        <button onClick={() => onChange(pagina + 1)} disabled={pagina === totalPaginas || loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  );
};

// ── Tarjeta móvil ─────────────────────────────────────────────────────────────
const TarjetaPrestamo = ({ p, isAdmin, userId, onPagar, onAmortizacion, onDetalle, onAccion, diasGracia = 0 }) => {
  const cuota   = p.cuotas?.[0] ?? null;
  const vencida = cuota && (() => { const lim = new Date(cuota.fechaVencimiento); lim.setDate(lim.getDate() + diasGracia); return lim < new Date(); })();
  const esFlujo          = ESTADOS_FLUJO.includes(p.estado);
  const puedesPagar      = ["ACTIVO","ATRASADO"].includes(p.estado);
  const puedeDesembolsar = p.estado === "APROBADO" && (isAdmin || p.solicitadoPor === userId);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{p.cliente?.nombre} {p.cliente?.apellido}</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{formatCedula(p.cliente?.cedula||"")}</p>
        </div>
        <FlujoBadge estado={p.estado} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div><span className="text-gray-400">Monto</span><p className="font-bold text-gray-800">{formatCurrency(p.monto)}</p></div>
        <div><span className="text-gray-400">Cuotas</span><p className="font-medium text-gray-700">{p.numeroCuotas} · {p.tasaInteres}%</p></div>
        <div><span className="text-gray-400">Frecuencia</span><p className="font-medium text-gray-700">{FRECUENCIA_LABEL[p.frecuenciaPago]}</p></div>
        {!esFlujo && <div><span className="text-gray-400">Saldo</span><p className="font-bold text-gray-800">{formatCurrency(p.saldoPendiente)}</p></div>}
        {cuota && (
          <div className="col-span-2">
            <span className="text-gray-400">Próx. cuota</span>
            <p className={`font-semibold ${vencida?"text-red-600":"text-gray-800"}`}>
              {formatCurrency(cuota.monto+(cuota.mora||0))} · {formatDate(cuota.fechaVencimiento)}
            </p>
          </div>
        )}
        {p.motivoRechazo && (
          <div className="col-span-2 bg-red-50 rounded-lg px-2 py-1.5">
            <span className="text-red-500 text-[10px] font-bold">Motivo: </span>
            <span className="text-red-700 text-[10px]">{p.motivoRechazo}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
        {isAdmin && p.estado === "SOLICITADO" && (<>
          <button onClick={() => onAccion(p,"EN_REVISION")} className="flex-1 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200">🔍 Revisar</button>
          <button onClick={() => onAccion(p,"RECHAZADO")}   className="flex-1 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">❌ Rechazar</button>
        </>)}
        {isAdmin && p.estado === "EN_REVISION" && (<>
          <button onClick={() => onAccion(p,"APROBADO")}  className="flex-1 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">✅ Aprobar</button>
          <button onClick={() => onAccion(p,"RECHAZADO")} className="flex-1 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">❌ Rechazar</button>
        </>)}
        {/* Desembolsar: admin O el usuario que solicitó el préstamo */}
        {puedeDesembolsar && (
          <button onClick={() => onAccion(p,"DESEMBOLSADO")} className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">💰 Desembolsar</button>
        )}
        {puedesPagar && (
          <button onClick={onPagar} className="flex-1 min-w-[70px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Pagar</button>
        )}
        <button onClick={onAmortizacion} className="flex-1 min-w-[70px] py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200">Amort.</button>
        <button onClick={onDetalle}      className="flex-1 min-w-[70px] py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">Detalle</button>
      </div>
    </div>
  );
};

if (typeof document !== "undefined" && !document.getElementById("prestamos-styles")) {
  const s = document.createElement("style"); s.id = "prestamos-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

export default function Prestamos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin  = user?.rol === "ADMIN";
  // Extraer userId de forma segura independiente de cómo venga el token
  const userId   = user?.id ?? user?.sub ?? user?.userId;

  const [prestamos,        setPrestamos]        = useState([]);
  const [totalPrestamos,   setTotalPrestamos]   = useState(0);
  const [totalPaginas,     setTotalPaginas]     = useState(1);
  const [pagina,           setPagina]           = useState(1);
  const [search,           setSearch]           = useState("");
  const [filtroEstado,     setFiltroEstado]     = useState("TODOS");
  const searchDebounced = useDebounce(search, 400);

  const [solicitudes,      setSolicitudes]      = useState([]);
  const [resumen,          setResumen]          = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [loadingPrestamos, setLoadingPrestamos] = useState(false);
  const [amortizacionId,   setAmortizacionId]   = useState(null);
  const [toast,            setToast]            = useState(null);
  const [tab,              setTab]              = useState("prestamos");
  const [diasGracia,       setDiasGracia]       = useState(0);
  const [modalAccion,      setModalAccion]      = useState(null);
  const [actionLoading,    setActionLoading]    = useState(false);

  const showToast = useCallback((msg, type = "success") => setToast({ message: msg, type }), []);

  const fetchStatic = useCallback(async () => {
    try {
      const calls = [api.get("/prestamos/resumen"), api.get("/configuracion")];
      if (isAdmin) calls.push(api.get("/prestamos/solicitudes"));
      const [rRes, cfgRes, sRes] = await Promise.all(calls);
      setResumen(rRes.data);
      setDiasGracia(cfgRes.data?.diasGracia ?? 0);
      if (sRes) setSolicitudes(sRes.data);
    } catch (err) { console.error(err); }
  }, [isAdmin]);

  const fetchPrestamos = useCallback(async (pg = 1) => {
    setLoadingPrestamos(true);
    try {
      const params = new URLSearchParams({
        page:  String(pg),
        limit: String(POR_PAGINA),
        ...(searchDebounced ? { search: searchDebounced } : {}),
        ...(filtroEstado !== "TODOS" ? { estado: filtroEstado } : {}),
      });
      const res = await api.get(`/prestamos?${params}`);
      setPrestamos(res.data.data);
      setTotalPrestamos(res.data.total);
      setTotalPaginas(res.data.totalPaginas);
      setPagina(res.data.pagina);
    } catch (err) { console.error(err); }
    finally { setLoadingPrestamos(false); }
  }, [searchDebounced, filtroEstado]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatic(), fetchPrestamos(1)]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setPagina(1); }, [searchDebounced, filtroEstado]);

  useEffect(() => {
    if (!loading) fetchPrestamos(pagina);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, searchDebounced, filtroEstado]);

  const handlePageChange = (nueva) => {
    if (nueva < 1 || nueva > totalPaginas) return;
    setPagina(nueva);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAccion = async (accion, motivo) => {
    if (!modalAccion) return;
    setActionLoading(true);
    try {
      if (accion === "DESEMBOLSADO") {
        await api.patch(`/prestamos/${modalAccion.prestamo.id}/desembolsar`);
        showToast("¡Préstamo desembolsado! Las cuotas han sido generadas 🎉");
      } else {
        await api.patch(`/prestamos/${modalAccion.prestamo.id}/estado`, { estado: accion, motivo });
        showToast(`Estado actualizado a ${accion}`);
      }
      setModalAccion(null);
      fetchStatic();
      fetchPrestamos(pagina);
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al actualizar el estado", "error");
    } finally { setActionLoading(false); }
  };

  const estadosFiltro    = ["TODOS","ACTIVO","ATRASADO","PAGADO","CANCELADO","SOLICITADO","EN_REVISION","APROBADO","RECHAZADO"];
  const puedesPagar      = (estado) => ["ACTIVO","ATRASADO"].includes(estado);
  // Puede desembolsar: admin O el usuario que solicitó el préstamo
  const puedeDesembolsar = (p) => p.estado === "APROBADO" && (isAdmin || p.solicitadoPor === userId);

  return (
    <>
      {amortizacionId && <TablaAmortizacionModal prestamoId={amortizacionId} onClose={() => setAmortizacionId(null)}/>}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {modalAccion && (
        <ModalCambiarEstado prestamo={modalAccion.prestamo} accion={modalAccion.accion}
          onConfirm={handleAccion} onClose={() => setModalAccion(null)} loading={actionLoading} />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Préstamos</h1>
            <p className="text-sm text-gray-500 mt-0.5">{totalPrestamos} préstamos registrados</p>
          </div>
          <button onClick={() => navigate("/prestamos/nuevo")}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all w-full sm:w-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Solicitar Préstamo
          </button>
        </div>

        {resumen && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Cartera activa"    value={formatCurrency(resumen.saldoPendienteTotal)} sub="Saldo pendiente total" color="blue" />
            <StatCard label="Préstamos activos" value={resumen.cantidades.activos} sub={`${resumen.cantidades.atrasados} atrasados`} color="emerald" />
            <StatCard label="Cuotas vencidas"   value={resumen.cuotasVencidasHoy} sub="Sin pagar hoy" color="red" />
            {isAdmin && solicitudes.length > 0
              ? <StatCard label="Solicitudes" value={solicitudes.length} sub="Pendientes de gestión" color="sky" />
              : <StatCard label="Total prestado" value={formatCurrency(resumen.montoTotalPrestado)} sub="Histórico acumulado" color="amber" />}
          </div>
        )}

        {isAdmin && (
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            <button onClick={() => setTab("prestamos")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "prestamos" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              Todos los Préstamos
            </button>
            <button onClick={() => setTab("solicitudes")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors relative ${tab === "solicitudes" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              Solicitudes Pendientes
              {solicitudes.length > 0 && (
                <span className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${tab === "solicitudes" ? "bg-white text-blue-600" : "bg-red-500 text-white"}`}>
                  {solicitudes.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Tab solicitudes — solo admin */}
        {isAdmin && tab === "solicitudes" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700">Solicitudes pendientes de gestión</h2>
              <p className="text-xs text-gray-400 mt-0.5">Revisa, aprueba o rechaza las solicitudes de préstamo</p>
            </div>
            {loading ? <Spinner /> : solicitudes.length === 0 ? (
              <div className="text-center py-16 text-gray-400"><div className="text-4xl mb-2">🎉</div><p className="font-medium">No hay solicitudes pendientes</p></div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                        <th className="px-4 py-3 text-left font-semibold">Monto</th>
                        <th className="px-4 py-3 text-left font-semibold">Condiciones</th>
                        <th className="px-4 py-3 text-left font-semibold">Estado</th>
                        <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {solicitudes.map(p => (
                        <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-4 py-3"><p className="font-semibold text-gray-900">{p.cliente?.nombre} {p.cliente?.apellido}</p><p className="text-xs text-gray-400 font-mono">{formatCedula(p.cliente?.cedula||"")}</p></td>
                          <td className="px-4 py-3"><p className="font-bold text-gray-800">{formatCurrency(p.monto)}</p></td>
                          <td className="px-4 py-3 text-xs text-gray-600"><p>{p.numeroCuotas} cuotas · {p.tasaInteres}% mensual</p><p className="text-gray-400">{FRECUENCIA_LABEL[p.frecuenciaPago]}</p></td>
                          <td className="px-4 py-3"><FlujoBadge estado={p.estado} /></td>
                          <td className="px-4 py-3 text-xs text-gray-400">{formatDate(p.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              {p.estado === "SOLICITADO" && (<>
                                <button onClick={() => setModalAccion({prestamo:p,accion:"EN_REVISION"})} className="px-2.5 py-1.5 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200">🔍 Revisar</button>
                                <button onClick={() => setModalAccion({prestamo:p,accion:"RECHAZADO"})}   className="px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">❌ Rechazar</button>
                              </>)}
                              {p.estado === "EN_REVISION" && (<>
                                <button onClick={() => setModalAccion({prestamo:p,accion:"APROBADO"})}   className="px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">✅ Aprobar</button>
                                <button onClick={() => setModalAccion({prestamo:p,accion:"RECHAZADO"})}  className="px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">❌ Rechazar</button>
                              </>)}
                              {p.estado === "APROBADO" && (<>
                                <button onClick={() => setModalAccion({prestamo:p,accion:"DESEMBOLSADO"})} className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">💰 Desembolsar</button>
                                <button onClick={() => setModalAccion({prestamo:p,accion:"RECHAZADO"})}    className="px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">❌ Rechazar</button>
                              </>)}
                              <button onClick={() => navigate(`/prestamos/${p.id}`)} className="px-2.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200">Ver</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden divide-y divide-gray-50 p-3 space-y-3">
                  {solicitudes.map(p => (
                    <TarjetaPrestamo key={p.id} p={p} isAdmin={isAdmin} userId={userId}
                      onPagar={() => navigate(`/pagos?prestamoId=${p.id}`)}
                      onAmortizacion={() => setAmortizacionId(p.id)}
                      onDetalle={() => navigate(`/prestamos/${p.id}`)}
                      onAccion={(prestamo, accion) => setModalAccion({prestamo, accion})} diasGracia={diasGracia} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab préstamos */}
        {(!isAdmin || tab === "prestamos") && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por cliente o cédula…"
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition"/>
                  {search !== searchDebounced && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-hide">
                {estadosFiltro.map(e => {
                  const cfg    = FLUJO_CONFIG[e] ?? (e === "TODOS" ? null : ESTADO_CONFIG[e]);
                  const active = filtroEstado === e;
                  return (
                    <button key={e} onClick={() => setFiltroEstado(e)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
                        active ? cfg ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "bg-gray-800 text-white border-gray-800"
                               : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}>
                      {e === "TODOS" ? "Todos" : cfg?.label ?? e}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading || loadingPrestamos ? <Spinner /> : prestamos.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="font-medium">{search ? `Sin resultados para "${search}"` : "No hay préstamos que mostrar"}</p>
                {search && <button onClick={() => setSearch("")} className="mt-2 text-xs text-blue-500 hover:underline">Limpiar búsqueda</button>}
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                        <th className="px-4 py-3 text-left font-semibold">Monto</th>
                        <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Frecuencia</th>
                        <th className="px-4 py-3 text-left font-semibold">Saldo</th>
                        <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Próx. cuota</th>
                        <th className="px-4 py-3 text-left font-semibold">Estado</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {prestamos.map(p => {
                        const cuota   = p.cuotas?.[0] ?? null;
                        const vencida = cuota && (() => { const lim = new Date(cuota.fechaVencimiento); lim.setDate(lim.getDate() + diasGracia); return lim < new Date(); })();
                        const esFlujo = ESTADOS_FLUJO.includes(p.estado);
                        return (
                          <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{p.cliente?.nombre} {p.cliente?.apellido}</p>
                              <p className="text-xs text-gray-400 font-mono">{formatCedula(p.cliente?.cedula||"")}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-800">{formatCurrency(p.monto)}</p>
                              <p className="text-xs text-gray-400">{p.numeroCuotas} cuotas · {p.tasaInteres}%</p>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">{FRECUENCIA_LABEL[p.frecuenciaPago] ?? p.frecuenciaPago}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {esFlujo ? <span className="text-gray-400 text-xs italic">Pendiente desembolso</span> : <span className="font-semibold text-gray-800">{formatCurrency(p.saldoPendiente)}</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {cuota ? (
                                <>
                                  <p className={`font-semibold ${vencida?"text-red-600":"text-gray-800"}`}>{formatCurrency(cuota.monto+(cuota.mora||0))}</p>
                                  <p className={`text-xs ${vencida?"text-red-400":"text-gray-400"}`}>Cuota #{cuota.numero}</p>
                                </>
                              ) : <span className="text-gray-400 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3"><FlujoBadge estado={p.estado} /></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1.5 flex-wrap">
                                {isAdmin && p.estado === "SOLICITADO"  && <button onClick={() => setModalAccion({prestamo:p,accion:"EN_REVISION"})} className="px-2 py-1 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200">🔍</button>}
                                {isAdmin && p.estado === "EN_REVISION"  && <button onClick={() => setModalAccion({prestamo:p,accion:"APROBADO"})}    className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">✅</button>}
                                {/* 💰 Desembolsar: visible para admin O para el usuario que solicitó el préstamo */}
                                {puedeDesembolsar(p) && (
                                  <button onClick={() => setModalAccion({prestamo:p,accion:"DESEMBOLSADO"})} className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">💰</button>
                                )}
                                {puedesPagar(p.estado) && (
                                  <button onClick={() => navigate(`/pagos?prestamoId=${p.id}`)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Pagar</button>
                                )}
                                <button onClick={() => setAmortizacionId(p.id)} className="px-2.5 py-1.5 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold border border-violet-200">
                                  <span className="hidden lg:inline">Amortización</span><span className="lg:hidden">Amort.</span>
                                </button>
                                <button onClick={() => navigate(`/prestamos/${p.id}`)} className="px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
                                  <span className="hidden lg:inline">Ver detalle</span><span className="lg:hidden">Ver</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="sm:hidden divide-y divide-gray-50">
                  {prestamos.map(p => (
                    <div key={p.id} className="p-3">
                      <TarjetaPrestamo p={p} isAdmin={isAdmin} userId={userId}
                        onPagar={() => navigate(`/pagos?prestamoId=${p.id}`)}
                        onAmortizacion={() => setAmortizacionId(p.id)}
                        onDetalle={() => navigate(`/prestamos/${p.id}`)}
                        onAccion={(prestamo, accion) => setModalAccion({prestamo, accion})} diasGracia={diasGracia} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {!loading && !loadingPrestamos && totalPrestamos > 0 && (
              <Paginacion pagina={pagina} totalPaginas={totalPaginas} total={totalPrestamos}
                porPagina={POR_PAGINA} onChange={handlePageChange} loading={loadingPrestamos} />
            )}
          </div>
        )}
      </div>
    </>
  );
}