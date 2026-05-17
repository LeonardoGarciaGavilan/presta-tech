//NuevoPrestamo.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import {
  formatCurrency,
  formatCurrencyFlexible,
  formatThousands,
  formatCedula,
  formatDate,
  calcularAmortizacion,
  calcularCuotasRapidas,
  calcularTasaDesdePago,
  FRECUENCIA_LABEL,
  FRECUENCIA_OPTIONS,
  CONFIG_FRECUENCIAS,
  FRECUENCIA_TASA_LABEL,
} from "../utils/prestamosUtils";

const inputBase =
  "w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent placeholder:text-gray-400";
const inputErr = "border-red-400 bg-red-50 focus:ring-red-400";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";
const errorMsg = "text-red-500 text-xs mt-1";

const DURACION_LABEL = {
  DIARIO: "días",
  SEMANAL: "semanas",
  QUINCENAL: "quincenas",
  MENSUAL: "meses",
};

const ResumenItem = ({ title, value, highlight = false }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500">{title}</span>
    <span className={`text-sm font-semibold ${highlight ? "text-blue-700 text-base" : "text-gray-800"}`}>
      {value}
    </span>
  </div>
);

export default function NuevoPrestamo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchRef = useRef(null);

  const [form, setForm] = useState({
    clienteId: "",
    garanteId: null,
    monto: "",
    tasaInteres: "",
    numeroCuotas: "",
    frecuenciaPago: "SEMANAL",
    fechaInicio: new Date().toISOString().split("T")[0],
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Configuración de límites
  const [config, setConfig] = useState({
    montoMinimoPrestamo: 500,
    montoMaximoPrestamo: null,
  });

  const [searchText, setSearchText] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);

  // Estado para búsqueda de garante
  const [searchTextGarante, setSearchTextGarante] = useState("");
  const [garanteSeleccionado, setGaranteSeleccionado] = useState(null);
  const [sugerenciasGarante, setSugerenciasGarante] = useState([]);
  const [buscandoGarante, setBuscandoGarante] = useState(false);
  const [showSugerenciasGarante, setShowSugerenciasGarante] = useState(false);

  const [preview, setPreview] = useState(null);
  const [showTabla, setShowTabla] = useState(false);

  // Modo rápido informal
  const [modoRapido, setModoRapido] = useState(true);
  const [modoCalculoRapido, setModoCalculoRapido] = useState("PAGO");
  const [pagoPorPeriodo, setPagoPorPeriodo] = useState("");
  const [gananciaDeseada, setGananciaDeseada] = useState("");
  const [duracion, setDuracion] = useState("");
  const [warnings, setWarnings] = useState({});
  const solverRef = useRef(null);

  const fmt = modoRapido ? formatCurrencyFlexible : formatCurrency;

  useEffect(() => {
    const monto      = searchParams.get("monto");
    const tasa       = searchParams.get("tasa");
    const cuotas     = searchParams.get("cuotas");
    const frecuencia = searchParams.get("frecuencia");
    const fecha      = searchParams.get("fecha");
    if (monto || tasa || cuotas || frecuencia || fecha) {
      setForm((prev) => ({
        ...prev,
        ...(monto      && { monto }),
        ...(tasa       && { tasaInteres: tasa }),
        ...(cuotas     && { numeroCuotas: cuotas }),
        ...(frecuencia && { frecuenciaPago: frecuencia }),
        ...(fecha      && { fechaInicio: fecha }),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar configuración de límites
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/configuracion");
        setConfig({
          montoMinimoPrestamo: res.data.montoMinimoPrestamo ?? 500,
          montoMaximoPrestamo: res.data.montoMaximoPrestamo ?? null,
        });
      } catch { /* silencioso */ }
    })();
  }, []);

  // ✅ Búsqueda de clientes — usa el parámetro ?search= del backend paginado
  useEffect(() => {
    if (searchText.length < 2) { setSugerencias([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        // El backend ahora acepta ?search= y devuelve { data, total, ... }
        const res = await api.get(`/clientes?search=${encodeURIComponent(searchText)}&limit=6`);
        const lista = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setSugerencias(lista.slice(0, 6));
        setShowSugerencias(true);
      } catch {
        setSugerencias([]);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  // ✅ Búsqueda de garantes — similar a clientes pero excluye el cliente seleccionado
  useEffect(() => {
    if (searchTextGarante.length < 2 || !form.clienteId) { setSugerenciasGarante([]); return; }
    const timer = setTimeout(async () => {
      setBuscandoGarante(true);
      try {
        const res = await api.get(`/clientes?search=${encodeURIComponent(searchTextGarante)}&limit=6&activo=true`);
        const lista = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        // Filtrar: excluir el cliente actual del préstamo
        const filtrados = lista.filter(c => c.id !== form.clienteId);
        setSugerenciasGarante(filtrados.slice(0, 5));
        setShowSugerenciasGarante(true);
      } catch {
        setSugerenciasGarante([]);
      } finally {
        setBuscandoGarante(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTextGarante, form.clienteId]);

  // Preview amortización
  useEffect(() => {
    if (modoRapido) {
      const montoVal = parseFloat(form.monto);
      const duracionVal = parseInt(duracion, 10);
      if (montoVal > 0 && duracionVal > 0) {
        if (modoCalculoRapido === "PAGO") {
          const pagoVal = parseFloat(pagoPorPeriodo);
          if (pagoVal > 0) {
            const totalCobrar = pagoVal * duracionVal;
            const cuotaFija = Math.round(pagoVal);
            try {
              setPreview(calcularCuotasRapidas(montoVal, totalCobrar, cuotaFija, duracionVal, form.frecuenciaPago, form.fechaInicio));
            } catch {
              setPreview(null);
            }
          } else {
            setPreview(null);
          }
        } else {
          const gananciaVal = parseFloat(gananciaDeseada);
          if (gananciaVal >= 0) {
            const totalCobrar = montoVal + gananciaVal;
            if (totalCobrar > montoVal) {
              const cuotaIdeal = totalCobrar / duracionVal;
              const cuotaFija = Math.round(cuotaIdeal);
              try {
                setPreview(calcularCuotasRapidas(montoVal, totalCobrar, cuotaFija, duracionVal, form.frecuenciaPago, form.fechaInicio));
              } catch {
                setPreview(null);
              }
            } else {
              setPreview(null);
            }
          } else {
            setPreview(null);
          }
        }
      } else {
        setPreview(null);
      }
    } else {
      const monto  = parseFloat(form.monto);
      const tasa   = parseFloat(form.tasaInteres);
      const cuotas = parseInt(form.numeroCuotas);
      if (monto > 0 && tasa > 0 && cuotas > 0) {
        setPreview(calcularAmortizacion(monto, tasa, cuotas, form.frecuenciaPago, form.fechaInicio));
      } else {
        setPreview(null);
      }
    }
  }, [modoRapido, modoCalculoRapido, form.monto, form.tasaInteres, form.numeroCuotas, form.frecuenciaPago, form.fechaInicio, pagoPorPeriodo, gananciaDeseada, duracion]);

  // Ajustar cuotas automáticamente si están fuera del rango permitido (solo modo normal)
  useEffect(() => {
    if (modoRapido) return;
    const cfg = CONFIG_FRECUENCIAS[form.frecuenciaPago];
    if (!cfg) return;
    const cuotas = parseInt(form.numeroCuotas, 10);
    if (!isNaN(cuotas) && (cuotas < cfg.min || cuotas > cfg.max)) {
      setForm((prev) => ({ ...prev, numeroCuotas: String(cfg.sugeridas[0]) }));
    }
  }, [form.frecuenciaPago, modoRapido]);

  // Derivar tasa automática en modo rápido (con debounce)
  useEffect(() => {
    if (!modoRapido) {
      setWarnings({});
      return;
    }

    if (solverRef.current) clearTimeout(solverRef.current);

    const montoVal = parseFloat(form.monto);
    const duracionVal = parseInt(duracion, 10);
    let pagoVal;

    if (modoCalculoRapido === "GANANCIA") {
      const gananciaVal = parseFloat(gananciaDeseada);
      if (montoVal > 0 && gananciaVal >= 0 && duracionVal > 0) {
        const totalCobrar = montoVal + gananciaVal;
        if (totalCobrar <= montoVal) {
          setWarnings((p) => ({ ...p, gananciaInvalida: "El total a cobrar debe ser mayor al monto prestado." }));
          return;
        }
        setWarnings((p) => {
          const next = { ...p };
          delete next.gananciaInvalida;
          return next;
        });
        pagoVal = totalCobrar / duracionVal;
      } else {
        return;
      }
    } else {
      pagoVal = parseFloat(pagoPorPeriodo);
    }

    if (montoVal > 0 && pagoVal > 0 && duracionVal > 0 && form.frecuenciaPago) {
      solverRef.current = setTimeout(() => {
        const pagoMinimo = montoVal / duracionVal;

        if (pagoVal < pagoMinimo) {
          setWarnings((p) => ({ ...p, pagoBajo: `El pago es demasiado bajo para cubrir el monto prestado. Mínimo: ${formatCurrencyFlexible(pagoMinimo)}` }));
          return;
        }
        setWarnings((p) => {
          const next = { ...p };
          delete next.pagoBajo;
          return next;
        });

        setForm((prev) => ({ ...prev, numeroCuotas: String(duracionVal) }));

        const tasa = calcularTasaDesdePago(montoVal, pagoVal, duracionVal, form.frecuenciaPago);

        if (tasa !== null && tasa >= 0) {
          setForm((prev) => ({ ...prev, tasaInteres: String(Math.round(tasa * 100) / 100) }));

          if (tasa > 50) {
            setWarnings((p) => ({ ...p, tasaAlta: "La tasa equivalente calculada es alta." }));
          } else {
            setWarnings((p) => {
              const next = { ...p };
              delete next.tasaAlta;
              return next;
            });
          }
        }
      }, 300);
    }

    return () => {
      if (solverRef.current) clearTimeout(solverRef.current);
    };
  }, [modoRapido, modoCalculoRapido, form.monto, pagoPorPeriodo, gananciaDeseada, duracion, form.frecuenciaPago]);

  const seleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setForm((p) => ({ ...p, clienteId: cliente.id }));
    setSearchText(`${cliente.nombre} ${cliente.apellido || ""}`);
    setSugerencias([]);
    setShowSugerencias(false);
    if (errors.clienteId) setErrors((p) => ({ ...p, clienteId: null }));
  };

  const limpiarCliente = () => {
    setClienteSeleccionado(null);
    setForm((p) => ({ ...p, clienteId: "" }));
    setSearchText("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const seleccionarGarante = (cliente) => {
    // Validación: no puede ser el mismo cliente
    if (cliente.id === form.clienteId) {
      setErrors((p) => ({ ...p, garanteId: "El cliente no puede ser su propio garante" }));
      return;
    }
    setGaranteSeleccionado(cliente);
    setForm((p) => ({ ...p, garanteId: cliente.id }));
    setSearchTextGarante(`${cliente.nombre} ${cliente.apellido || ""}`);
    setSugerenciasGarante([]);
    setShowSugerenciasGarante(false);
    if (errors.garanteId) setErrors((p) => ({ ...p, garanteId: null }));
  };

  const limpiarGarante = () => {
    setGaranteSeleccionado(null);
    setForm((p) => ({ ...p, garanteId: null }));
    setSearchTextGarante("");
    setSugerenciasGarante([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: null }));
  };

  const validate = () => {
    const e = {};
    const montoNum = parseFloat(form.monto);
    
    if (!form.clienteId)                                        e.clienteId      = "Selecciona un cliente.";
    if (!form.monto || montoNum <= 0)                           e.monto          = "Ingresa un monto válido.";
    
    // Validar monto mínimo
    if (montoNum > 0 && montoNum < config.montoMinimoPrestamo) {
      e.monto = `El monto mínimo es RD$${config.montoMinimoPrestamo.toLocaleString()}`;
    }
    
    // Validar monto máximo si está configurado
    if (config.montoMaximoPrestamo !== null && montoNum > config.montoMaximoPrestamo) {
      e.monto = `El monto máximo es RD$${config.montoMaximoPrestamo.toLocaleString()}`;
    }
    
    if (!form.tasaInteres || parseFloat(form.tasaInteres) <= 0) e.tasaInteres    = "Ingresa una tasa válida.";
    if (!form.numeroCuotas || parseInt(form.numeroCuotas) < 1)  e.numeroCuotas  = "Ingresa un número de cuotas válido.";
    if (!form.frecuenciaPago)                                   e.frecuenciaPago = "Selecciona la frecuencia de pago.";
    if (!form.fechaInicio)                                      e.fechaInicio    = "Selecciona la fecha de inicio.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (modoRapido) {
      if (!preview || !preview.montoTotal || !preview.cuotas || preview.cuotas.length === 0) {
        setErrors({ submit: 'El resumen del préstamo rápido no está disponible. Verifica los datos ingresados.' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        clienteId:      form.clienteId,
        monto:          parseFloat(form.monto),
        tasaInteres:    parseFloat(form.tasaInteres),
        numeroCuotas:   parseInt(form.numeroCuotas, 10),
        frecuenciaPago: form.frecuenciaPago,
        fechaInicio:    form.fechaInicio,
        garanteId:      form.garanteId || undefined,
        ...(modoRapido && {
          modoRapido: true,
          montoTotal: preview?.montoTotal,
        }),
      };
      const res = await api.post("/prestamos", payload);
      navigate(`/prestamos/${res.data.id}`);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) {
        setErrors({ submit: msg });
      } else {
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      // Cerrar sugerencias de cliente
      if (searchRef.current?.closest(".autocomplete-wrap")?.contains(e.target))
        return;
      setShowSugerencias(false);
      
      // Cerrar sugerencias de garante (buscar en el contenedor del garante)
      const garanteWrap = document.querySelector('.garante-autocomplete');
      if (garanteWrap?.contains(e.target))
        return;
      setShowSugerenciasGarante(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate("/prestamos")} className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitar Préstamo</h1>
          <p className="text-sm text-gray-500">Completa los datos y envía la solicitud para aprobación del admin</p>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <span className="text-xs text-amber-600 shrink-0">📋</span>
        <p className="text-xs text-amber-700">
          La solicitud quedará pendiente hasta aprobación y desembolso del administrador.
        </p>
      </div>

      {/* Modo selector — tabs superiores */}
      <div className="mb-6">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => { setModoRapido(false); setWarnings({}); }}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              !modoRapido
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}>
            Normal
          </button>
          <button
            type="button"
            onClick={() => setModoRapido(true)}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              modoRapido
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}>
            ⚡ Rápido informal
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {modoRapido
            ? "Cuotas fijas rápidas para cobro informal. Define un pago o ganancia deseada."
            : "Amortización tradicional con interés sobre saldo."
          }
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Columna izquierda ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Cliente */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Cliente</h2>
              {clienteSeleccionado ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <div>
                    <p className="font-semibold text-blue-900">{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</p>
                    <p className="text-xs text-blue-600 font-mono mt-0.5">{formatCedula(clienteSeleccionado.cedula || "")}</p>
                  </div>
                  <button type="button" onClick={limpiarCliente} className="text-blue-400 hover:text-blue-700 transition-colors ml-4">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="autocomplete-wrap relative">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                    <input
                      ref={searchRef} type="text" value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
                      placeholder="Buscar por nombre o cédula…"
                      className={`${inputBase} pl-9 ${errors.clienteId ? inputErr : ""}`}
                    />
                    {buscando && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
                  </div>
                  {errors.clienteId && <p className={errorMsg}>{errors.clienteId}</p>}
                  {showSugerencias && sugerencias.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                      {sugerencias.map((c) => (
                        <button key={c.id} type="button" onClick={() => seleccionarCliente(c)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="font-semibold text-gray-800 text-sm">{c.nombre} {c.apellido}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{formatCedula(c.cedula || "")}{c.telefono && ` · ${c.telefono}`}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showSugerencias && searchText.length >= 2 && sugerencias.length === 0 && !buscando && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 px-4 py-3">
                      <p className="text-sm text-gray-400">No se encontraron clientes</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Garante */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Garante (opcional)</h2>
              {!form.clienteId ? (
                <p className="text-sm text-gray-400">Selecciona un cliente primero</p>
              ) : garanteSeleccionado ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <div>
                    <p className="font-semibold text-emerald-900">{garanteSeleccionado.nombre} {garanteSeleccionado.apellido}</p>
                    <p className="text-xs text-emerald-600 font-mono mt-0.5">{formatCedula(garanteSeleccionado.cedula || "")}</p>
                  </div>
                  <button type="button" onClick={limpiarGarante} className="text-emerald-400 hover:text-emerald-700 transition-colors ml-4">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="autocomplete-wrap relative garante-autocomplete">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                    <input
                      type="text" value={searchTextGarante}
                      onChange={(e) => { setSearchTextGarante(e.target.value); if (errors.garanteId) setErrors((p) => ({ ...p, garanteId: null })); }}
                      onFocus={() => sugerenciasGarante.length > 0 && setShowSugerenciasGarante(true)}
                      placeholder="Buscar garante por nombre o cédula…"
                      className={`${inputBase} pl-9 ${errors.garanteId ? inputErr : ""}`}
                    />
                    {buscandoGarante && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
                  </div>
                  {errors.garanteId && <p className={errorMsg}>{errors.garanteId}</p>}
                  {showSugerenciasGarante && sugerenciasGarante.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                      {sugerenciasGarante.map((c) => (
                        <button key={c.id} type="button" onClick={() => seleccionarGarante(c)}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="font-semibold text-gray-800 text-sm">{c.nombre} {c.apellido}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{formatCedula(c.cedula || "")}{c.telefono && ` · ${c.telefono}`}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {showSugerenciasGarante && searchTextGarante.length >= 2 && sugerenciasGarante.length === 0 && !buscandoGarante && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 px-4 py-3">
                      <p className="text-sm text-gray-400">No se encontraron garantes disponibles</p>
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Condiciones */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Condiciones del Préstamo</h2>
              <div className="grid grid-cols-2 gap-4">
                  {/* Monto */}
                  <div className="col-span-2">
                    <label className={labelCls}>Monto a prestar</label>
                    <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition ${errors.monto ? "border-red-400" : "border-gray-200"}`}>
                      <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0 select-none">RD$</span>
                      <input name="monto" value={formatThousands(form.monto)} onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        if ((raw.match(/\./g) || []).length > 1) return;
                        setForm((p) => ({ ...p, monto: raw }));
                        if (errors.monto) setErrors((p) => ({ ...p, monto: null }));
                      }} placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" inputMode="decimal" />
                    </div>
                    {errors.monto && <p className={errorMsg}>{errors.monto}</p>}
                  </div>

                {/* Campos rápidos informales */}
                {modoRapido && (
                  <>
                    {/* Sub-toggle: Pago vs Ganancia */}
                    <div className="col-span-2">
                      <label className={labelCls}>Calcular por</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button"
                          onClick={() => { setModoCalculoRapido("PAGO"); setWarnings({}); }}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            modoCalculoRapido === "PAGO"
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                          }`}>
                          Pago por período
                        </button>
                        <button type="button"
                          onClick={() => { setModoCalculoRapido("GANANCIA"); setWarnings({}); }}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            modoCalculoRapido === "GANANCIA"
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                          }`}>
                          Ganancia deseada
                        </button>
                      </div>
                    </div>

                    {/* Pago por período o Ganancia deseada */}
                    {modoCalculoRapido === "PAGO" ? (
                      <div>
                        <label className={labelCls}>Pago {FRECUENCIA_LABEL[form.frecuenciaPago].toLowerCase()}</label>
                        <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition border-gray-200">
                          <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0 select-none">RD$</span>
                          <input value={formatThousands(pagoPorPeriodo)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, '');
                              if ((raw.match(/\./g) || []).length > 1) return;
                              setPagoPorPeriodo(raw);
                            }}
                            placeholder="0.00" inputMode="decimal"
                            className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {[500, 1000, 2000, 5000].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setPagoPorPeriodo(String(s))}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                            >
                              RD$ {s.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className={labelCls}>Ganancia deseada</label>
                          <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition border-gray-200">
                            <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0 select-none">RD$</span>
                            <input value={formatThousands(gananciaDeseada)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, '');
                                if ((raw.match(/\./g) || []).length > 1) return;
                                setGananciaDeseada(raw);
                              }}
                              placeholder="0.00" inputMode="decimal"
                              className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" />
                          </div>
                          {warnings.gananciaInvalida && (
                            <p className="text-amber-600 text-xs mt-1">{warnings.gananciaInvalida}</p>
                          )}
                        </div>
                        {/* Pago calculado (readonly) */}
                        {(() => {
                          const mVal = parseFloat(form.monto);
                          const gVal = parseFloat(gananciaDeseada);
                          const dVal = parseInt(duracion, 10);
                          if (mVal > 0 && gVal >= 0 && dVal > 0) {
                            const total = mVal + gVal;
                            const pagoCalc = total / dVal;
                            return (
                              <div>
                                <label className={labelCls}>Pago {FRECUENCIA_LABEL[form.frecuenciaPago].toLowerCase()} calculado</label>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                                  <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0 select-none">RD$</span>
                                  <span className="flex-1 px-3 py-2 text-sm font-semibold text-blue-700 bg-gray-50">
                                    {formatCurrencyFlexible(pagoCalc)}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                    {/* Duración */}
                    <div>
                      <label className={labelCls}>{DURACION_LABEL[form.frecuenciaPago]?.charAt(0).toUpperCase() + DURACION_LABEL[form.frecuenciaPago]?.slice(1)}</label>
                      <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition border-gray-200">
                        <input value={duracion}
                          onChange={(e) => setDuracion(e.target.value)}
                          placeholder="12" inputMode="numeric"
                          className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" />
                        <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-l border-gray-200 shrink-0 select-none">
                          {DURACION_LABEL[form.frecuenciaPago]}
                        </span>
                      </div>
                      {warnings.pagoBajo && (
                        <p className="text-amber-600 text-xs mt-1">{warnings.pagoBajo}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Tasa */}
                {modoRapido ? (
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Tasa equivalente</span>
                      <span className="text-blue-400 text-xs cursor-help" title="Calculada automáticamente en base al pago y duración">ℹ️</span>
                    </div>
                    <p className="text-sm font-bold text-blue-800">{form.tasaInteres || "0"}%</p>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>{`Tasa de interés ${FRECUENCIA_TASA_LABEL[form.frecuenciaPago]}`}</label>
                    <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition ${errors.tasaInteres ? "border-red-400" : "border-gray-200"}`}>
                      <input name="tasaInteres" value={form.tasaInteres} onChange={handleChange} placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" inputMode="decimal" />
                      <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-l border-gray-200 shrink-0 select-none">%</span>
                    </div>
                    {errors.tasaInteres && <p className={errorMsg}>{errors.tasaInteres}</p>}
                  </div>
                )}

                {/* Cuotas */}
                {modoRapido ? (
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Cuotas</span>
                    </div>
                    <p className="text-sm font-bold text-blue-800">{form.numeroCuotas || "0"} cuotas</p>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Número de cuotas</label>
                    <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition ${errors.numeroCuotas ? "border-red-400" : "border-gray-200"}`}>
                      <input name="numeroCuotas" value={form.numeroCuotas} onChange={handleChange} placeholder="12"
                        className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" inputMode="numeric" />
                      <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-l border-gray-200 shrink-0 select-none">cuotas</span>
                    </div>
                    {errors.numeroCuotas && <p className={errorMsg}>{errors.numeroCuotas}</p>}
                  </div>
                )}

                {/* Frecuencia */}
                <div className="col-span-2">
                  <label className={labelCls}>Frecuencia de pago</label>
                  <div className="grid grid-cols-4 gap-2">
                    {FRECUENCIA_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => { setForm((p) => ({ ...p, frecuenciaPago: opt.value })); if (errors.frecuenciaPago) setErrors((p) => ({ ...p, frecuenciaPago: null })); }}
                        className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                          form.frecuenciaPago === opt.value
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {errors.frecuenciaPago && <p className={errorMsg}>{errors.frecuenciaPago}</p>}
                  {/* Cuotas sugeridas (solo modo normal) */}
                  {!modoRapido && (() => {
                    const cfg = CONFIG_FRECUENCIAS[form.frecuenciaPago];
                    return (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-1.5">
                          {cfg.sugeridas.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setForm((p) => ({ ...p, numeroCuotas: String(n) }));
                                if (errors.numeroCuotas) setErrors((p) => ({ ...p, numeroCuotas: null }));
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                parseInt(form.numeroCuotas) === n
                                  ? "bg-blue-100 text-blue-700 border-blue-300"
                                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 italic">{cfg.descripcion}</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Fecha */}
                <div className="col-span-2">
                  <label className={labelCls}>Fecha de inicio (desembolso estimado)</label>
                  <input type="date" name="fechaInicio" value={form.fechaInicio} onChange={handleChange}
                    className={`${inputBase} ${errors.fechaInicio ? inputErr : ""}`} />
                  {errors.fechaInicio && <p className={errorMsg}>{errors.fechaInicio}</p>}
                </div>
              </div>
            </div>

            {/* Tabla amortización */}
            {preview && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button type="button" onClick={() => setShowTabla(!showTabla)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <span>Ver tabla de amortización completa ({preview.cuotas.length} cuotas)</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showTabla ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTabla && (
                  <div className="overflow-x-auto border-t border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                          <th className="px-3 py-2 text-left font-semibold">Cuota</th>
                          <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                          <th className="px-3 py-2 text-right font-semibold">Capital</th>
                          <th className="px-3 py-2 text-right font-semibold">Interés</th>
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                          <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {preview.cuotas.map((c) => (
                          <tr key={c.numero} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-3 py-2 font-medium text-gray-700">#{c.numero}</td>
                            <td className="px-3 py-2 text-gray-500">{formatDate(c.fechaVencimiento)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{fmt(c.capital)}</td>
                            <td className="px-3 py-2 text-right text-amber-600">{fmt(c.interes)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(c.monto)}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{fmt(c.saldoRestante)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Columna derecha: resumen ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Resumen</h2>
              {preview ? (
                <>
                  <ResumenItem title="Monto prestado"      value={fmt(parseFloat(form.monto))} />
                  {modoRapido && modoCalculoRapido === "GANANCIA" && (
                    <ResumenItem title="Ganancia deseada" value={formatCurrencyFlexible(parseFloat(gananciaDeseada || 0))} />
                  )}
                  {modoRapido ? (
                    <ResumenItem title="Ganancia total"   value={formatCurrencyFlexible(preview.totalIntereses)} />
                  ) : (
                    <ResumenItem title="Total intereses"  value={formatCurrency(preview.totalIntereses)} />
                  )}
                  <ResumenItem title={modoRapido ? "Total a cobrar" : "Monto total a pagar"} value={fmt(preview.montoTotal)} highlight />
                  <ResumenItem title={modoRapido ? `Pago ${FRECUENCIA_LABEL[form.frecuenciaPago].toLowerCase()}` : "Primera cuota"} value={fmt(preview.cuotaInicial)} />
                  <ResumenItem title="N° de cuotas"        value={`${form.numeroCuotas} cuotas`} />
                  {modoRapido && duracion && (
                    <ResumenItem title="Duración"         value={`${duracion} ${DURACION_LABEL[form.frecuenciaPago]}`} />
                  )}
                  {preview.cuotas.length > 0 && (
                    <ResumenItem title="Fecha última cuota" value={formatDate(preview.cuotas[preview.cuotas.length - 1].fechaVencimiento)} />
                  )}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{modoRapido ? "Capital recuperado" : "Capital"}</span>
                      <span>{modoRapido ? "Ganancia" : "Intereses"}</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                      <div className="bg-blue-500 transition-all duration-500"
                        style={{ width: `${(parseFloat(form.monto) / preview.montoTotal) * 100}%` }} />
                      <div className="bg-amber-400 flex-1" />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-blue-600 font-medium">{((parseFloat(form.monto) / preview.montoTotal) * 100).toFixed(1)}%</span>
                      <span className="text-amber-600 font-medium">{((preview.totalIntereses / preview.montoTotal) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Completa monto, tasa y cuotas para ver el resumen</p>
                </div>
              )}

              {warnings.tasaAlta && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700">{warnings.tasaAlta}</p>
                </div>
              )}

              <div className="mt-5 space-y-2">
                <button type="submit" disabled={submitting}
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm">
                  {submitting
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  }
                  {submitting ? "Enviando…" : "Enviar Solicitud"}
                </button>
                <button type="button" onClick={() => navigate("/prestamos")}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}