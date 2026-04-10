//Gastos.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";

// ─── Categorías predefinidas ──────────────────────────────────────────────────
const CATEGORIAS = [
  { label: "Vehículos",            value: "Vehículos",            emoji: "🚗" },
  { label: "Reparación",           value: "Reparación",           emoji: "🔧" },
  { label: "Mantenimiento",        value: "Mantenimiento",        emoji: "⚙️"  },
  { label: "Alquiler",             value: "Alquiler",             emoji: "🏠" },
  { label: "Combustible",          value: "Combustible",          emoji: "⛽" },
  { label: "Salarios",             value: "Salarios",             emoji: "👷" },
  { label: "Papelería",            value: "Papelería",            emoji: "📄" },
  { label: "Equipos Tecnológicos", value: "Equipos Tecnológicos", emoji: "💻" },
  { label: "Servicios",            value: "Servicios",            emoji: "💡" },
  { label: "Alimentación",         value: "Alimentación",         emoji: "🍽️"  },
  { label: "Marketing",            value: "Marketing",            emoji: "📣" },
  { label: "Otro",                 value: "Otro",                 emoji: "📦" },
];

const CATEGORIA_MAP = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c]));
const getCatEmoji   = (cat) => CATEGORIA_MAP[cat]?.emoji ?? "📦";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (n = 0) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency", currency: "DOP", minimumFractionDigits: 2,
  }).format(n);

/**
 * ✅ FIX TIMEZONE
 * El campo `fecha` viene del backend como DateTime ISO (UTC).
 * Ej: "2026-02-28T00:00:00.000Z"  → en RD (UTC-4) → 27 feb a las 8pm → muestra día anterior.
 *
 * Si el string es solo fecha "YYYY-MM-DD" (10 chars), añadimos T12:00:00
 * para forzar mediodía local — nunca cruza medianoche en ninguna zona horaria.
 * Si es un datetime completo, extraemos solo la parte de fecha para mostrarlo.
 */
const parseLocalDate = (d) => {
  if (!d) return new Date();
  const s = typeof d === "string" ? d : d.toISOString();
  // Extraer solo la parte YYYY-MM-DD del ISO string y añadir mediodía local
  const datePart = s.slice(0, 10);
  return new Date(datePart + "T12:00:00");
};

const formatDate = (d) =>
  new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(parseLocalDate(d));

const hoy          = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

const inputCls = "w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition placeholder:text-gray-400";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";

