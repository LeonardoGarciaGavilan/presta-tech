// DetallePrestamo.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, formatCedula, EstadoBadge } from "../utils/prestamosUtils";
import ReciboPago from "./recibopago";
import RefinanciarModal from "../components/RefinanciarModal";

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex justify-center items-center py-20">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

// ─── Info item ────────────────────────────────────────────────────────────────
const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
    <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{value || "—"}</p>
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 sm:min-w-72 sm:w-auto z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${
      type === "success"
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {type === "success"
        ? <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      }
      {message}
    </div>
  );
};

// ─── Modal confirmar desembolso ───────────────────────────────────────────────
const ModalDesembolsar = ({ prestamo, efectivoCaja, confirmacionTexto, setConfirmacionTexto, onConfirm, onClose, loading }) => {
  const puedeConfirmar = confirmacionTexto?.toUpperCase() === "CONFIRMAR";
  const efectivoInsuficiente = efectivoCaja !== null && prestamo.monto > efectivoCaja;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">💰</div>
            <div>
              <h3 className="font-bold text-base">Desembolsar Préstamo</h3>
              <p className="text-xs opacity-80">{prestamo.cliente?.nombre} {prestamo.cliente?.apellido}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">Monto a desembolsar</span><span className="font-bold text-blue-700">{formatCurrency(prestamo.monto)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Efectivo en caja</span><span className={`font-semibold ${efectivoInsuficiente ? 'text-red-600' : 'text-emerald-600'}`}>{efectivoCaja !== null ? formatCurrency(efectivoCaja) : 'Cargando...'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cuotas</span><span className="font-semibold">{prestamo.numeroCuotas} · {prestamo.tasaInteres}% mensual</span></div>
          </div>
          
          {efectivoInsuficiente && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              ⚠️ <strong>No hay suficiente efectivo en caja</strong>. El monto del préstamo excede el efectivo disponible.
            </div>
          )}
          
          {!efectivoInsuficiente && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
              ⚠️ El monto saldrá de <strong>tu caja</strong>. Asegúrate de tener tu caja abierta antes de continuar.
            </div>
          )}
          
          <p className="text-sm text-gray-600">Se generarán las cuotas y el préstamo quedará <strong>ACTIVO</strong>.</p>
          
          {/* Confirmación */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Escriba <strong>"CONFIRMAR"</strong> para confirmar</label>
            <input 
              type="text" 
              value={confirmacionTexto || ""} 
              onChange={e => setConfirmacionTexto(e.target.value)}
              placeholder="CONFIRMAR"
              className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent placeholder:text-gray-400"
              autoComplete="off"
            />
          </div>
          
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={loading || !puedeConfirmar || efectivoInsuficiente}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "💰"}
              {loading ? "Desembolsando…" : "Confirmar desembolso"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Badge estado cuota ───────────────────────────────────────────────────────
const CuotaBadge = ({ pagada, vencida }) => {
  if (pagada)  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />Pagada</span>;
  if (vencida) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />Vencida</span>;
  return        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />Pendiente</span>;
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DetallePrestamo() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const isAdmin      = user?.rol === "ADMIN";
  const userId       = user?.id ?? user?.sub ?? user?.userId;

  const [prestamo,           setPrestamo]           = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [toast,              setToast]              = useState(null);
  const [cancelando,         setCancelando]         = useState(false);
  const [desembolsando,      setDesembolsando]      = useState(false);
  const [modalDesembolso,    setModalDesembolso]    = useState(false);
  const [efectivoCaja,      setEfectivoCaja]      = useState(null);
  const [confirmacionDesembolso, setConfirmacionDesembolso] = useState("");
  const [tab,                setTab]                = useState("cuotas");
  const [filtroCuotas,       setFiltroCuotas]       = useState("todas");
  const [pagoParaReimprimir, setPagoParaReimprimir] = useState(null);
  const [refinanciarOpen,    setRefinanciarOpen]    = useState(false);

  const showToast = (message, type = "success") => setToast({ message, type });

  const fetchPrestamo = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/prestamos/${id}`);
      setPrestamo(res.data);
    } catch {
      showToast("Error al cargar el préstamo", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrestamo(); }, [id]);

  const handleCancelar = async () => {
    if (!window.confirm("¿Estás seguro de cancelar este préstamo? Esta acción no se puede deshacer.")) return;
    setCancelando(true);
    try {
      await api.patch(`/prestamos/${id}/cancelar`);
      showToast("Préstamo cancelado");
      fetchPrestamo();
    } catch {
      showToast("Error al cancelar el préstamo", "error");
    } finally {
      setCancelando(false);
    }
  };

  const handleDesembolsar = async () => {
    if (desembolsando) return;
    setDesembolsando(true);
    try {
      await api.patch(`/prestamos/${id}/desembolsar`);
      showToast("¡Préstamo desembolsado! Las cuotas han sido generadas 🎉");
      setModalDesembolso(false);
      fetchPrestamo();
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al desembolsar el préstamo", "error");
      setModalDesembolso(false);
    } finally {
      setDesembolsando(false);
    }
  };

  const handleActualizarMoras = async () => {
    try {
      await api.post("/prestamos/moras/actualizar");
      showToast("Moras actualizadas correctamente");
      fetchPrestamo();
    } catch {
      showToast("Error al actualizar moras", "error");
    }
  };

  if (loading) return <Spinner />;
  if (!prestamo) return (
    <div className="text-center py-20 text-gray-400">
      <p className="font-medium">Préstamo no encontrado</p>
      <button onClick={() => navigate("/prestamos")} className="mt-4 text-blue-600 text-sm hover:underline">
        Volver a la lista
      </button>
    </div>
  );

  const { cliente, cuotas = [], pagos = [] } = prestamo;

  const cuotasPendientes = cuotas.filter((c) => !c.pagada);
  const cuotasPagadas    = cuotas.filter((c) =>  c.pagada);
  const cuotasVencidas   = cuotasPendientes.filter((c) => new Date(c.fechaVencimiento) < new Date());
  const proximaCuota     = [...cuotasPendientes].sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))[0];
  const progresoPorc     = cuotas.length > 0 ? Math.round((cuotasPagadas.length / cuotas.length) * 100) : 0;
  const puedeCancelar    = !["PAGADO", "CANCELADO"].includes(prestamo.estado);
  const puedeRefinanciar = ["ACTIVO", "ATRASADO"].includes(prestamo.estado);
  // Puede desembolsar: admin O el usuario que solicitó el préstamo
  const puedeDesembolsar = prestamo.estado === "APROBADO" && (isAdmin || prestamo.solicitadoPor === userId);

  const FILTROS_CUOTAS = [
    { id:"todas",      label:"Todas",      count: cuotas.length          },
    { id:"pendientes", label:"Pendientes", count: cuotasPendientes.length },
    { id:"vencidas",   label:"Vencidas",   count: cuotasVencidas.length,  color:"text-red-600"     },
    { id:"pagadas",    label:"Pagadas",    count: cuotasPagadas.length,   color:"text-emerald-600" },
  ];

  const cuotasFiltradas = (() => {
    if (filtroCuotas === "pendientes") return cuotasPendientes;
    if (filtroCuotas === "vencidas")   return cuotasVencidas;
    if (filtroCuotas === "pagadas")    return cuotasPagadas;
    return cuotas;
  })();

  const reimprimir = async (pagoId) => {
    try {
      const r = await api.get(`/pagos/${pagoId}`);
      setPagoParaReimprimir(r.data);
    } catch {
      showToast("Error al cargar el recibo", "error");
    }
  };

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {modalDesembolso && prestamo && (
        <ModalDesembolsar
          prestamo={prestamo}
          efectivoCaja={efectivoCaja}
          confirmacionTexto={confirmacionDesembolso}
          setConfirmacionTexto={setConfirmacionDesembolso}
          onConfirm={handleDesembolsar}
          onClose={() => { setModalDesembolso(false); setConfirmacionDesembolso(""); }}
          loading={desembolsando}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3">

          {/* Título + back */}
          <div className="flex items-start gap-3">
            <button onClick={() => navigate("/prestamos")}
              className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5 shrink-0 p-0.5 -ml-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Detalle del Préstamo</h1>
                <EstadoBadge estado={prestamo.estado} />
                {prestamo.refinanciado && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                    Refinanciado ×{prestamo.vecesRefinanciado}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">ID: {prestamo.id}</p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-hide sm:flex-wrap">

            {/* 💰 Desembolsar — visible para admin O usuario que creó el préstamo */}
            {puedeDesembolsar && (
              <button onClick={async () => { 
                setConfirmacionDesembolso("");
                setModalDesembolso(true);
                try {
                  const res = await api.get('/caja/activa');
                  setEfectivoCaja(res.data?.resumen?.efectivoEnCaja ?? 0);
                } catch { setEfectivoCaja(0); }
              }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors whitespace-nowrap shrink-0">
                💰 Desembolsar préstamo
              </button>
            )}

            <button onClick={handleActualizarMoras}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar moras
            </button>

            {puedeRefinanciar && (
              <button onClick={() => setRefinanciarOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refinanciar
              </button>
            )}

            {puedeCancelar && (
              <button onClick={handleCancelar} disabled={cancelando}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                {cancelando ? "Cancelando…" : "Cancelar préstamo"}
              </button>
            )}
          </div>
        </div>

        {/* ── Cards de info ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

          {/* Cliente */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cliente</h2>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-y-2.5 gap-x-4">
              <div className="col-span-2 sm:col-span-1">
                <InfoItem label="Nombre" value={`${cliente?.nombre} ${cliente?.apellido || ""}`} />
              </div>
              <InfoItem label="Cédula"   value={formatCedula(cliente?.cedula || "")} />
              <InfoItem label="Teléfono" value={cliente?.telefono} />
              <InfoItem label="Celular"  value={cliente?.celular} />
            </div>
            <button onClick={() => navigate(`/clientes/${cliente.id}`)} className="mt-3 text-xs text-blue-600 hover:underline">
              Ver perfil completo →
            </button>
          </div>

          {/* Garante */}
          {prestamo.garante && (
            <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4">
              <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">Garante</h2>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-y-2.5 gap-x-4">
                <div className="col-span-2 sm:col-span-1">
                  <InfoItem label="Nombre" value={`${prestamo.garante.nombre} ${prestamo.garante.apellido || ""}`} />
                </div>
                <InfoItem label="Cédula"   value={formatCedula(prestamo.garante.cedula || "")} />
                <InfoItem label="Teléfono" value={prestamo.garante.telefono} />
                <InfoItem label="Celular"  value={prestamo.garante.celular} />
              </div>
              <button onClick={() => navigate(`/clientes/${prestamo.garante.id}`)} className="mt-3 text-xs text-blue-600 hover:underline">
                Ver perfil completo →
              </button>
            </div>
          )}

          {/* Condiciones */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Condiciones</h2>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-y-2.5 gap-x-4">
              <InfoItem label="Monto original"   value={formatCurrency(prestamo.monto)} />
              <InfoItem label="Monto total"       value={formatCurrency(prestamo.montoTotal)} />
              <InfoItem label="Tasa mensual"      value={`${prestamo.tasaInteres}%`} />
              <InfoItem label="Plazo"             value={`${prestamo.numeroCuotas} cuotas`} />
              <InfoItem label="Fecha inicio"      value={formatDate(prestamo.fechaInicio)} />
              <InfoItem label="Fecha vencimiento" value={formatDate(prestamo.fechaVencimiento)} />
            </div>
          </div>

          {/* Estado actual */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:col-span-2 lg:col-span-1">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Estado actual</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-y-2.5 gap-x-4">
              <InfoItem label="Saldo pendiente" value={formatCurrency(prestamo.saldoPendiente)} />
              <InfoItem label="Mora acumulada"  value={formatCurrency(prestamo.moraAcumulada)} />
              <InfoItem
                label="Próxima cuota"
                value={proximaCuota
                  ? `${formatCurrency(proximaCuota.monto + (proximaCuota.mora || 0))} — ${formatDate(proximaCuota.fechaVencimiento)}`
                  : "—"}
              />
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{cuotasPagadas.length} cuotas pagadas</span>
                <span className="font-semibold text-blue-600">{progresoPorc}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width:`${progresoPorc}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{cuotasPendientes.length} pendientes{cuotasVencidas.length > 0 && <span className="text-red-500 ml-1">({cuotasVencidas.length} vencidas)</span>}</span>
                <span>{cuotas.length} total</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
            {[
              { key:"cuotas", label:`Cuotas (${cuotas.length})` },
              { key:"pagos",  label:`Pagos (${pagos.length})`   },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 sm:px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap shrink-0 ${
                  tab === key
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab Cuotas ── */}
          {tab === "cuotas" && (
            <>
              <div className="sm:hidden flex gap-1.5 px-4 py-2.5 border-b border-gray-50 overflow-x-auto scrollbar-hide">
                {FILTROS_CUOTAS.map((f) => (
                  <button key={f.id} onClick={() => setFiltroCuotas(f.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                      filtroCuotas === f.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}>
                    {f.label}
                    {f.count > 0 && (
                      <span className={`font-bold ${filtroCuotas === f.id ? "text-white/70" : (f.color || "text-gray-400")}`}>
                        {f.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tabla sm+ */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-semibold">#</th>
                      <th className="px-4 py-3 text-right font-semibold">Capital</th>
                      <th className="px-4 py-3 text-right font-semibold">Interés</th>
                      <th className="px-4 py-3 text-right font-semibold">Mora</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cuotas.map((c) => {
                      const vencida = !c.pagada && new Date(c.fechaVencimiento) < new Date();
                      return (
                        <tr key={c.id} className={`transition-colors ${c.pagada ? "bg-gray-50/60" : vencida ? "bg-red-50/40" : "hover:bg-blue-50/30"}`}>
                          <td className="px-4 py-2.5 font-semibold text-gray-600">#{c.numero}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(c.capital)}</td>
                          <td className="px-4 py-2.5 text-right text-amber-600">{formatCurrency(c.interes)}</td>
                          <td className="px-4 py-2.5 text-right text-red-500">{c.mora > 0 ? formatCurrency(c.mora) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(c.monto + (c.mora || 0))}</td>
                          <td className="px-4 py-2.5">
                            <span className={vencida ? "text-red-600 font-semibold" : "text-gray-600"}>{formatDate(c.fechaVencimiento)}</span>
                          </td>
                          <td className="px-4 py-2.5"><CuotaBadge pagada={c.pagada} vencida={vencida} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards móvil */}
              <div className="sm:hidden divide-y divide-gray-50">
                {cuotasFiltradas.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">Sin cuotas en esta categoría</p>
                ) : (
                  cuotasFiltradas.map((c) => {
                    const vencida = !c.pagada && new Date(c.fechaVencimiento) < new Date();
                    return (
                      <div key={c.id} className={`px-4 py-3 ${c.pagada ? "bg-gray-50/60" : vencida ? "bg-red-50/30" : ""}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                              {c.numero}
                            </span>
                            <span className={`text-xs font-semibold ${vencida ? "text-red-600" : c.pagada ? "text-gray-400" : "text-gray-700"}`}>
                              {formatDate(c.fechaVencimiento)}
                            </span>
                          </div>
                          <CuotaBadge pagada={c.pagada} vencida={vencida} />
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] mt-1">
                          <div className="bg-blue-50 rounded p-1.5 text-center">
                            <p className="text-blue-400">Capital</p>
                            <p className="font-bold text-blue-700 mt-0.5">{formatCurrency(c.capital)}</p>
                          </div>
                          <div className="bg-amber-50 rounded p-1.5 text-center">
                            <p className="text-amber-400">Interés</p>
                            <p className="font-bold text-amber-700 mt-0.5">{formatCurrency(c.interes)}</p>
                          </div>
                          {c.mora > 0 ? (
                            <div className="bg-red-50 rounded p-1.5 text-center">
                              <p className="text-red-400">Mora</p>
                              <p className="font-bold text-red-600 mt-0.5">{formatCurrency(c.mora)}</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded p-1.5 text-center">
                              <p className="text-gray-400">Total</p>
                              <p className="font-bold text-gray-700 mt-0.5">{formatCurrency(c.monto)}</p>
                            </div>
                          )}
                        </div>
                        {c.mora > 0 && (
                          <div className="mt-1 text-right text-xs">
                            <span className="text-gray-400">Total: </span>
                            <span className="font-bold text-gray-800">{formatCurrency(c.monto + c.mora)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── Tab Pagos ── */}
          {tab === "pagos" && (
            <>
              {pagos.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <p className="font-medium">Aún no hay pagos registrados</p>
                </div>
              ) : (
                <>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                          <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                          <th className="px-4 py-3 text-right font-semibold">Capital</th>
                          <th className="px-4 py-3 text-right font-semibold">Interés</th>
                          <th className="px-4 py-3 text-right font-semibold">Mora</th>
                          <th className="px-4 py-3 text-right font-semibold">Total</th>
                          <th className="px-4 py-3 text-left font-semibold">Método</th>
                          <th className="px-4 py-3 text-left font-semibold">Registrado por</th>
                          <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pagos.map((p) => (
                          <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-2.5 text-gray-600">{formatDate(p.createdAt)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(p.capital)}</td>
                            <td className="px-4 py-2.5 text-right text-amber-600">{formatCurrency(p.interes)}</td>
                            <td className="px-4 py-2.5 text-right text-red-500">{p.mora > 0 ? formatCurrency(p.mora) : <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(p.montoTotal)}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">{p.metodo}</span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{p.usuario?.nombre || "—"}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button onClick={() => reimprimir(p.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-xs font-medium border border-gray-200 hover:border-blue-200 transition-colors">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Reimprimir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="sm:hidden divide-y divide-gray-50">
                    {pagos.map((p) => (
                      <div key={p.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{formatDate(p.createdAt)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{p.usuario?.nombre || "—"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">{p.metodo}</span>
                            <button onClick={() => reimprimir(p.id)}
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-200 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          <div className="bg-blue-50 rounded p-1.5 text-center">
                            <p className="text-blue-400">Capital</p>
                            <p className="font-bold text-blue-700 mt-0.5">{formatCurrency(p.capital)}</p>
                          </div>
                          <div className="bg-amber-50 rounded p-1.5 text-center">
                            <p className="text-amber-400">Interés</p>
                            <p className="font-bold text-amber-700 mt-0.5">{formatCurrency(p.interes)}</p>
                          </div>
                          {p.mora > 0 ? (
                            <div className="bg-red-50 rounded p-1.5 text-center">
                              <p className="text-red-400">Mora</p>
                              <p className="font-bold text-red-600 mt-0.5">{formatCurrency(p.mora)}</p>
                            </div>
                          ) : (
                            <div className="bg-emerald-50 rounded p-1.5 text-center">
                              <p className="text-emerald-400">Total</p>
                              <p className="font-bold text-emerald-700 mt-0.5">{formatCurrency(p.montoTotal)}</p>
                            </div>
                          )}
                        </div>
                        {p.mora > 0 && (
                          <div className="mt-1.5 flex justify-end">
                            <span className="text-xs text-gray-400">Total: </span>
                            <span className="text-xs font-bold text-gray-800 ml-1">{formatCurrency(p.montoTotal)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {pagoParaReimprimir && (
        <ReciboPago pago={pagoParaReimprimir} empresa={null} onClose={() => setPagoParaReimprimir(null)} />
      )}

      {refinanciarOpen && (
        <RefinanciarModal
          prestamo={prestamo}
          onClose={() => setRefinanciarOpen(false)}
          onSuccess={() => {
            setRefinanciarOpen(false);
            fetchPrestamo();
            showToast("Préstamo refinanciado exitosamente");
          }}
        />
      )}
    </>
  );
}