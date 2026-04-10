import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

// ─── Animaciones — inyectadas una sola vez fuera del componente ───────────────
if (typeof document !== "undefined" && !document.getElementById("configuracion-styles")) {
  const s = document.createElement("style");
  s.id = "configuracion-styles";
  s.textContent = `
    @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(s);
}

const labelCls  = "block text-xs font-semibold text-gray-600 mb-1.5";
const inputBase = "w-full border border-gray-200 bg-gray-50 px-3 py-2.5 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent";

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div
      className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 sm:w-auto z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium
        ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn 0.25s ease" }}
    >
      <span>{type === "success" ? "✅" : "❌"}</span>
      {message}
      <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// ─── SectionCard ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, description, icon, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-4 sm:p-6">{children}</div>
  </div>
);

// ─── Input con sufijo (%, días) ───────────────────────────────────────────────
const SuffixInput = ({ name, value, onChange, placeholder, step, min, max, suffix, disabled }) => (
  <div className={`flex items-center border rounded-lg overflow-hidden transition
    ${disabled ? "opacity-60" : "focus-within:ring-2 focus-within:ring-blue-500"} border-gray-200`}>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step} min={min} max={max}
      disabled={disabled}
      className="flex-1 px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none disabled:cursor-not-allowed min-w-0"
    />
    <span className="px-3 py-2.5 bg-gray-100 text-gray-500 text-sm font-medium border-l border-gray-200 shrink-0">
      {suffix}
    </span>
  </div>
);

export default function Configuracion() {
  const { user } = useAuth();
  const isAdmin  = user?.rol === "ADMIN";

  const [form, setForm] = useState({
    tasaInteresBase:       "",
    moraPorcentajeMensual: "",
    diasGracia:            "",
    permitirAbonoCapital:  true,
    montoMinimoPrestamo:   "",
    montoMaximoPrestamo:   "",
    montoMaximoPago:       "",
  });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(null);
  const [hasConfig, setHasConfig] = useState(false);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/configuracion");
        setForm({
          tasaInteresBase:       res.data.tasaInteresBase       ?? "",
          moraPorcentajeMensual: res.data.moraPorcentajeMensual ?? "",
          diasGracia:            res.data.diasGracia            ?? 5,
          permitirAbonoCapital:  res.data.permitirAbonoCapital  ?? true,
          montoMinimoPrestamo:   res.data.montoMinimoPrestamo   ?? "",
          montoMaximoPrestamo:  res.data.montoMaximoPrestamo  ?? "",
          montoMaximoPago:      res.data.montoMaximoPago      ?? "",
        });
        setHasConfig(res.data.existe ?? false);
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.put("/configuracion", {
        tasaInteresBase:       parseFloat(form.tasaInteresBase)       || 0,
        moraPorcentajeMensual: parseFloat(form.moraPorcentajeMensual) || 0,
        diasGracia:            parseInt(form.diasGracia, 10)        || 0,
        permitirAbonoCapital:  form.permitirAbonoCapital,
        montoMinimoPrestamo:   form.montoMinimoPrestamo   ? parseFloat(form.montoMinimoPrestamo) : null,
        montoMaximoPrestamo:  form.montoMaximoPrestamo  ? parseFloat(form.montoMaximoPrestamo)  : null,
        montoMaximoPago:      form.montoMaximoPago      ? parseFloat(form.montoMaximoPago)      : null,
      });
      setHasConfig(true);
      showToast("Configuración guardada correctamente");
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al guardar", "error");
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6" style={{ animation: "fadeUp 0.3s ease both" }}>

        {/* ── Header ── */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Parámetros operativos del sistema de préstamos</p>
        </div>

        {/* ── Aviso solo lectura ── */}
        {!isAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
            <span className="text-lg shrink-0">🔒</span>
            Solo el administrador puede modificar la configuración. Estás en modo lectura.
          </div>
        )}

        {/* ── Aviso primer guardado ── */}
        {!hasConfig && isAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-blue-700">
            <span className="text-lg shrink-0">ℹ️</span>
            La configuración aún no ha sido guardada. Completa los campos y guarda para activar las reglas del sistema.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

          {/* ── Tasas e intereses ── */}
          <SectionCard
            title="Tasas e intereses"
            description="Define las tasas por defecto para nuevos préstamos"
            icon="📊"
          >
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className={labelCls}>Tasa de interés base</label>
                <SuffixInput
                  name="tasaInteresBase" value={form.tasaInteresBase} onChange={handleChange}
                  placeholder="0.00" step="0.01" min="0" max="100" suffix="%" disabled={!isAdmin}
                />
                <p className="text-xs text-gray-400 mt-1">Se usa como sugerencia al crear un préstamo</p>
              </div>
              <div>
                <label className={labelCls}>Porcentaje de mora</label>
                <SuffixInput
                  name="moraPorcentajeMensual" value={form.moraPorcentajeMensual} onChange={handleChange}
                  placeholder="0.00" step="0.01" min="0" max="100" suffix="%" disabled={!isAdmin}
                />
                <p className="text-xs text-gray-400 mt-1">Se aplica una sola vez tras los días de gracia</p>
              </div>
            </div>
          </SectionCard>

          {/* ── Reglas de mora ── */}
          <SectionCard
            title="Reglas de mora"
            description="Controla cuándo y cómo se aplica la mora"
            icon="⏱️"
          >
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className={labelCls}>Días de gracia</label>
                <SuffixInput
                  name="diasGracia" value={form.diasGracia} onChange={handleChange}
                  placeholder="5" step="1" min="0" max="30" suffix="días" disabled={!isAdmin}
                />
                <p className="text-xs text-gray-400 mt-1">Días después del vencimiento antes de aplicar mora</p>
              </div>
              <div className="flex flex-col justify-center">
                <label className={labelCls}>Abono a capital</label>
                <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${form.permitirAbonoCapital ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                  <button
                    type="button"
                    onClick={() => isAdmin && setForm((p) => ({ ...p, permitirAbonoCapital: !p.permitirAbonoCapital }))}
                    disabled={!isAdmin}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none disabled:cursor-not-allowed
                      ${form.permitirAbonoCapital ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform
                      ${form.permitirAbonoCapital ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  <div>
                    <p className={`text-xs font-semibold ${form.permitirAbonoCapital ? "text-emerald-700" : "text-gray-500"}`}>
                      {form.permitirAbonoCapital ? "Permitido" : "No permitido"}
                    </p>
                    <p className="text-xs text-gray-400">El excedente se aplica al capital</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Límites financieros ── */}
          <SectionCard
            title="Límites financieros"
            description="Controla los montos mínimos y máximos permitidos"
            icon="💰"
          >
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className={labelCls}>Monto mínimo de préstamo</label>
                <SuffixInput
                  name="montoMinimoPrestamo" value={form.montoMinimoPrestamo} onChange={handleChange}
                  placeholder="500" step="1" min="0" suffix="RD$" disabled={!isAdmin}
                />
                <p className="text-xs text-gray-400 mt-1">Monto mínimo para nuevos préstamos (dejar vacío = RD$500 por defecto)</p>
              </div>
              <div>
                <label className={labelCls}>Monto máximo de préstamo</label>
                <SuffixInput
                  name="montoMaximoPrestamo" value={form.montoMaximoPrestamo} onChange={handleChange}
                  placeholder="Sin límite" step="1" min="0" suffix="RD$" disabled={!isAdmin}
                />
                <p className="text-xs text-gray-400 mt-1">Dejar vacío para no establecer límite</p>
              </div>
              <div className="xs:col-span-2">
                <label className={labelCls}>Monto máximo por pago</label>
                <SuffixInput
                  name="montoMaximoPago" value={form.montoMaximoPago} onChange={handleChange}
                  placeholder="Sin límite" step="1" min="0" suffix="RD$" disabled={!isAdmin}
                />
                <p className="text-xs text-gray-400 mt-1">Límite por transacción de pago (dejar vacío para no establecer límite)</p>
              </div>
            </div>
          </SectionCard>

          {/* ── Resumen visual — 2×2 móvil, 4 cols desktop ── */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">Resumen de configuración actual</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: "Tasa base",     value: `${form.tasaInteresBase || 0}%`     },
                { label: "Mora",          value: `${form.moraPorcentajeMensual || 0}%` },
                { label: "Días gracia",   value: `${form.diasGracia || 0} días`       },
                { label: "Abono capital", value: form.permitirAbonoCapital ? "Sí" : "No" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-xs opacity-70">{label}</p>
                  <p className="text-base font-bold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Botón guardar — ancho completo en móvil ── */}
          {isAdmin && (
            <div className="flex justify-stretch sm:justify-end">
              <button
                type="submit" disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                }
                {saving ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}