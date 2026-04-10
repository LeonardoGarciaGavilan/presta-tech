import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

// ─── Animaciones — inyectadas una sola vez fuera del componente ───────────────
if (typeof document !== "undefined" && !document.getElementById("usuarios-styles")) {
  const s = document.createElement("style");
  s.id = "usuarios-styles";
  s.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    .pb-safe { padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); }
  `;
  document.head.appendChild(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => d
  ? new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d))
  : "—";

const ROL_CFG = {
  ADMIN:    { label: "Admin",    classes: "bg-blue-100 text-blue-700 border-blue-200"  },
  EMPLEADO: { label: "Empleado", classes: "bg-gray-100 text-gray-600 border-gray-200" },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div
      className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 sm:min-w-72 sm:w-auto z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium
        ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn 0.25s ease" }}
    >
      {type === "success" ? "✅" : "❌"} {message}
      <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

// ─── Modal base (bottom-sheet móvil / centrado desktop) ───────────────────────
const Modal = ({ title, onClose, children }) => (
  <div
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
      style={{ animation: "slideUp 0.25s ease", maxHeight: "95dvh", overflowY: "auto" }}
    >
      <div className="flex justify-center pt-3 sm:hidden">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-5 pb-safe">{children}</div>
    </div>
  </div>
);

const inputCls = "w-full border border-gray-200 bg-gray-50 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";

// ─── Tarjeta móvil de usuario ─────────────────────────────────────────────────
function UsuarioCard({ u, authUser, onEditar, onReset, onToggle }) {
  const rolCfg = ROL_CFG[u.rol] ?? ROL_CFG.EMPLEADO;
  const esYo   = u.id === authUser?.id;
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3 ${!u.activo ? "opacity-60" : ""}`}>
      {/* Cabecera */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border
          ${u.activo ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
          {u.nombre?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">
            {u.nombre}
            {esYo && <span className="ml-1.5 text-xs font-normal text-blue-500">(tú)</span>}
          </p>
          <p className="text-xs text-gray-400 truncate">{u.email}</p>
          <p className="text-xs text-gray-300 mt-0.5">Creado: {formatDate(u.createdAt)}</p>
        </div>
      </div>
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rolCfg.classes}`}>{rolCfg.label}</span>
        <button
          onClick={() => onToggle(u)} disabled={esYo}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all disabled:cursor-not-allowed
            ${u.activo
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-emerald-500" : "bg-gray-400"}`} />
          {u.activo ? "Activo" : "Inactivo"}
        </button>
        {u.debeCambiarPassword && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⏳ Temporal</span>
        )}
      </div>
      {/* Acciones */}
      <div className="flex gap-2 pt-1 border-t border-gray-50">
        <button onClick={() => onEditar(u)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors active:scale-95">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>
        <button onClick={() => onReset(u)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors active:scale-95">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Contraseña
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Usuarios() {
  const { user: authUser } = useAuth();

  const [usuarios,        setUsuarios]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [toast,           setToast]           = useState(null);
  const [busqueda,        setBusqueda]        = useState("");
  const [filtroRol,       setFiltroRol]       = useState("TODOS");
  const [filtroEst,       setFiltroEst]       = useState("TODOS");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const [modalCrear,  setModalCrear]  = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalReset,  setModalReset]  = useState(null);
  const [resetResult, setResetResult] = useState(null);

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  useEffect(() => { fetchUsuarios(); }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try { const res = await api.get("/usuarios"); setUsuarios(res.data); }
    catch { showToast("Error al cargar usuarios", "error"); }
    finally { setLoading(false); }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const txt      = busqueda.toLowerCase();
    const matchTxt = !txt || u.nombre?.toLowerCase().includes(txt) || u.email?.toLowerCase().includes(txt);
    const matchRol = filtroRol === "TODOS" || u.rol === filtroRol;
    const matchEst = filtroEst === "TODOS" || (filtroEst === "ACTIVO" ? u.activo : !u.activo);
    return matchTxt && matchRol && matchEst;
  });

  const hayFiltrosActivos = filtroRol !== "TODOS" || filtroEst !== "TODOS";
  const limpiarFiltros    = () => { setFiltroRol("TODOS"); setFiltroEst("TODOS"); };

  // ─── Crear ────────────────────────────────────────────────────────────────
  const [crearForm,    setCrearForm]    = useState({ nombre: "", email: "", rol: "EMPLEADO" });
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearResult,  setCrearResult]  = useState(null);

  const handleCrear = async (e) => {
    e.preventDefault();
    setCrearLoading(true);
    try {
      const res = await api.post("/usuarios", crearForm);
      setCrearResult(res.data);
      fetchUsuarios();
    } catch (err) {
      const msg = err.response?.data?.message;
      showToast(Array.isArray(msg) ? msg[0] : msg ?? "Error al crear usuario", "error");
    } finally { setCrearLoading(false); }
  };

  const cerrarModalCrear = () => {
    setModalCrear(false);
    setCrearForm({ nombre: "", email: "", rol: "EMPLEADO" });
    setCrearResult(null);
  };

  // ─── Editar ───────────────────────────────────────────────────────────────
  const [editarForm,    setEditarForm]    = useState({ nombre: "", rol: "EMPLEADO", activo: true });
  const [editarLoading, setEditarLoading] = useState(false);

  const abrirEditar = (u) => { setEditarForm({ nombre: u.nombre, rol: u.rol, activo: u.activo }); setModalEditar(u); };

  const handleEditar = async (e) => {
    e.preventDefault();
    setEditarLoading(true);
    try {
      await api.put(`/usuarios/${modalEditar.id}`, editarForm);
      showToast("Usuario actualizado correctamente");
      fetchUsuarios();
      setModalEditar(null);
    } catch (err) {
      const msg = err.response?.data?.message;
      showToast(Array.isArray(msg) ? msg[0] : msg ?? "Error al actualizar", "error");
    } finally { setEditarLoading(false); }
  };

  // ─── Toggle activo ────────────────────────────────────────────────────────
  const handleToggleActivo = async (u) => {
    if (u.id === authUser?.id) { showToast("No puedes desactivar tu propia cuenta", "error"); return; }
    try {
      await api.put(`/usuarios/${u.id}`, { activo: !u.activo });
      showToast(`Usuario ${!u.activo ? "activado" : "desactivado"} correctamente`);
      fetchUsuarios();
    } catch (err) { showToast(err.response?.data?.message ?? "Error al actualizar", "error"); }
  };

  // ─── Reset password ───────────────────────────────────────────────────────
  const [resetLoading, setResetLoading] = useState(false);

  const handleReset = async () => {
    setResetLoading(true);
    try {
      const res = await api.patch(`/usuarios/${modalReset.id}/reset-password`);
      setResetResult(res.data);
      fetchUsuarios();
    } catch (err) {
      showToast(err.response?.data?.message ?? "Error al resetear contraseña", "error");
      setModalReset(null);
    } finally { setResetLoading(false); }
  };

  const cerrarReset = () => { setModalReset(null); setResetResult(null); };

  const totalActivos = usuarios.filter((u) => u.activo).length;
  const totalAdmins  = usuarios.filter((u) => u.rol === "ADMIN").length;

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Gestiona el acceso al sistema</p>
          </div>
          <button onClick={() => setModalCrear(true)}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline">Nuevo usuario</span>
            <span className="xs:hidden">Nuevo</span>
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: "Total",   value: usuarios.length, color: "text-gray-800",    bg: "bg-white"      },
            { label: "Activos", value: totalActivos,    color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Admins",  value: totalAdmins,     color: "text-blue-600",    bg: "bg-blue-50"    },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl border border-gray-100 shadow-sm px-3 sm:px-5 py-3 sm:py-4`}>
              <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o correo…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition" />
            </div>
            {/* Botón filtros — solo móvil, con punto rojo si hay filtros activos */}
            <button onClick={() => setFiltrosAbiertos((v) => !v)}
              className={`sm:hidden relative flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors shrink-0
                ${filtrosAbiertos || hayFiltrosActivos ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M10 12h4" />
              </svg>
              Filtros
              {/* Punto rojo cuando hay filtros activos y panel cerrado */}
              {hayFiltrosActivos && !filtrosAbiertos && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-white" />
              )}
            </button>
          </div>

          {/* Selects + limpiar — colapsables en móvil */}
          <div className={`${filtrosAbiertos ? "flex" : "hidden"} sm:flex flex-wrap gap-2 sm:gap-3 mt-2 sm:mt-3`}>
            <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}
              className="flex-1 min-w-[130px] border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
              <option value="TODOS">Todos los roles</option>
              <option value="ADMIN">Admin</option>
              <option value="EMPLEADO">Empleado</option>
            </select>
            <select value={filtroEst} onChange={(e) => setFiltroEst(e.target.value)}
              className="flex-1 min-w-[130px] border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
            {hayFiltrosActivos && (
              <button onClick={limpiarFiltros}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap">
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>

        {/* ── Vista MOBILE: cards ── */}
        <div className="sm:hidden space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="font-medium">No se encontraron usuarios</p>
              {(busqueda || hayFiltrosActivos) && (
                <button onClick={() => { setBusqueda(""); limpiarFiltros(); }} className="mt-3 text-xs text-blue-600 hover:underline">
                  Limpiar búsqueda y filtros
                </button>
              )}
            </div>
          ) : usuariosFiltrados.map((u) => (
            <UsuarioCard key={u.id} u={u} authUser={authUser}
              onEditar={abrirEditar} onReset={(u) => setModalReset(u)} onToggle={handleToggleActivo} />
          ))}
        </div>

        {/* ── Vista DESKTOP: tabla ── */}
        <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">👥</div>
              <p className="font-medium">No se encontraron usuarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-3 text-left font-semibold">Usuario</th>
                    <th className="px-5 py-3 text-left font-semibold">Rol</th>
                    <th className="px-5 py-3 text-left font-semibold">Estado</th>
                    <th className="px-5 py-3 text-left font-semibold">Contraseña</th>
                    <th className="px-5 py-3 text-left font-semibold">Creado</th>
                    <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {usuariosFiltrados.map((u) => {
                    const rolCfg = ROL_CFG[u.rol] ?? ROL_CFG.EMPLEADO;
                    const esYo   = u.id === authUser?.id;
                    return (
                      <tr key={u.id} className={`hover:bg-gray-50/60 transition-colors ${!u.activo ? "opacity-60" : ""}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border
                              ${u.activo ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                              {u.nombre?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">
                                {u.nombre}
                                {esYo && <span className="ml-1.5 text-xs font-normal text-blue-500">(tú)</span>}
                              </p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rolCfg.classes}`}>{rolCfg.label}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => handleToggleActivo(u)} disabled={esYo}
                            title={esYo ? "No puedes desactivarte a ti mismo" : u.activo ? "Clic para desactivar" : "Clic para activar"}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all disabled:cursor-not-allowed
                              ${u.activo
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-emerald-500" : "bg-gray-400"}`} />
                            {u.activo ? "Activo" : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.debeCambiarPassword
                            ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⏳ Temporal</span>
                            : <span className="text-xs text-gray-400">Configurada</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => abrirEditar(u)} title="Editar"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setModalReset(u)} title="Resetear contraseña"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && usuariosFiltrados.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>{usuariosFiltrados.length} usuario{usuariosFiltrados.length !== 1 ? "s" : ""}</span>
              {hayFiltrosActivos && (
                <button onClick={limpiarFiltros} className="text-blue-500 hover:underline">Limpiar filtros</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal crear ── */}
      {modalCrear && (
        <Modal title="Nuevo usuario" onClose={cerrarModalCrear}>
          {crearResult ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-bold text-gray-800">Usuario creado exitosamente</p>
                <p className="text-sm text-gray-500 mt-1">{crearResult.nombre} · {crearResult.email}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚠️ Contraseña temporal</p>
                <p className="text-2xl font-bold text-amber-800 font-mono text-center tracking-widest py-2">{crearResult.passwordTemporal}</p>
                <p className="text-xs text-amber-600 text-center mt-1">El usuario deberá cambiarla en su primer inicio de sesión</p>
              </div>
              <button onClick={cerrarModalCrear} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all active:scale-95">Entendido</button>
            </div>
          ) : (
            <form onSubmit={handleCrear} className="space-y-4">
              <div>
                <label className={labelCls}>Nombre completo</label>
                <input type="text" value={crearForm.nombre} onChange={(e) => setCrearForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Juan Pérez" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Correo electrónico</label>
                <input type="email" value={crearForm.email} onChange={(e) => setCrearForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@empresa.com" required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Rol</label>
                <select value={crearForm.rol} onChange={(e) => setCrearForm((p) => ({ ...p, rol: e.target.value }))} className={inputCls}>
                  <option value="EMPLEADO">Empleado</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {crearForm.rol === "ADMIN" ? "⚠️ El admin tiene acceso total al sistema" : "El empleado puede registrar pagos, clientes y préstamos"}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                <strong>ℹ️ Contraseña temporal:</strong> Se asignará automáticamente. El usuario deberá cambiarla en su primer acceso.
              </div>
              <div className="flex flex-col-reverse xs:flex-row gap-2 pt-1">
                <button type="button" onClick={cerrarModalCrear} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                <button type="submit" disabled={crearLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                  {crearLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Crear usuario"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ── Modal editar ── */}
      {modalEditar && (
        <Modal title={`Editar — ${modalEditar.nombre}`} onClose={() => setModalEditar(null)}>
          <form onSubmit={handleEditar} className="space-y-4">
            <div>
              <label className={labelCls}>Nombre completo</label>
              <input type="text" value={editarForm.nombre} onChange={(e) => setEditarForm((p) => ({ ...p, nombre: e.target.value }))} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rol</label>
              <select value={editarForm.rol} onChange={(e) => setEditarForm((p) => ({ ...p, rol: e.target.value }))} className={inputCls}>
                <option value="EMPLEADO">Empleado</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado de la cuenta</label>
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button key={String(val)} type="button"
                    onClick={() => setEditarForm((p) => ({ ...p, activo: val }))}
                    disabled={modalEditar.id === authUser?.id && val === false}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95
                      ${editarForm.activo === val
                        ? val ? "bg-emerald-600 text-white border-emerald-600" : "bg-red-500 text-white border-red-500"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                    {val ? "✅ Activo" : "🚫 Inactivo"}
                  </button>
                ))}
              </div>
              {modalEditar.id === authUser?.id && <p className="text-xs text-amber-600 mt-1">No puedes desactivar tu propia cuenta</p>}
            </div>
            <div className="flex flex-col-reverse xs:flex-row gap-2 pt-1">
              <button type="button" onClick={() => setModalEditar(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
              <button type="submit" disabled={editarLoading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                {editarLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal reset ── */}
      {modalReset && (
        <Modal title="Resetear contraseña" onClose={cerrarReset}>
          {resetResult ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-2">🔑</div>
                <p className="font-bold text-gray-800">Contraseña restablecida</p>
                <p className="text-sm text-gray-500 mt-1">{modalReset.nombre}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Nueva contraseña temporal</p>
                <p className="text-2xl font-bold text-amber-800 font-mono text-center tracking-widest py-2">{resetResult.passwordTemporal}</p>
                <p className="text-xs text-amber-600 text-center mt-1">El usuario deberá cambiarla en su próximo inicio de sesión</p>
              </div>
              <button onClick={cerrarReset} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all active:scale-95">Entendido</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <p className="font-semibold mb-1">⚠️ ¿Resetear contraseña de <strong>{modalReset.nombre}</strong>?</p>
                <p className="text-xs text-red-600">Se asignará una contraseña temporal y el usuario deberá cambiarla en su próximo acceso.</p>
              </div>
              <div className="flex flex-col-reverse xs:flex-row gap-2">
                <button onClick={cerrarReset} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">Cancelar</button>
                <button onClick={handleReset} disabled={resetLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95">
                  {resetLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Sí, resetear"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}