// ─── Inyectar animaciones una sola vez ────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("gastos-styles")) {
  const s = document.createElement("style");
  s.id = "gastos-styles";
  s.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    .pb-safe { padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); }
  `;
  document.head.appendChild(s);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:w-auto z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium
      ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
      {type === "success" ? "✅" : "❌"} {message}
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// ─── Modal crear/editar ───────────────────────────────────────────────────────
const INITIAL_FORM = {
  categoria: "", descripcion: "", monto: "",
  fecha: hoy(), proveedor: "", referencia: "", observaciones: "",
};

function GastoModal({ gasto, onClose, onSaved }) {
  const [form, setForm] = useState(gasto
    ? {
        ...gasto,
        monto: gasto.monto.toString(),
        // ✅ FIX: extraer solo la parte de fecha YYYY-MM-DD para el input type="date"
        fecha: gasto.fecha.slice(0, 10),
      }
    : INITIAL_FORM
  );
  const [submitting,      setSubmitting]      = useState(false);
  const [errors,          setErrors]          = useState({});
  const [catPersonalizada, setCatPersonalizada] = useState(
    gasto && !CATEGORIA_MAP[gasto.categoria] ? gasto.categoria : ""
  );
  const [usarOtra, setUsarOtra] = useState(gasto && !CATEGORIA_MAP[gasto.categoria]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: null }));
  };

  const validate = () => {
    const e = {};
    const cat = usarOtra ? catPersonalizada.trim() : form.categoria;
    if (!cat)                                        e.categoria   = "Selecciona o escribe una categoría";
    if (!form.descripcion.trim())                    e.descripcion = "La descripción es obligatoria";
    if (!form.monto || isNaN(form.monto) || +form.monto <= 0)
                                                     e.monto       = "Ingresa un monto válido mayor a 0";
    if (!form.fecha)                                 e.fecha       = "La fecha es obligatoria";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        categoria: usarOtra ? catPersonalizada.trim() : form.categoria,
        monto: parseFloat(form.monto),
        // ✅ FIX: enviar la fecha como mediodía UTC para que el backend la guarde
        // sin importar la zona horaria del servidor.
        // "2026-02-28" + "T12:00:00.000Z" → siempre 28 feb en cualquier zona
        fecha: form.fecha + "T12:00:00.000Z",
      };
      if (gasto) {
        await api.put(`/gastos/${gasto.id}`, payload);
      } else {
        await api.post("/gastos", payload);
      }
      onSaved(gasto ? "Gasto actualizado" : "Gasto registrado");
    } catch (err) {
      setErrors({ general: err.response?.data?.message ?? "Error al guardar" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-end sm:items-center overflow-y-auto z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl shadow-2xl"
        style={{ animation: "slideUp 0.25s ease", maxHeight: "95dvh", overflowY: "auto" }}
      >
        {/* Handle móvil */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {gasto ? "Editar Gasto" : "Nuevo Gasto"}
          </h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 pb-safe">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {errors.general}
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className={labelCls}>Categoría *</label>
            {!usarOtra ? (
              <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 mb-2">
                {CATEGORIAS.filter((c) => c.value !== "Otro").map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setForm((p) => ({ ...p, categoria: c.value }));
                      if (errors.categoria) setErrors((p) => ({ ...p, categoria: null }));
                    }}
                    className={`flex items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs font-medium transition-all active:scale-95
                      ${form.categoria === c.value
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                  >
                    <span>{c.emoji}</span> {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setUsarOtra(true); setForm((p) => ({ ...p, categoria: "" })); }}
                  className="flex items-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs font-medium bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-95"
                >
                  <span>✏️</span> Otra
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  value={catPersonalizada}
                  onChange={(e) => setCatPersonalizada(e.target.value)}
                  placeholder="Escribe la categoría…"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => { setUsarOtra(false); setCatPersonalizada(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap px-2 py-2 rounded-lg hover:bg-gray-100"
                >
                  ← Volver
                </button>
              </div>
            )}
            {errors.categoria && <p className="text-red-500 text-xs mt-1">{errors.categoria}</p>}
          </div>

          {/* Descripción */}
          <div>
            <label className={labelCls}>Descripción *</label>
            <input
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Ej: Pago de alquiler oficina enero 2025"
              className={`${inputCls} ${errors.descripcion ? "border-red-400" : ""}`}
            />
            {errors.descripcion && <p className="text-red-500 text-xs mt-1">{errors.descripcion}</p>}
          </div>

          {/* Monto y Fecha */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto (RD$) *</label>
              <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition
                ${errors.monto ? "border-red-400" : "border-gray-200"}`}>
                <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-sm border-r border-gray-200 shrink-0">RD$</span>
                <input
                  name="monto"
                  value={form.monto}
                  onChange={handleChange}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="flex-1 px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none"
                />
              </div>
              {errors.monto && <p className="text-red-500 text-xs mt-1">{errors.monto}</p>}
            </div>
            <div>
              <label className={labelCls}>Fecha *</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                className={`${inputCls} py-2.5 ${errors.fecha ? "border-red-400" : ""}`}
              />
              {errors.fecha && <p className="text-red-500 text-xs mt-1">{errors.fecha}</p>}
            </div>
          </div>

          {/* Proveedor y Referencia */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Proveedor</label>
              <input name="proveedor" value={form.proveedor} onChange={handleChange}
                placeholder="Nombre del proveedor" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Referencia / Factura</label>
              <input name="referencia" value={form.referencia} onChange={handleChange}
                placeholder="Nº factura o recibo" className={inputCls} />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
              placeholder="Notas adicionales…" rows={2} className={inputCls} />
          </div>

          {/* Botones */}
          <div className="flex flex-col-reverse xs:flex-row xs:justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full xs:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full xs:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {gasto ? "Actualizar" : "Registrar Gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta móvil ────────────────────────────────────────────────────────────
function GastoCard({ g, onEdit, onDelete, deleting }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{g.descripcion}</p>
          {g.proveedor  && <p className="text-xs text-gray-400 truncate">{g.proveedor}</p>}
          {g.referencia && <p className="text-xs text-gray-400 font-mono">#{g.referencia}</p>}
        </div>
        <p className="font-bold text-red-600 text-sm whitespace-nowrap shrink-0">{formatCurrency(g.monto)}</p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
            {getCatEmoji(g.categoria)} {g.categoria}
          </span>
          {/* ✅ FIX: usa formatDate con parseLocalDate */}
          <span className="text-xs text-gray-400">{formatDate(g.fecha)}</span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(g)}
            className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors active:scale-95"
            title="Editar"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(g)}
            disabled={deleting === g.id}
            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors active:scale-95 disabled:opacity-50"
            title="Eliminar"
          >
            {deleting === g.id
              ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Gastos() {
  const [gastos,   setGastos]   = useState([]);
  const [resumen,  setResumen]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [modal,    setModal]    = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Filtros
  const [desde,            setDesde]            = useState(primerDiaMes());
  const [hasta,            setHasta]            = useState(hoy());
  const [catFiltro,        setCatFiltro]        = useState("");
  const [search,           setSearch]           = useState("");
  const [filtrosAbiertos,  setFiltrosAbiertos]  = useState(false);

  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchGastos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (desde)     params.set("desde",     desde);
      if (hasta)     params.set("hasta",     hasta);
      if (catFiltro) params.set("categoria", catFiltro);

      const [gastosRes, resumenRes] = await Promise.all([
        api.get(`/gastos?${params}`),
        api.get("/gastos/resumen"),
      ]);
      setGastos(gastosRes.data);
      setResumen(resumenRes.data);
    } catch {
      showToast("Error al cargar los gastos", "error");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, catFiltro, showToast]);

  useEffect(() => { fetchGastos(); }, [fetchGastos]);

  // ─── Eliminar ────────────────────────────────────────────────────────────────
  const handleDelete = async (gasto) => {
    if (!window.confirm(`¿Eliminar el gasto "${gasto.descripcion}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(gasto.id);
    try {
      await api.delete(`/gastos/${gasto.id}`);
      showToast("Gasto eliminado");
      fetchGastos();
    } catch {
      showToast("Error al eliminar el gasto", "error");
    } finally {
      setDeleting(null);
    }
  };

  // ─── Búsqueda local ──────────────────────────────────────────────────────────
  const gastosFiltrados = useMemo(() => {
    if (!search.trim()) return gastos;
    const q = search.toLowerCase();
    return gastos.filter((g) =>
      g.descripcion.toLowerCase().includes(q) ||
      g.categoria.toLowerCase().includes(q) ||
      (g.proveedor  || "").toLowerCase().includes(q) ||
      (g.referencia || "").toLowerCase().includes(q)
    );
  }, [gastos, search]);

  const totalFiltrado = gastosFiltrados.reduce((s, g) => s + g.monto, 0);

  // ─── Top categorías ──────────────────────────────────────────────────────────
  const topCats = useMemo(() => {
    if (!resumen?.porCategoria) return [];
    return Object.entries(resumen.porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [resumen]);

  const maxCat = topCats[0]?.[1] || 1;

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {(modal === "nuevo" || (modal && modal !== "nuevo")) && (
        <GastoModal
          gasto={modal === "nuevo" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(msg) => { setModal(null); showToast(msg); fetchGastos(); }}
        />
      )}

      <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gastos</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Control de gastos de la empresa</p>
          </div>
          <button
            onClick={() => setModal("nuevo")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline">Nuevo Gasto</span>
            <span className="xs:hidden">Nuevo</span>
          </button>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Gasto este mes",  value: formatCurrency(resumen?.totalMes  || 0), color: "text-blue-600",    bg: "bg-blue-50"    },
            { label: "Gasto este año",  value: formatCurrency(resumen?.totalAno  || 0), color: "text-purple-600",  bg: "bg-purple-50"  },
            { label: "Total histórico", value: formatCurrency(resumen?.totalGral || 0), color: "text-gray-800",    bg: "bg-white"      },
            { label: "Período selec.",  value: formatCurrency(totalFiltrado),            color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-100 shadow-sm px-3 sm:px-4 py-3 sm:py-4`}>
              <p className={`text-base sm:text-xl font-bold ${k.color} truncate`}>{loading ? "—" : k.value}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-tight">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

          {/* ── Top categorías ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Top categorías</h3>
            {topCats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin datos aún</p>
            ) : (
              <div className="space-y-3">
                {topCats.map(([cat, monto]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5 min-w-0 mr-2">
                        <span className="shrink-0">{getCatEmoji(cat)}</span>
                        <span className="truncate">{cat}</span>
                      </span>
                      <span className="text-xs font-bold text-gray-800 whitespace-nowrap shrink-0">{formatCurrency(monto)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${(monto / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Tabla / Lista ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Filtros */}
            <div className="border-b border-gray-100">
              {/* Búsqueda + toggle filtros */}
              <div className="p-3 sm:p-4 flex gap-2 items-center">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar descripción, proveedor…"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => setFiltrosAbiertos((v) => !v)}
                  className={`sm:hidden flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors
                    ${filtrosAbiertos ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-600"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M10 12h4" />
                  </svg>
                  Filtros
                </button>
              </div>

              {/* Filtros fecha + categoría */}
              <div className={`${filtrosAbiertos ? "block" : "hidden"} sm:block px-3 sm:px-4 pb-3 sm:pb-4`}>
                <div className="flex flex-wrap gap-2 sm:gap-3 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <label className={labelCls}>Desde</label>
                    <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className={labelCls}>Hasta</label>
                    <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className={labelCls}>Categoría</label>
                    <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                      <option value="">Todas</option>
                      {CATEGORIAS.map((c) => (
                        <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Vista MOBILE: cards */}
            <div className="sm:hidden">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : gastosFiltrados.length === 0 ? (
                <div className="text-center py-14 text-gray-400 px-4">
                  <div className="text-4xl mb-2">💸</div>
                  <p className="font-medium text-gray-500">Sin gastos en este período</p>
                  <p className="text-xs mt-1">Ajusta los filtros o registra un nuevo gasto</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {gastosFiltrados.map((g) => (
                    <GastoCard key={g.id} g={g} onEdit={(g) => setModal(g)} onDelete={handleDelete} deleting={deleting} />
                  ))}
                </div>
              )}
            </div>

            {/* Vista DESKTOP: tabla */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 text-left font-semibold">Descripción</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-right font-semibold">Monto</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-12">
                      <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    </td></tr>
                  ) : gastosFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-14 text-gray-400">
                      <div className="text-4xl mb-2">💸</div>
                      <p className="font-medium text-gray-500">Sin gastos en este período</p>
                      <p className="text-xs mt-1">Ajusta los filtros o registra un nuevo gasto</p>
                    </td></tr>
                  ) : (
                    gastosFiltrados.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 text-sm">{g.descripcion}</p>
                          {g.proveedor  && <p className="text-xs text-gray-400">{g.proveedor}</p>}
                          {g.referencia && <p className="text-xs text-gray-400 font-mono">#{g.referencia}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            {getCatEmoji(g.categoria)} {g.categoria}
                          </span>
                        </td>
                        {/* ✅ FIX: formatDate ya usa parseLocalDate internamente */}
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(g.fecha)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600 whitespace-nowrap">{formatCurrency(g.monto)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setModal(g)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 transition-colors active:scale-95">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Editar
                            </button>
                            <button onClick={() => handleDelete(g)} disabled={deleting === g.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors active:scale-95 disabled:opacity-50">
                              {deleting === g.id
                                ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                              }
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {!loading && gastosFiltrados.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>{gastosFiltrados.length} gasto{gastosFiltrados.length !== 1 ? "s" : ""}</span>
                <span className="font-bold text-red-600 text-sm">{formatCurrency(totalFiltrado)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}