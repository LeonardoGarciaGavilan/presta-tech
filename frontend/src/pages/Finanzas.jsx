import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

const formatMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
  }).format(value || 0);

const formatMoneyFull = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(value || 0);

const Skeleton = ({ className }) => (
  <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />
);

const KpiCard = ({ label, value, sub, icon, accentColor, delay = 0 }) => (
  <div
    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
    style={{ animation: `fadeUp 0.4s ease ${delay}ms both` }}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentColor}`}>
        {icon}
      </div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </p>
    </div>
    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{value}</p>
    {sub && <p className="text-xs text-gray-400">{sub}</p>}
  </div>
);

const MetricCard = ({ label, value, sub, positive }) => {
  const getColor = () => {
    if (value === null || value === undefined) return "text-gray-400";
    if (positive === true) return "text-emerald-600";
    if (positive === false) return "text-red-600";
    return "text-gray-700";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-xl font-bold ${getColor()}`}>
        {value === null ? "N/A" : typeof value === "number" && Math.abs(value) < 100 ? `${value}%` : formatMoney(value)}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
};

const AlertItem = ({ alerta }) => {
  const config = {
    CRITICAL: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: "🚨",
    },
    WARNING: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "⚠️",
    },
    INFO: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: "ℹ️",
    },
  };

  const c = config[alerta.tipo] || config.INFO;

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 flex items-start gap-3`}>
      <span className="text-xl">{c.icon}</span>
      <div>
        <p className={`text-sm font-semibold ${c.text}`}>{alerta.mensaje}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Código: {alerta.codigo}
          {alerta.umbral && ` · Umbral: ${formatMoney(alerta.umbral)}`}
        </p>
      </div>
    </div>
  );
};

const DistributionBar = ({ capital, ganancias }) => {
  const total = capital + ganancias;
  const capitalPct = total > 0 ? (capital / total) * 100 : 0;
  const gananciasPct = total > 0 ? (ganancias / total) * 100 : 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
      style={{ animation: "fadeUp 0.4s ease 200ms both" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700">Tu Dinero Total</h2>
        <p className="text-xl font-bold text-gray-900">{formatMoney(total)}</p>
      </div>

      <div className="h-4 rounded-full overflow-hidden flex gap-0.5 mb-4">
        {capitalPct > 0 && (
          <div
            className="h-full bg-blue-500 rounded-l-full"
            style={{ width: `${capitalPct}%` }}
            title={`Capital: ${capitalPct.toFixed(1)}%`}
          />
        )}
        {gananciasPct > 0 && (
          <div
            className="h-full bg-emerald-500 rounded-r-full"
            style={{ width: `${gananciasPct}%` }}
            title={`Ganancias: ${gananciasPct.toFixed(1)}%`}
          />
        )}
        {total === 0 && (
          <div className="h-full bg-gray-200 w-full rounded-full" />
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-600">
            Capital Ajustado: <span className="font-semibold">{formatMoney(capital)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-gray-600">
            Ganancias Netas: <span className="font-semibold">{formatMoney(ganancias)}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${
      type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {type === "success" ? "✅" : "❌"} {message}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ animation: "fadeUp 0.2s ease" }}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export default function Finanzas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showInyeccionModal, setShowInyeccionModal] = useState(false);
  const [showRetiroModal, setShowRetiroModal] = useState(false);

  // Form states
  const [inyeccionForm, setInyeccionForm] = useState({ monto: "", concepto: "" });
  const [retiroForm, setRetiroForm] = useState({ monto: "", concepto: "" });

  // Submit states
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorSubmit, setErrorSubmit] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);

  // Movimientos
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/finanzas/dashboard");
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar datos financieros");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    
    // Cargar movimientos
    const fetchMovimientos = async () => {
      setLoadingMovimientos(true);
      try {
        const res = await api.get("/finanzas/movimientos?limite=50");
        setMovimientos(res.data || []);
      } catch (err) {
        console.error("Error al cargar movimientos:", err);
      } finally {
        setLoadingMovimientos(false);
      }
    };
    fetchMovimientos();
  }, [fetchDashboard]);

  const handleInyeccion = async (e) => {
    e.preventDefault();
    setErrorSubmit(null);
    setLoadingSubmit(true);

    try {
      await api.post("/finanzas/inyeccion", {
        monto: parseFloat(inyeccionForm.monto),
        concepto: inyeccionForm.concepto,
      });
      setShowInyeccionModal(false);
      setInyeccionForm({ monto: "", concepto: "" });
      setToast({ message: "Capital inyectado correctamente", type: "success" });
      fetchDashboard();
    } catch (err) {
      setErrorSubmit(err.response?.data?.message || "Error al inyectar capital");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleRetiro = async (e) => {
    e.preventDefault();
    setErrorSubmit(null);
    setLoadingSubmit(true);

    try {
      await api.post("/finanzas/retiro", {
        monto: parseFloat(retiroForm.monto),
        concepto: retiroForm.concepto,
      });
      setShowRetiroModal(false);
      setRetiroForm({ monto: "", concepto: "" });
      setToast({ message: "Retiro realizado correctamente", type: "success" });
      fetchDashboard();
    } catch (err) {
      setErrorSubmit(err.response?.data?.message || "Error al retirar ganancias");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const capitalTotal = data?.capital?.total || 0;
  const gananciasVisuales = data?.ganancias?.brutas ?? 0;
  const gananciasDisponibles = data?.ganancias?.netas ?? 0;
  const dineroEnCaja = data?.dinero?.enCaja || 0;
  const dineroEnCalle = data?.dinero?.enCalle || 0;
  const dineroTotal = data?.dinero?.total || 0;

  const metricas = data?.metricas || {};
  const alertas = data?.alertas || [];
  const resumen = data?.resumen || {};
  const capital = data?.capital || {};

  const montoInyeccion = parseFloat(inyeccionForm.monto) || 0;
  const montoRetiro = parseFloat(retiroForm.monto) || 0;
  const esMontoRetiroValido = montoRetiro > 0 && montoRetiro <= gananciasDisponibles;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-semibold">Error</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Modal: Inyectar Capital */}
      <Modal
        isOpen={showInyeccionModal}
        onClose={() => { setShowInyeccionModal(false); setInyeccionForm({ monto: "", concepto: "" }); setErrorSubmit(null); }}
        title="Inyectar Capital"
      >
        <form onSubmit={handleInyeccion} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-600 font-semibold">CAPITAL ACTUAL</p>
            <p className="text-xl font-bold text-blue-700">{formatMoney(capitalTotal)}</p>
            <p className="text-xs text-blue-500">Tu dinero invertido</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monto a inyectar</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm font-medium border-r border-gray-200">RD$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={inyeccionForm.monto}
                onChange={(e) => setInyeccionForm({ ...inyeccionForm, monto: e.target.value })}
                placeholder="0.00"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-medium"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Concepto</label>
            <input
              type="text"
              value={inyeccionForm.concepto}
              onChange={(e) => setInyeccionForm({ ...inyeccionForm, concepto: e.target.value })}
              placeholder="Ej: Aumento de capital para nuevos préstamos"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {montoInyeccion > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-emerald-600 font-semibold">NUEVO CAPITAL TOTAL</p>
              <p className="text-lg font-bold text-emerald-700">{formatMoney(capitalTotal + montoInyeccion)}</p>
            </div>
          )}

          {errorSubmit && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{errorSubmit}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowInyeccionModal(false); setInyeccionForm({ monto: "", concepto: "" }); }}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loadingSubmit || montoInyeccion <= 0 || !inyeccionForm.concepto}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingSubmit ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Confirmar"
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Retirar Ganancias */}
      <Modal
        isOpen={showRetiroModal}
        onClose={() => { setShowRetiroModal(false); setRetiroForm({ monto: "", concepto: "" }); setErrorSubmit(null); }}
        title="Retirar Ganancias"
      >
        <form onSubmit={handleRetiro} className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-semibold">GANANCIAS DISPONIBLES</p>
            <p className="text-xl font-bold text-emerald-700">{formatMoney(gananciasDisponibles)}</p>
            <p className="text-xs text-emerald-500">Lo que puedes retirar</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monto a retirar</label>
            <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
              <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm font-medium border-r border-gray-200">RD$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={retiroForm.monto}
                onChange={(e) => setRetiroForm({ ...retiroForm, monto: e.target.value })}
                placeholder="0.00"
                className={`flex-1 px-3 py-2.5 text-sm focus:outline-none font-medium ${
                  montoRetiro > gananciasDisponibles && montoRetiro > 0 ? "text-red-600 bg-red-50" : ""
                }`}
                autoFocus
              />
            </div>
            {montoRetiro > gananciasDisponibles && montoRetiro > 0 && (
              <p className="text-xs text-red-500 mt-1">
                Máximo disponible: {formatMoney(gananciasDisponibles)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Concepto</label>
            <input
              type="text"
              value={retiroForm.concepto}
              onChange={(e) => setRetiroForm({ ...retiroForm, concepto: e.target.value })}
              placeholder="Ej: Retiro ganancias mes de abril"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {errorSubmit && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{errorSubmit}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium">
              ⚠️ Al retirar, las ganancias disponibles disminuirán.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowRetiroModal(false); setRetiroForm({ monto: "", concepto: "" }); }}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loadingSubmit || !esMontoRetiroValido || !retiroForm.concepto}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingSubmit ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Confirmar Retiro"
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Módulo Financiero
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Resumen del estado de tu negocio
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowInyeccionModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold border border-blue-200 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Inyectar Capital
          </button>
          <button
            onClick={() => setShowRetiroModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold border border-emerald-200 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Retirar Ganancias
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Capital"
              value={formatMoney(capitalTotal)}
              sub={capital.tieneCapitalRegistrado ? "Tu inversión" : "Sin registrar"}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              accentColor="bg-blue-50"
              delay={0}
            />
            <KpiCard
              label="Ganancias"
              value={formatMoney(gananciasVisuales)}
              sub="Lo que ha generado el negocio"
              icon={
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              accentColor="bg-emerald-50"
              delay={60}
            />
            <KpiCard
              label="En Caja"
              value={formatMoney(dineroEnCaja)}
              sub="Disponible hoy"
              icon={
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              }
              accentColor="bg-green-50"
              delay={120}
            />
            <KpiCard
              label="En Calle"
              value={formatMoney(dineroEnCalle)}
              sub="Prestado a clientes"
              icon={
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              accentColor="bg-orange-50"
              delay={180}
            />
          </div>

          {/* Distribution Bar */}
          <DistributionBar capital={capitalTotal} ganancias={gananciasDisponibles} />

          {/* Metrics */}
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            style={{ animation: "fadeUp 0.4s ease 250ms both" }}
          >
            <MetricCard
              label="Rentabilidad"
              value={metricas.rentabilidad}
              sub="Sobre tu capital"
              positive={metricas.rentabilidad > 0}
            />
            <MetricCard
              label="Eficiencia"
              value={metricas.eficienciaCobranza}
              sub="Cobrado vs esperado"
              positive={metricas.eficienciaCobranza > 80}
            />
            <MetricCard
              label="Dinero Ocioso"
              value={metricas.dineroOcioso}
              sub="Sin generar retorno"
              positive={metricas.dineroOcioso === 0}
            />
            <MetricCard
              label="Crecimiento"
              value={metricas.crecimientoMensual}
              sub="vs mes anterior"
              positive={metricas.crecimientoMensual >= 0}
            />
          </div>

          {/* Alerts */}
          {alertas.length > 0 && (
            <div
              className="space-y-2"
              style={{ animation: "fadeUp 0.4s ease 300ms both" }}
            >
              <h3 className="text-sm font-bold text-gray-700">Alertas</h3>
              {alertas.map((alerta, index) => (
                <AlertItem key={index} alerta={alerta} />
              ))}
            </div>
          )}

          {/* Resumen */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            style={{ animation: "fadeUp 0.4s ease 350ms both" }}
          >
            <h3 className="text-sm font-bold text-gray-700 mb-4">Resumen Financiero</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Total Cobrado</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatMoneyFull(resumen.totalCobrado)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Total Gastado</p>
                <p className="text-lg font-bold text-red-600">
                  {formatMoneyFull(resumen.totalGastos)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Balance Neto</p>
                <p className={`text-lg font-bold ${resumen.balanceNeto >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatMoneyFull(resumen.balanceNeto)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Total Desembolsado</p>
                <p className="text-lg font-bold text-orange-600">
                  {formatMoneyFull(resumen.totalDesembolsos)}
                </p>
              </div>
            </div>

            {resumen.totalInteres !== undefined && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">Interés Total</p>
                  <p className="text-base font-bold text-amber-600">
                    {formatMoneyFull(resumen.totalInteres)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">Mora Total</p>
                  <p className="text-base font-bold text-red-500">
                    {formatMoneyFull(resumen.totalMora)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Capital Details */}
          {capital.tieneCapitalRegistrado && (
            <div
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              style={{ animation: "fadeUp 0.4s ease 400ms both" }}
            >
              <h3 className="text-sm font-bold text-gray-700 mb-4">Detalles del Capital</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Capital Inicial</p>
                  <p className="text-lg font-bold text-blue-700">
                    {formatMoney(capital.inicial)}
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">Inyecciones</p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatMoney(capital.totalInyecciones)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timestamp */}
          {data.timestamp && (
            <p className="text-xs text-gray-400 text-center">
              Última actualización: {new Date(data.timestamp).toLocaleString("es-DO")}
            </p>
          )}

          {/* Movimientos Financieros */}
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-sm"
            style={{ animation: "fadeUp 0.4s ease 450ms both" }}
          >
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-700">Movimientos Financieros</h3>
            </div>

            {loadingMovimientos ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : movimientos.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">No hay movimientos registrados aún</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {Object.entries(
                  movimientos.reduce((acc, mov) => {
                    const fecha = new Date(mov.fecha).toLocaleDateString("es-DO", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    });
                    if (!acc[fecha]) acc[fecha] = [];
                    acc[fecha].push(mov);
                    return acc;
                  }, {})
                ).map(([fecha, movimientosFecha]) => (
                  <div key={fecha}>
                    <div className="sticky top-0 bg-gray-50 px-5 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase">{fecha}</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {movimientosFecha.map((mov) => {
                        const config = {
                          PAGO_RECIBIDO: { icon: "🟢", label: "Pago recibido", color: "text-emerald-600", bg: "bg-emerald-50" },
                          DESEMBOLSO: { icon: "🟡", label: "Desembolso", color: "text-amber-600", bg: "bg-amber-50" },
                          GASTO: { icon: "🔴", label: "Gasto", color: "text-red-600", bg: "bg-red-50" },
                          INYECCION_CAPITAL: { icon: "💰", label: "Inyección capital", color: "text-blue-600", bg: "bg-blue-50" },
                          RETIRO_GANANCIAS: { icon: "📤", label: "Retiro ganancias", color: "text-orange-600", bg: "bg-orange-50" },
                          CIERRE_CAJA: { icon: "📦", label: "Cierre caja", color: "text-gray-600", bg: "bg-gray-50" },
                          CORRECCION: { icon: "🔧", label: "Corrección", color: "text-purple-600", bg: "bg-purple-50" },
                        };
                        const c = config[mov.tipo] || config.CORRECCION;
                        const hora = new Date(mov.fecha).toLocaleTimeString("es-DO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div key={mov.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${c.bg}`}>
                                  {c.icon}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{mov.descripcion || c.label}</p>
                                  <p className="text-xs text-gray-400">{hora} · {mov.usuario?.nombre || "Sistema"}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${mov.tipo === "GASTO" || mov.tipo === "RETIRO_GANANCIAS" || mov.tipo === "DESEMBOLSO" ? "text-red-600" : "text-emerald-600"}`}>
                                  {mov.tipo === "GASTO" || mov.tipo === "RETIRO_GANANCIAS" || mov.tipo === "DESEMBOLSO" ? "-" : "+"}{formatMoney(mov.monto)}
                                </p>
                              </div>
                            </div>
                            {(mov.capital > 0 || mov.interes > 0 || mov.mora > 0) && (
                              <div className="flex gap-4 mt-2 ml-11">
                                {mov.capital > 0 && (
                                  <span className="text-xs text-blue-600">Capital: {formatMoney(mov.capital)}</span>
                                )}
                                {mov.interes > 0 && (
                                  <span className="text-xs text-amber-600">Interés: {formatMoney(mov.interes)}</span>
                                )}
                                {mov.mora > 0 && (
                                  <span className="text-xs text-red-500">Mora: {formatMoney(mov.mora)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}