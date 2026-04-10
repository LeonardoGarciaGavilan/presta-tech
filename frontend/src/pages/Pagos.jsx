//Pagos.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { formatCurrency, formatDate, formatCedula, EstadoBadge, FRECUENCIA_LABEL } from "../utils/prestamosUtils";
import ReciboPago from "./recibopago";

const inputBase = "w-full border border-gray-200 bg-gray-50 px-3 py-2.5 rounded-lg text-base sm:text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent placeholder:text-gray-400";
const inputErr = "border-red-400 bg-red-50 focus:ring-red-400";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";
const errorMsg = "text-red-500 text-xs mt-1";

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const styles = {
    success: "bg-emerald-50 border-emerald-300 text-emerald-800",
    error: "bg-red-50 border-red-300 text-red-800",
  };
  return (
    <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium ${styles[type]}`}
      style={{ animation: "slideIn 0.25s ease" }}>
      {type === "success"
        ? <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
      {message}
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};

// ── Modal de confirmación para saldar ─────────────────────────────────────────
const ModalSaldar = ({ prestamo, metodo, setMetodo, referencia, setReferencia, confirmacionTexto, setConfirmacionTexto, onConfirm, onCancel, loading }) => {
  const cuotasPend = prestamo.cuotas?.filter(c => !c.pagada) ?? [];
  const totalCapital = cuotasPend.reduce((s, c) => s + c.capital, 0);
  const totalInteres = cuotasPend.reduce((s, c) => s + c.interes, 0);
  const totalMora = cuotasPend.reduce((s, c) => s + (c.mora || 0), 0);
  const montoTotal = Math.round((totalCapital + totalInteres + totalMora) * 100) / 100;

  const puedeConfirmar = confirmacionTexto?.toUpperCase() === "CONFIRMAR";

  const METODOS = [
    { value: "EFECTIVO", label: "Efectivo", icon: "💵" },
    { value: "TRANSFERENCIA", label: "Transferencia", icon: "🏦" },
    { value: "TARJETA", label: "Tarjeta", icon: "💳" },
    { value: "CHEQUE", label: "Cheque", icon: "📄" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ animation: "fadeUp 0.2s ease" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">🏦</div>
            <div>
              <h3 className="font-bold text-base">Saldar Préstamo</h3>
              <p className="text-xs text-amber-100">Esta acción liquidará el préstamo completo</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen de lo que se pagará */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Resumen del saldo a pagar</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Capital pendiente</span>
              <span className="font-semibold">{formatCurrency(totalCapital)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Intereses pendientes</span>
              <span className="font-semibold text-amber-700">{formatCurrency(totalInteres)}</span>
            </div>
            {totalMora > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Mora acumulada</span>
                <span className="font-semibold text-red-600">{formatCurrency(totalMora)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
              <span className="font-bold text-gray-800">Total a pagar</span>
              <span className="font-bold text-lg text-emerald-700">{formatCurrency(montoTotal)}</span>
            </div>
            <p className="text-xs text-gray-400">{cuotasPend.length} cuota{cuotasPend.length !== 1 ? "s" : ""} pendiente{cuotasPend.length !== 1 ? "s" : ""} · {prestamo.cliente?.nombre} {prestamo.cliente?.apellido}</p>
          </div>

          {/* Método de pago */}
          <div>
            <label className={labelCls}>Método de pago</label>
            <div className="grid grid-cols-4 gap-2">
              {METODOS.map(m => (
                <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${metodo === m.value ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    }`}>
                  <span>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label className={labelCls}>Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Nº transferencia, cheque…" className={inputBase} />
          </div>

          {/* Advertencia */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <p className="text-xs text-amber-700 font-medium">
              ⚠️ Al confirmar, se registrará un pago único de <strong>{formatCurrency(montoTotal)}</strong> y el préstamo quedará marcado como <strong>PAGADO</strong>.
            </p>
          </div>

          {/* Confirmación */}
          <div>
            <label className={labelCls}>Escriba <strong>"CONFIRMAR"</strong> para confirmar</label>
            <input 
              type="text" 
              value={confirmacionTexto || ""} 
              onChange={e => setConfirmacionTexto(e.target.value)}
              placeholder="CONFIRMAR"
              className={inputBase}
              autoComplete="off"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={loading || !puedeConfirmar}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "✅"
              }
              {loading ? "Procesando…" : `Saldar ${formatCurrency(montoTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, color = "blue" }) => {
  const colors = {
    blue: "from-blue-600 to-blue-700",
    emerald: "from-emerald-600 to-emerald-700",
    amber: "from-amber-500 to-amber-600",
    violet: "from-violet-500 to-violet-600",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 text-white shadow-lg`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-75">{label}</p>
      <p className="text-xl md:text-2xl font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
};

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo", icon: "💵" },
  { value: "TRANSFERENCIA", label: "Transferencia", icon: "🏦" },
  { value: "TARJETA", label: "Tarjeta", icon: "💳" },
  { value: "CHEQUE", label: "Cheque", icon: "📄" },
];

