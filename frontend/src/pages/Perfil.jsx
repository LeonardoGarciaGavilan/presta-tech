import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

// ─── Animaciones — inyectadas una sola vez fuera del componente ───────────────
if (typeof document !== "undefined" && !document.getElementById("perfil-styles")) {
  const s = document.createElement("style");
  s.id = "perfil-styles";
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
    <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
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

// ─── Ícono ojo ────────────────────────────────────────────────────────────────
const EyeIcon = ({ show }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {show
      ? <><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></>
      : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
    }
  </svg>
);

// ─── Input contraseña ─────────────────────────────────────────────────────────
const PwInput = ({ value, onChange, placeholder, showKey, showPw, setShowPw }) => (
  <div className="relative">
    <input
      type={showPw[showKey] ? "text" : "password"}
      value={value} onChange={onChange} placeholder={placeholder}
      className={`${inputBase} pr-10`}
    />
    <button
      type="button"
      onClick={() => setShowPw((p) => ({ ...p, [showKey]: !p[showKey] }))}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
    >
      <EyeIcon show={showPw[showKey]} />
    </button>
  </div>
);

// ─── Botón guardar reutilizable ───────────────────────────────────────────────
const SaveBtn = ({ saving, label = "Guardar cambios" }) => (
  <button
    type="submit" disabled={saving}
    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60"
  >
    {saving
      ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    }
    {saving ? "Guardando…" : label}
  </button>
);

const ROL_BADGE = {
  ADMIN:    { label: "Administrador", classes: "bg-blue-100 text-blue-700 border-blue-200"  },
  EMPLEADO: { label: "Empleado",      classes: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function Perfil() {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.rol === "ADMIN";

  const [perfil,  setPerfil]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [savingNombre,  setSavingNombre]  = useState(false);

  const [pwForm,   setPwForm]   = useState({ passwordActual: "", passwordNuevo: "", confirmar: "" });
  const [pwError,  setPwError]  = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [showPw,   setShowPw]   = useState({ actual: false, nuevo: false, confirmar: false });

  const [nombreEmpresa,  setNombreEmpresa]  = useState("");
  const [savingEmpresa,  setSavingEmpresa]  = useState(false);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/perfil");
        setPerfil(res.data);
        setNombreUsuario(res.data.usuario.nombre || "");
        setNombreEmpresa(res.data.empresa.nombre || "");
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleGuardarNombre = async (e) => {
    e.preventDefault();
    setSavingNombre(true);
    try {
      await api.put("/perfil", { nombre: nombreUsuario });
      showToast("Nombre actualizado correctamente");
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al actualizar", "error");
    } finally { setSavingNombre(false); }
  };

  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pwForm.passwordNuevo !== pwForm.confirmar)   { setPwError("Las contraseñas no coinciden"); return; }
    if (pwForm.passwordNuevo.length < 6)             { setPwError("La nueva contraseña debe tener al menos 6 caracteres"); return; }
    setSavingPw(true);
    try {
      await api.patch("/perfil/password", {
        passwordActual: pwForm.passwordActual,
        passwordNuevo:  pwForm.passwordNuevo,
      });
      showToast("Contraseña cambiada correctamente");
      setPwForm({ passwordActual: "", passwordNuevo: "", confirmar: "" });
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al cambiar contraseña", "error");
    } finally { setSavingPw(false); }
  };

  const handleGuardarEmpresa = async (e) => {
    e.preventDefault();
    setSavingEmpresa(true);
    try {
      await api.put("/perfil/empresa", { nombre: nombreEmpresa });
      showToast("Nombre de empresa actualizado");
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al actualizar", "error");
    } finally { setSavingEmpresa(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const rolCfg = ROL_BADGE[authUser?.rol] ?? ROL_BADGE.EMPLEADO;

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>

        {/* ── Hero / Avatar ── */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-6 text-white">
          <div className="flex items-center gap-4">
            {/* Avatar — inicial del nombre */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-xl sm:text-2xl font-bold shrink-0 select-none">
              {(perfil?.usuario?.nombre || authUser?.email || "U")[0].toUpperCase()}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-base sm:text-lg font-bold truncate">{perfil?.usuario?.nombre || "Sin nombre"}</p>
              <p className="text-xs sm:text-sm text-blue-200 truncate">{perfil?.usuario?.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${rolCfg.classes}`}>
                  {rolCfg.label}
                </span>
                {perfil?.empresa?.nombre && (
                  <span className="text-xs text-blue-300 truncate max-w-[180px]">{perfil.empresa.nombre}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Información personal ── */}
        <SectionCard title="Información personal" description="Tu nombre visible en el sistema y recibos" icon="👤">
          <form onSubmit={handleGuardarNombre} className="space-y-4">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className={labelCls}>Nombre</label>
                <input type="text" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)}
                  placeholder="Tu nombre" className={inputBase} />
              </div>
              <div>
                <label className={labelCls}>Correo electrónico</label>
                <input type="email" value={perfil?.usuario?.email || ""} disabled
                  className={`${inputBase} opacity-60 cursor-not-allowed`} />
                <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
              </div>
            </div>
            <div className="flex justify-stretch sm:justify-end">
              <SaveBtn saving={savingNombre} label="Actualizar nombre" />
            </div>
          </form>
        </SectionCard>

        {/* ── Seguridad ── */}
        <SectionCard title="Seguridad" description="Cambia tu contraseña de acceso" icon="🔐">
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            {/* Contraseña actual — ancho completo */}
            <div>
              <label className={labelCls}>Contraseña actual</label>
              <PwInput
                value={pwForm.passwordActual}
                onChange={(e) => setPwForm((p) => ({ ...p, passwordActual: e.target.value }))}
                placeholder="••••••••" showKey="actual" showPw={showPw} setShowPw={setShowPw}
              />
            </div>
            {/* Nueva + confirmar — 2 cols en xs+ */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className={labelCls}>Nueva contraseña</label>
                <PwInput
                  value={pwForm.passwordNuevo}
                  onChange={(e) => setPwForm((p) => ({ ...p, passwordNuevo: e.target.value }))}
                  placeholder="Mín. 6 caracteres" showKey="nuevo" showPw={showPw} setShowPw={setShowPw}
                />
              </div>
              <div>
                <label className={labelCls}>Confirmar contraseña</label>
                <PwInput
                  value={pwForm.confirmar}
                  onChange={(e) => setPwForm((p) => ({ ...p, confirmar: e.target.value }))}
                  placeholder="Repite la contraseña" showKey="confirmar" showPw={showPw} setShowPw={setShowPw}
                />
              </div>
            </div>
            {pwError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {pwError}</p>
            )}
            <div className="flex justify-stretch sm:justify-end">
              <SaveBtn saving={savingPw} label="Cambiar contraseña" />
            </div>
          </form>
        </SectionCard>

        {/* ── Empresa — solo ADMIN ── */}
        {isAdmin && (
          <SectionCard title="Datos de la empresa" description="Solo el administrador puede modificar estos datos" icon="🏢">
            <form onSubmit={handleGuardarEmpresa} className="space-y-4">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className={labelCls}>Nombre de la empresa</label>
                  <input type="text" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)}
                    placeholder="Nombre de tu empresa" className={inputBase} />
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <div className={`px-3 py-2.5 rounded-lg text-sm border font-medium ${
                    perfil?.empresa?.activa
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {perfil?.empresa?.activa ? "✅ Empresa activa" : "❌ Empresa inactiva"}
                  </div>
                </div>
              </div>
              <div className="flex justify-stretch sm:justify-end">
                <SaveBtn saving={savingEmpresa} label="Actualizar empresa" />
              </div>
            </form>
          </SectionCard>
        )}

        {/* ── Info de cuenta ── */}
        <div className="bg-gray-50 rounded-2xl border border-gray-100 px-4 sm:px-5 py-4">
          <div className="flex flex-col xs:flex-row xs:flex-wrap gap-2 xs:gap-4 text-xs text-gray-400">
            <span>
              ID: <code className="font-mono text-gray-600">{perfil?.usuario?.id?.slice(0, 8)}…</code>
            </span>
            <span>
              Rol: <strong className="text-gray-600">{rolCfg.label}</strong>
            </span>
            <span>
              Cuenta creada:{" "}
              <strong className="text-gray-600">
                {new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" })
                  .format(new Date(perfil?.usuario?.createdAt || Date.now()))}
              </strong>
            </span>
          </div>
        </div>

      </div>
    </>
  );
}