if (typeof document !== "undefined" && !document.getElementById("pagos-styles")) {
  const s = document.createElement("style");
  s.id = "pagos-styles";
  s.textContent = `
    @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(s);
}

export default function Pagos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef(null);

  const [resumen, setResumen] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState(null);
  const [cuotasPendientes, setCuotasPendientes] = useState([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [cuotaId, setCuotaId] = useState("PROXIMA");
  const [montoPagado, setMontoPagado] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [observacion, setObservacion] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [pagoRealizado, setPagoRealizado] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [pagosRecientes, setPagosRecientes] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(true);
  const [tabMobile, setTabMobile] = useState("form");

  // ── Estado para modal Recibo ──
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [reciboData, setReciboData] = useState(null);

  // ── Estado para modal Saldar ──
  const [showModalSaldar, setShowModalSaldar] = useState(false);
  const [metodoSaldar, setMetodoSaldar] = useState("EFECTIVO");
  const [referenciaSaldar, setReferenciaSaldar] = useState("");
  const [saldando, setSaldando] = useState(false);
  const [confirmacionSaldar, setConfirmacionSaldar] = useState("");

  // ── Estado de caja ──
  const [cajaAbierta, setCajaAbierta] = useState(null); // null=cargando, false=sin caja, obj=abierta
  const [loadingCaja, setLoadingCaja] = useState(true);
  const [diasGracia, setDiasGracia] = useState(0);
  
  // Configuración de límites
  const [config, setConfig] = useState({
    montoMaximoPago: null,
  });

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const hoyStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const fetchCaja = async () => {
    setLoadingCaja(true);
    try {
      const r = await api.get(`/caja/activa?fecha=${hoyStr()}`);
      setCajaAbierta(r.data?.estado === "ABIERTA" ? r.data : false);
    } catch {
      setCajaAbierta(false);
    } finally {
      setLoadingCaja(false);
    }
  };

  useEffect(() => {
    fetchResumen(); fetchPagosRecientes(); fetchEmpresa(); fetchCaja();
    api.get("/configuracion")
      .then(r => {
        setDiasGracia(r.data?.diasGracia ?? 0);
        setConfig({ montoMaximoPago: r.data?.montoMaximoPago ?? null });
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const prestamoId = searchParams.get("prestamoId");
    if (!prestamoId) return;
    setSearchParams({}, { replace: true });
    api.get(`/prestamos/${prestamoId}`)
      .then(r => seleccionarPrestamo(r.data))
      .catch(() => showToast("No se pudo cargar el préstamo", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lee del localStorage igual que Reportes.jsx — key "user", campo "empresa"
  const fetchEmpresa = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const nombre =
        userData?.empresa ??
        userData?.usuario?.empresa ??
        userData?.nombreEmpresa ??
        "Sistema de Préstamos";
      setEmpresa({ nombre: String(nombre) });
    } catch {
      setEmpresa({ nombre: "Sistema de Préstamos" });
    }
  };

  const fetchResumen = async () => { try { const r = await api.get("/pagos/resumen"); setResumen(r.data); } catch { } };
  const fetchPagosRecientes = async () => {
    setLoadingPagos(true);
    try { const r = await api.get("/pagos"); setPagosRecientes(r.data.slice(0, 20)); }
    catch { } finally { setLoadingPagos(false); }
  };

  // Búsqueda con debounce
  useEffect(() => {
    if (searchText.length < 2) { setSugerencias([]); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await api.get(`/prestamos?search=${encodeURIComponent(searchText)}&limit=20`);
        const lista = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
        const f = lista.filter(p => !["PAGADO", "CANCELADO"].includes(p.estado));
        setSugerencias(f.slice(0, 6)); setShowSugerencias(true);
      } catch { setSugerencias([]); }
      finally { setBuscando(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [searchText]);

  let currentRequestId = 0;

const seleccionarPrestamo = async (prestamo) => {
  const requestId = ++currentRequestId;

  setSearchText(`${prestamo.cliente?.nombre} ${prestamo.cliente?.apellido ?? ""}`);
  setSugerencias([]);
  setShowSugerencias(false);
  setCuotaId("PROXIMA");
  setMontoPagado("");
  setErrors({});
  setLoadingCuotas(true);

  try {
    const res = await api.get(`/prestamos/${prestamo.id}`);

    // 🔒 Evitar race condition
    if (requestId !== currentRequestId) return;

    const prestamoCompleto = res.data;

    setPrestamoSeleccionado(prestamoCompleto);

    const cuotas = prestamoCompleto.cuotas?.filter(c => !c.pagada) ?? [];
    setCuotasPendientes(cuotas);

    if (cuotas.length > 0) {
      const monto = Number(cuotas[0].monto || 0);
      const mora = Number(cuotas[0].mora || 0);

      setMontoPagado((monto + mora).toFixed(2));
    }

  } catch (error) {
    console.error("Error cargando préstamo:", error);

    setCuotasPendientes([]);
    setErrors({ general: "Error cargando el préstamo. Intenta nuevamente." });

  } finally {
    setLoadingCuotas(false);
  }
};

  const limpiarPrestamo = () => {
    setPrestamoSeleccionado(null); setSearchText(""); setCuotasPendientes([]);
    setCuotaId("PROXIMA"); setMontoPagado(""); setErrors({});
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const cuotaActual = useMemo(() => {
    if (cuotaId === "PROXIMA") return cuotasPendientes[0] ?? null;
    return cuotasPendientes.find(c => c.id === cuotaId) ?? null;
  }, [cuotaId, cuotasPendientes]);

  const handleCuotaChange = (id) => {
    setCuotaId(id);
    const c = id === "PROXIMA" ? cuotasPendientes[0] : cuotasPendientes.find(c => c.id === id);
    if (c) setMontoPagado((c.monto + c.mora).toFixed(2));
    if (errors.montoPagado) setErrors(p => ({ ...p, montoPagado: null }));
  };

  const montoNum = parseFloat(montoPagado) || 0;
  const montoExacto = cuotaActual ? cuotaActual.monto + (cuotaActual.mora || 0) : 0;
  const diferencia = Math.round((montoNum - montoExacto) * 100) / 100;

  const validate = () => {
    const e = {};
    if (!prestamoSeleccionado) e.prestamo = "Selecciona un préstamo.";
    if (!montoPagado || montoNum <= 0) e.montoPagado = "Ingresa un monto válido.";
    
    // Validar monto máximo si está configurado
    if (config.montoMaximoPago !== null && montoNum > config.montoMaximoPago) {
      e.montoPagado = `El monto máximo por pago es RD$${config.montoMaximoPago.toLocaleString()}`;
    }
    
    if (!metodo) e.metodo = "Selecciona el método de pago.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const res = await api.post("/pagos", {
        prestamoId: prestamoSeleccionado.id,
        cuotaId: cuotaId === "PROXIMA" ? undefined : cuotaId,
        montoPagado: montoNum, metodo,
        referencia: referencia || undefined,
        observacion: observacion || undefined,
      });
      
      // VALIDAR QUE HAYA DATA
      if (!res.data || Object.keys(res.data).length === 0) {
        showToast("Pago registrado pero no se pudo generar el recibo", "error");
        fetchResumen();
        fetchPagosRecientes();
        return;
      }
      
      // MOSTRAR RECIBO INMEDIATAMENTE
      setReciboData(res.data);
      setMostrarRecibo(true);
      setPagoRealizado(res.data);
      showToast("Pago registrado correctamente");
      
      // NO hacer fetch/reset aquí - el modal es independiente
      // El usuario puede ver el recibo y luego se limpia al cerrar
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al registrar el pago", "error");
    } finally { setSubmitting(false); }
  };

  // ── Saldar préstamo completo ───────────────────────────────────────────────
  const handleSaldar = async () => {
    if (saldando) return;
    setSaldando(true);
    try {
      const res = await api.post(`/pagos/saldar/${prestamoSeleccionado.id}`, {
        metodo: metodoSaldar,
        referencia: referenciaSaldar || undefined,
        observacion: "Saldo total del préstamo",
      });
      setShowModalSaldar(false);
      
      // MOSTRAR RECIBO INMEDIATAMENTE
      setReciboData(res.data);
      setMostrarRecibo(true);
      setPagoRealizado(res.data);
      
      showToast("¡Préstamo saldado completamente! 🎉");
      fetchResumen(); fetchPagosRecientes();
      
      // Limpiar después de delay
      setTimeout(() => {
        limpiarPrestamo();
      }, 1500);
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al saldar el préstamo", "error");
    } finally { setSaldando(false); }
  };

  // Cerrar sugerencias al click afuera
  useEffect(() => {
    const handler = (e) => {
      if (!searchRef.current?.closest(".autocomplete-wrap")?.contains(e.target))
        setShowSugerencias(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Modal saldar */}
      {showModalSaldar && prestamoSeleccionado && (
        <ModalSaldar
          prestamo={{ ...prestamoSeleccionado, cuotas: cuotasPendientes.map(c => ({ ...c, pagada: false })) }}
          metodo={metodoSaldar}
          setMetodo={setMetodoSaldar}
          referencia={referenciaSaldar}
          setReferencia={setReferenciaSaldar}
          confirmacionTexto={confirmacionSaldar}
          setConfirmacionTexto={setConfirmacionSaldar}
          onConfirm={handleSaldar}
          onCancel={() => { setShowModalSaldar(false); setConfirmacionSaldar(""); }}
          loading={saldando}
        />
      )}

      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
            <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">Registra y gestiona los pagos de préstamos</p>
          </div>
          <button onClick={() => navigate("/prestamos")}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span className="hidden sm:inline">Ver préstamos</span>
          </button>
        </div>

        {/* ── Banner caja cerrada ── */}
        {!loadingCaja && !cajaAbierta && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-xl">🔒</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-900 text-sm">Caja no abierta</p>
              <p className="text-xs text-amber-700 mt-0.5">Debes abrir tu caja antes de registrar pagos del día.</p>
            </div>
            <button
              onClick={() => navigate("/caja")}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Abrir caja
            </button>
          </div>
        )}

        {/* ── Banner caja abierta ── */}
        {!loadingCaja && cajaAbierta && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="text-xs font-semibold text-emerald-700">
              Caja abierta — efectivo inicial: <strong>{new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(cajaAbierta.montoInicial)}</strong>
            </p>
          </div>
        )}

        {/* ── Stats ── */}
        {resumen && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Cobrado hoy" value={formatCurrency(resumen.cobradoHoy)} sub={`${resumen.pagosHoy} pagos`} color="emerald" />
            <StatCard label="Cobrado este mes" value={formatCurrency(resumen.cobradoMes)} sub={`${resumen.pagosMes} pagos`} color="blue" />
            <StatCard label="Pagos hoy" value={resumen.pagosHoy} sub="transacciones" color="amber" />
            <StatCard label="Pagos este mes" value={resumen.pagosMes} sub="transacciones" color="violet" />
          </div>
        )}

        {/* ── Tabs móvil ── */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white lg:hidden">
          {[["form", "Registrar Pago"], ["recientes", "Pagos Recientes"]].map(([k, l]) => (
            <button key={k} onClick={() => setTabMobile(k)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tabMobile === k ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ════════════════════════════════
              PANEL IZQUIERDO — Formulario
          ════════════════════════════════ */}
          <div className={`lg:col-span-3 space-y-4 ${tabMobile === "form" ? "block" : "hidden lg:block"} ${!loadingCaja && !cajaAbierta ? "pointer-events-none opacity-50 select-none" : ""}`}>

            {/* Buscar préstamo */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Préstamo</h2>

              {prestamoSeleccionado ? (
                <div className="space-y-3">
                  {/* Préstamo seleccionado */}
                  <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-blue-900">
                          {prestamoSeleccionado.cliente?.nombre} {prestamoSeleccionado.cliente?.apellido}
                        </p>
                        <EstadoBadge estado={prestamoSeleccionado.estado} />
                      </div>
                      <p className="text-xs text-blue-600 font-mono mt-0.5">
                        {formatCedula(prestamoSeleccionado.cliente?.cedula || "")}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-blue-700">
                        <span>Monto: <strong>{formatCurrency(prestamoSeleccionado.monto)}</strong></span>
                        <span>Saldo: <strong>
                          {/* Calcular saldo real sumando cuotas pendientes cargadas, no el campo BD */}
                          {loadingCuotas
                            ? "…"
                            : formatCurrency(
                              Math.round(
                                cuotasPendientes.reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0) * 100
                              ) / 100
                            )
                          }
                        </strong></span>
                        <span>{FRECUENCIA_LABEL[prestamoSeleccionado.frecuenciaPago]}</span>
                      </div>
                    </div>
                    <button type="button" onClick={limpiarPrestamo} className="text-blue-400 hover:text-blue-700 ml-3 mt-0.5 shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Cuotas */}
                  {loadingCuotas ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" /> Cargando cuotas…
                    </div>
                  ) : cuotasPendientes.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 font-medium">
                      ✅ Este préstamo no tiene cuotas pendientes
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls}>Cuota a pagar</label>
                        {/* ── Botón Saldar préstamo ── */}
                        <button
                          type="button"
                          onClick={() => { setMetodoSaldar("EFECTIVO"); setReferenciaSaldar(""); setShowModalSaldar(true); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Saldar préstamo
                        </button>
                      </div>

                      <select value={cuotaId} onChange={e => handleCuotaChange(e.target.value)} className={inputBase}>
                        <option value="PROXIMA">
                          Próxima — #{cuotasPendientes[0]?.numero} · {formatCurrency(cuotasPendientes[0]?.monto + (cuotasPendientes[0]?.mora || 0))} · vence {formatDate(cuotasPendientes[0]?.fechaVencimiento)}
                        </option>
                        {cuotasPendientes.slice(1).map(c => {
                          const vencida = (() => { const limite = new Date(c.fechaVencimiento); limite.setDate(limite.getDate() + diasGracia); return limite < new Date(); })();
                          return (
                            <option key={c.id} value={c.id}>
                              Cuota #{c.numero} · {formatCurrency(c.monto + (c.mora || 0))}{c.mora > 0 ? ` (mora: ${formatCurrency(c.mora)})` : ""}{vencida ? " ⚠️ Vencida" : ""} · {formatDate(c.fechaVencimiento)}
                            </option>
                          );
                        })}
                      </select>

                      {cuotaActual && (
                        <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                          {[
                            { l: "Capital", v: cuotaActual.capital, bg: "bg-gray-50 border-gray-100", lc: "text-gray-400", vc: "text-gray-700" },
                            { l: "Interés", v: cuotaActual.interes, bg: "bg-amber-50 border-amber-100", lc: "text-amber-500", vc: "text-amber-700" },
                            { l: "Mora", v: cuotaActual.mora || 0, bg: "bg-red-50 border-red-100", lc: "text-red-400", vc: "text-red-600" },
                            { l: "Total", v: cuotaActual.monto + (cuotaActual.mora || 0), bg: "bg-blue-50 border-blue-100", lc: "text-blue-400", vc: "text-blue-700" },
                          ].map(x => (
                            <div key={x.l} className={`${x.bg} rounded-lg p-2 text-center border`}>
                              <p className={x.lc}>{x.l}</p>
                              <p className={`font-semibold ${x.vc}`}>{formatCurrency(x.v)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Autocomplete búsqueda ── */
                <div className="autocomplete-wrap relative">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
                      placeholder="Buscar préstamo por nombre o cédula…"
                      className={`${inputBase} pl-9 ${errors.prestamo ? inputErr : ""}`}
                    />
                    {buscando && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
                  </div>
                  {errors.prestamo && <p className={errorMsg}>{errors.prestamo}</p>}

                  {showSugerencias && sugerencias.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                      {sugerencias.map(p => (
                        <button key={p.id} type="button" onClick={() => seleccionarPrestamo(p)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{p.cliente?.nombre} {p.cliente?.apellido}</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">{formatCedula(p.cliente?.cedula || "")} · Saldo: {formatCurrency(p.saldoPendiente)}</p>
                            </div>
                            <EstadoBadge estado={p.estado} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showSugerencias && searchText.length >= 2 && sugerencias.length === 0 && !buscando && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 px-4 py-3">
                      <p className="text-sm text-gray-400">No se encontraron préstamos activos</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Formulario detalle pago */}
            {prestamoSeleccionado && cuotasPendientes.length > 0 && (
              <form onSubmit={handleSubmit}>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalle del Pago</h2>

                  {/* Monto */}
                  <div>
                    <label className={labelCls}>Monto recibido</label>
                    <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition ${errors.montoPagado ? "border-red-400" : "border-gray-200"}`}>
                      <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-base sm:text-sm font-medium border-r border-gray-200 shrink-0">RD$</span>
                      <input type="number" value={montoPagado}
                        onChange={e => { setMontoPagado(e.target.value); if (errors.montoPagado) setErrors(p => ({ ...p, montoPagado: null })); }}
                        placeholder="0.00" step="0.01" min="0"
                        className="flex-1 px-3 py-2.5 text-base sm:text-sm bg-gray-50 focus:bg-white focus:outline-none transition" />
                    </div>
                    {errors.montoPagado && <p className={errorMsg}>{errors.montoPagado}</p>}
                    {montoNum > 0 && cuotaActual && (
                      <div className={`mt-2 text-xs font-medium px-3 py-1.5 rounded-lg ${diferencia === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          diferencia > 0 ? "bg-blue-50 text-blue-700 border border-blue-200" :
                            "bg-red-50 text-red-700 border border-red-200"}`}>
                        {diferencia === 0 && "✅ Monto exacto de la cuota"}
                        {diferencia > 0 && `↑ Excedente de ${formatCurrency(diferencia)} se aplicará como abono a capital`}
                        {diferencia < 0 && `⚠️ Faltan ${formatCurrency(Math.abs(diferencia))} para cubrir la cuota completa`}
                      </div>
                    )}
                  </div>

                  {/* Método */}
                  <div>
                    <label className={labelCls}>Método de pago</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {METODOS.map(m => (
                        <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                          className={`py-2.5 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${metodo === m.value ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                            }`}>
                          <span className="text-base">{m.icon}</span>{m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Referencia + Observación */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Referencia <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
                        placeholder="Nº transferencia, cheque…" className={inputBase} />
                    </div>
                    <div>
                      <label className={labelCls}>Observación <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <textarea value={observacion} onChange={e => setObservacion(e.target.value)}
                        placeholder="Notas adicionales…" rows={1} className={`${inputBase} resize-none`} />
                    </div>
                  </div>

                  <button type="submit" disabled={submitting}
                    className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm">
                    {submitting
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    }
                    {submitting ? "Registrando…" : `Registrar Pago de ${formatCurrency(montoNum)}`}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ════════════════════════════════
              PANEL DERECHO — Pagos recientes
          ════════════════════════════════ */}
          <div className={`lg:col-span-2 ${tabMobile === "recientes" ? "block" : "hidden lg:block"}`}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">Pagos recientes</h2>
                {pagosRecientes.length > 0 && <span className="text-xs text-gray-400">{pagosRecientes.length} más recientes</span>}
              </div>

              {loadingPagos ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : pagosRecientes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                  <p className="text-sm font-medium">No hay pagos registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                  {pagosRecientes.map(p => (
                    <div key={p.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">{formatCedula(p.prestamo?.cliente?.cedula || "")}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium border border-gray-200">{p.metodo}</span>
                            <span className="text-xs text-gray-400">{formatDate(p.createdAt)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.montoTotal)}</p>
                          <button onClick={() => navigate(`/prestamos/${p.prestamo?.id}`)} className="text-xs text-blue-500 hover:underline mt-0.5 block">Ver préstamo</button>
                          <button
                            onClick={async () => {
                              try { 
                                const r = await api.get(`/pagos/${p.id}`); 
                                setReciboData(r.data);
                                setMostrarRecibo(true);
                              }
                              catch { showToast("Error al cargar el recibo", "error"); }
                            }}
                            className="text-xs text-gray-400 hover:text-blue-500 hover:underline mt-0.5 block">
                            🖨 Reimprimir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {mostrarRecibo && reciboData && (
        <ReciboPago 
          data={reciboData} 
          empresa={empresa} 
          onClose={async () => { 
            setMostrarRecibo(false); 
            setReciboData(null);
            
            // Limpiar estados del formulario DESPUÉS de cerrar el modal
            fetchResumen();
            fetchPagosRecientes();
            
            if (prestamoSeleccionado) {
              const pa = await api.get(`/prestamos/${prestamoSeleccionado.id}`);
              const pend = pa.data.cuotas?.filter(c => !c.pagada) ?? [];
              
              if (pend.length > 0 && pend[0]) { 
                setCuotasPendientes(pend); 
                setPrestamoSeleccionado(pa.data); 
                setCuotaId("PROXIMA");
                setMontoPagado(((pend[0].monto ?? 0) + (pend[0].mora ?? 0)).toFixed(2)); 
              } else {
                showToast("¡Préstamo completamente pagado! 🎉");
                setPrestamoSeleccionado(null); 
                setSearchText(""); 
                setCuotasPendientes([]);
                setCuotaId("PROXIMA"); 
                setMontoPagado(""); 
                setErrors({});
              }
            }
            setReferencia(""); 
            setObservacion("");
          }} 
        />
      )}
    </>
  );
}