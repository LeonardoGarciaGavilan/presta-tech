// src/pages/SuperAdmin.jsx
import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Auditoria from "./Auditoria";

// ─── Animaciones — inyectadas una sola vez fuera del componente ───────────────
if (typeof document !== "undefined" && !document.getElementById("superadmin-styles")) {
  const s = document.createElement("style");
  s.id = "superadmin-styles";
  s.textContent = `
    @keyframes saFadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes saSlideUp { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
    @keyframes saSlideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    @keyframes saSlideLeft { from{opacity:0;transform:translateX(-100%)} to{opacity:1;transform:translateX(0)} }
  `;
  document.head.appendChild(s);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtFecha = (d) =>
  new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));

// ─── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div
      className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 sm:min-w-72 sm:w-auto z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${
        type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"
      }`}
      style={{ animation: "saSlideIn 0.25s ease" }}
    >
      {type === "success"
        ? <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        : <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      }
      {message}
      <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
};

const Spinner = () => (
  <div className="flex justify-center items-center py-16">
    <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
  </div>
);

// ─── Modal base — bottom-sheet en móvil, centrado en desktop ─────────────────
const Modal = ({ children, onClose }) => (
  <div
    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className="relative bg-[#111827] border border-white/10 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
      style={{ maxHeight: "95dvh", overflowY: "auto", animation: "saSlideUp 0.25s ease" }}
    >
      <div className="flex justify-center pt-3 sm:hidden">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, sub, icon, color = "blue" }) => {
  const colors = {
    blue:    "bg-blue-500/20 text-blue-400",
    red:     "bg-red-500/20 text-red-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    amber:   "bg-amber-500/20 text-amber-400",
  };
  return (
    <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="text-xs text-slate-400 truncate max-w-[220px]">{sub}</p>
      </div>
    </div>
  );
};

// ─── Modal Crear Empresa ──────────────────────────────────────────────────────
const ModalCrearEmpresa = ({ onConfirm, onClose, loading }) => {
  const [form, setForm] = useState({
    nombreEmpresa: "", nombreAdmin: "", emailAdmin: "",
    passwordAdmin: "", tasaInteresBase: "10", moraPorcentajeMensual: "5", diasGracia: "5",
  });
  const [errors, setErrors] = useState({});

  const iCls = (f) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white/5 text-white placeholder:text-slate-500 ${
      errors[f] ? "border-red-500/50 bg-red-500/10" : "border-white/10 focus:bg-white/10"
    }`;

  const validate = () => {
    const e = {};
    if (!form.nombreEmpresa.trim())    e.nombreEmpresa = "Requerido";
    if (!form.nombreAdmin.trim())      e.nombreAdmin   = "Requerido";
    if (!form.emailAdmin.trim())       e.emailAdmin    = "Requerido";
    if (form.passwordAdmin.length < 8) e.passwordAdmin = "Mínimo 8 caracteres";
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onConfirm({
      ...form,
      tasaInteresBase:       parseFloat(form.tasaInteresBase)       || 10,
      moraPorcentajeMensual: parseFloat(form.moraPorcentajeMensual) || 5,
      diasGracia:            parseInt(form.diasGracia)              || 5,
    });
  };

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Nueva Empresa" sub="Crea la empresa y su administrador"
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
      />
      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Empresa</p>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
          <input value={form.nombreEmpresa} onChange={e => set("nombreEmpresa", e.target.value)}
            placeholder="Préstamos García" className={iCls("nombreEmpresa")} />
          {errors.nombreEmpresa && <p className="text-red-400 text-xs mt-1">{errors.nombreEmpresa}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Administrador</p>
          <div className="space-y-3">
            {[
              { k: "nombreAdmin",   label: "Nombre completo",   ph: "Juan Pérez",          type: "text"  },
              { k: "emailAdmin",    label: "Email",             ph: "admin@empresa.com",   type: "email" },
              { k: "passwordAdmin", label: "Contraseña",        ph: "Mínimo 8 caracteres", type: "text"  },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{f.label}</label>
                <input type={f.type} value={form[f.k]} onChange={e => set(f.k, e.target.value)}
                  placeholder={f.ph} className={iCls(f.k)} />
                {errors[f.k] && <p className="text-red-400 text-xs mt-1">{errors[f.k]}</p>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Configuración inicial</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { k: "tasaInteresBase",       label: "Tasa %",      ph: "10" },
              { k: "moraPorcentajeMensual", label: "Mora %",      ph: "5"  },
              { k: "diasGracia",            label: "Días gracia", ph: "5"  },
            ].map(f => (
              <div key={f.k}>
                <label className="block text-[10px] sm:text-xs font-semibold text-slate-300 mb-1">{f.label}</label>
                <input type="number" value={form[f.k]} onChange={e => set(f.k, e.target.value)}
                  placeholder={f.ph} className={`${iCls(f.k)} text-xs sm:text-sm`} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 pb-5 flex flex-col-reverse xs:flex-row gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors">Cancelar</button>
        <button onClick={submit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors active:scale-95">
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : "Crear empresa"}
        </button>
      </div>
    </Modal>
  );
};

// ─── Modal Editar Empresa ─────────────────────────────────────────────────────
const ModalEditarEmpresa = ({ empresa, onConfirm, onClose, loading }) => {
  const [nombre, setNombre] = useState(empresa?.nombre || "");
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Editar Empresa" sub={empresa?.nombre} color="amber"
        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>}
      />
      <div className="px-5 py-4">
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nombre de la empresa</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
          className="w-full border border-white/10 rounded-xl px-3 py-2.5 text-sm bg-white/5 text-white focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-500" />
      </div>
      <div className="px-5 pb-5 flex flex-col-reverse xs:flex-row gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors">Cancelar</button>
        <button onClick={() => onConfirm(nombre)} disabled={loading || !nombre.trim()}
          className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors active:scale-95">
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : "Guardar cambios"}
        </button>
      </div>
    </Modal>
  );
};

// ─── Modal Toggle empresa ─────────────────────────────────────────────────────
const ModalToggle = ({ empresa, onConfirm, onClose, loading }) => (
  <Modal onClose={onClose}>
    <div className="p-6 text-center">
      <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${empresa?.activa ? "bg-red-500/20" : "bg-emerald-500/20"}`}>
        {empresa?.activa
          ? <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
          : <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        }
      </div>
      <h3 className="font-bold text-white text-lg">{empresa?.activa ? "¿Desactivar empresa?" : "¿Activar empresa?"}</h3>
      <p className="text-sm text-slate-400 mt-1">
        <strong className="text-white">{empresa?.nombre}</strong>
        {empresa?.activa ? " — todos sus usuarios perderán acceso." : " — sus usuarios podrán iniciar sesión."}
      </p>
      <div className="flex flex-col-reverse xs:flex-row gap-3 mt-5">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors">Cancelar</button>
        <button onClick={onConfirm} disabled={loading}
          className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors active:scale-95 ${empresa?.activa ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : empresa?.activa ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  </Modal>
);

// ─── Tarjeta empresa ──────────────────────────────────────────────────────────
const TarjetaEmpresa = ({ empresa, onEditar, onToggle, onVerUsuarios }) => {
  return (
    <div className={`bg-white/5 rounded-2xl border shadow-sm overflow-hidden ${empresa.activa ? "border-white/10" : "border-red-500/20 opacity-80"}`}>
      <div className={`px-4 sm:px-5 py-4 flex items-start justify-between gap-2 ${!empresa.activa ? "bg-red-500/5" : ""}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${empresa.activa ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>
            {empresa.nombre?.slice(0, 2).toUpperCase() || "EM"}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white truncate max-w-[150px] sm:max-w-none">{empresa.nombre}</p>
            <p className="text-xs text-slate-400">Desde {fmtFecha(empresa.createdAt)}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${empresa.activa ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${empresa.activa ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}/>
          {empresa.activa ? "Activa" : "Inactiva"}
        </span>
      </div>
      <div className="px-4 sm:px-5 py-3 border-t border-white/10 grid grid-cols-3 gap-2">
        <button onClick={() => onVerUsuarios(empresa)}
          className="py-2 rounded-xl text-xs font-bold border border-blue-500/30 text-blue-400 hover:bg-blue-500/15 transition-colors active:scale-95">
          Usuarios
        </button>
        <button onClick={() => onToggle(empresa)}
          className={`py-2 rounded-xl text-xs font-bold border transition-colors active:scale-95 ${empresa.activa ? "border-red-500/30 text-red-400 hover:bg-red-500/15" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"}`}>
          {empresa.activa ? "Desactivar" : "Activar"}
        </button>
        <button onClick={() => onEditar(empresa)}
          className="py-2 rounded-xl text-xs font-bold border border-amber-500/30 text-amber-400 hover:bg-amber-500/15 transition-colors active:scale-95">
          Editar
        </button>
      </div>
    </div>
  );
};

// ─── Vista Detalle Empresa ────────────────────────────────────────────────────
const DetalleEmpresa = ({ empresaId, onVolver }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [empresaId]);

  if (loading) return <Spinner />;
  if (!data?.empresa) return null;

  const { empresa } = data;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVolver}
          className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-slate-400 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white truncate">{empresa.nombre}</h2>
          <p className="text-xs text-slate-400">Detalle · Desde {fmtFecha(empresa.createdAt)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${empresa.activa ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${empresa.activa ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}/>
          {empresa.activa ? "Activa" : "Inactiva"}
        </span>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-sm text-slate-400">Esta empresa está registrada en el sistema.</p>
        <p className="text-xs text-slate-500 mt-2">Para gestionar usuarios y configuraciones, contacte al administrador de la empresa.</p>
      </div>
    </div>
  );
};

// ─── Vista Usuarios de Empresa ─────────────────────────────────────────────────
const UsuariosEmpresa = ({ empresaId, onVolver }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/superadmin/empresas/${empresaId}/usuarios`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [empresaId]);

  if (loading) return <Spinner />;
  if (!data?.usuarios) return null;

  const { empresa, usuarios } = data;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onVolver}
          className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-slate-400 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white truncate">Usuarios</h2>
          <p className="text-xs text-slate-400">{empresa?.nombre}</p>
        </div>
      </div>

      {usuarios?.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-sm text-slate-400">No hay usuarios en esta empresa.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="text-slate-500 uppercase tracking-wide border-b border-white/10">
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Rol</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-medium">{u.nombre}</td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.rol === 'ADMIN' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-slate-300'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.activo 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-400' : 'bg-red-400'}`}/>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fmtFecha(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Íconos nav (extraídos para reutilizar en sidebar + bottom nav) ───────────
const IcoDashboard = ({ cls = "w-4 h-4" }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>
);
const IcoEmpresas = ({ cls = "w-4 h-4" }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
  </svg>
);
const IcoLogout = ({ cls = "w-4 h-4" }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
  </svg>
);

const IcoAuditoria = ({ cls = "w-4 h-4" }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SuperAdmin() {
  const { user, logout } = useAuth();

  const [vista, setVista] = useState("dashboard");
  const [empresaDetalle, setEmpresaDetalle] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalToggle, setModalToggle] = useState(null);
  const [empresaUsuarios, setEmpresaUsuarios] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, statsRes] = await Promise.all([
        api.get("/superadmin/empresas"),
        api.get("/superadmin/estadisticas"),
      ]);
      setEmpresas(empRes.data || []);
      setEstadisticas(statsRes.data || null);
    } catch { showToast("Error al cargar datos", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const navegar = (v) => { setVista(v); setDrawerOpen(false); };

  const handleCrear = async (datos) => {
    setActionLoading(true);
    try {
      await api.post("/superadmin/empresas", datos);
      setModalCrear(false); showToast("Empresa creada correctamente"); cargar();
    } catch (err) { showToast(err.response?.data?.message ?? "Error al crear", "error"); }
    finally { setActionLoading(false); }
  };

  const handleEditar = async (nombre) => {
    setActionLoading(true);
    try {
      await api.patch(`/superadmin/empresas/${modalEditar.id}`, { nombre });
      setModalEditar(null); showToast("Empresa actualizada"); cargar();
    } catch (err) { showToast(err.response?.data?.message ?? "Error", "error"); }
    finally { setActionLoading(false); }
  };

  const handleToggle = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/superadmin/empresas/${modalToggle.id}/toggle`, { activa: !modalToggle.activa });
      setModalToggle(null); showToast(modalToggle.activa ? "Empresa desactivada" : "Empresa activada"); cargar();
    } catch (err) { showToast(err.response?.data?.message ?? "Error", "error"); }
    finally { setActionLoading(false); }
  };

  const empresasFiltradas = empresas
    .filter(e => filtro === "activas" ? e.activa : filtro === "inactivas" ? !e.activa : true)
    .filter(e => e.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  const s = estadisticas;

  const navActivo = (key) =>
    (key === "dashboard" && vista === "dashboard") ||
    (key === "empresas" && (vista === "empresas" || vista === "detalle" || vista === "usuarios")) ||
    (key === "auditoria" && vista === "auditoria");

  const NAV = [
    { key: "dashboard", label: "Dashboard", Ico: IcoDashboard },
    { key: "empresas", label: "Empresas", Ico: IcoEmpresas },
    { key: "auditoria", label: "Auditoría del Sistema", Ico: IcoAuditoria },
  ];

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
      {modalCrear && <ModalCrearEmpresa onConfirm={handleCrear} onClose={() => setModalCrear(false)} loading={actionLoading}/>}
      {modalEditar && <ModalEditarEmpresa empresa={modalEditar} onConfirm={handleEditar} onClose={() => setModalEditar(null)} loading={actionLoading}/>}
      {modalToggle && <ModalToggle empresa={modalToggle} onConfirm={handleToggle} onClose={() => setModalToggle(null)} loading={actionLoading}/>}

      <div className="min-h-screen bg-[#0f172a] text-white">
        <div className="flex h-screen overflow-hidden">

          {drawerOpen && (
            <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setDrawerOpen(false)} />
          )}

          <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-56 bg-[#0a1122] border-r border-white/8 flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${drawerOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
            <div className="px-4 py-5 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-900/50">SA</div>
                <div>
                  <p className="text-xs font-bold text-white">Panel Control</p>
                  <p className="text-[10px] text-blue-400 font-medium uppercase tracking-widest">Super Admin</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-0.5">
              {NAV.map(({ key, label, Ico }) => (
                <button key={key} onClick={() => navegar(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${navActivo(key) ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"}`}>
                  <Ico /> {label}
                </button>
              ))}
            </nav>

            <div className="px-3 pb-4 pt-3 border-t border-white/8 space-y-1">
              <div className="px-3 py-2 rounded-lg bg-white/5 mb-2">
                <p className="text-xs font-medium text-white truncate">{user?.nombre}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-all">
                <IcoLogout /> Cerrar sesión
              </button>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0a1122] border-b border-white/8 shrink-0">
              <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-[10px] font-bold">SA</div>
                <span className="text-sm font-bold text-white">Super Admin</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                {vista === "detalle" ? "Detalle" : vista === "dashboard" ? "Dashboard" : "Empresas"}
              </span>
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ animation: "saFadeUp 0.3s ease both" }}>
              {vista === "dashboard" && (
                <div className="space-y-5 sm:space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-white">Dashboard Global</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Estadísticas del sistema</p>
                  </div>

                  {loading || !s ? <Spinner /> : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                      {[
                        { l: "Total empresas", v: s.totalEmpresas, c: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                        { l: "Empresas activas", v: s.empresasActivas, c: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                        { l: "Empresas inactivas", v: s.empresasInactivas, c: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                        { l: "Total usuarios", v: s.totalUsuarios, c: "text-white", bg: "bg-white/5 border-white/10" },
                      ].map(k => (
                        <div key={k.l} className={`${k.bg} border rounded-2xl px-3 sm:px-4 py-3`}>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide leading-tight">{k.l}</p>
                          <p className={`text-lg sm:text-xl font-bold ${k.c} mt-0.5 truncate`}>{k.v ?? 0}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {vista === "empresas" && (
                <div className="space-y-4 sm:space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-bold text-white">Empresas</h1>
                      <p className="text-sm text-slate-400 mt-0.5">{empresas.length} empresa{empresas.length !== 1 ? "s" : ""} registrada{empresas.length !== 1 ? "s" : ""}</p>
                    </div>

                    <div className="flex flex-col xs:flex-row gap-2">
                      <div className="flex gap-2 flex-1">
                        <div className="relative flex-1">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
                          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…"
                            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <div className="flex rounded-xl border border-white/10 overflow-hidden shrink-0">
                          {[["todas","Todas"],["activas","Act."],["inactivas","Inact."]].map(([k,l]) => (
                            <button key={k} onClick={() => setFiltro(k)}
                              className={`px-2.5 sm:px-3 py-2 text-xs font-bold transition-colors ${filtro === k ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/8"}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setModalCrear(true)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                        Nueva empresa
                      </button>
                    </div>
                  </div>

                  {loading ? <Spinner /> : empresasFiltradas.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <div className="text-5xl mb-3">🏢</div>
                      <p className="font-medium">{busqueda ? "No se encontraron empresas" : "No hay empresas aún"}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                      {empresasFiltradas.map(empresa => (
                        <TarjetaEmpresa key={empresa.id} empresa={empresa}
                          onEditar={e => setModalEditar(e)}
                          onToggle={e => setModalToggle(e)}
                          onVerUsuarios={e => { setEmpresaUsuarios(e.id); setVista("usuarios"); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {vista === "detalle" && empresaDetalle && (
                <DetalleEmpresa empresaId={empresaDetalle} onVolver={() => { setVista("empresas"); setEmpresaDetalle(null); }} />
              )}

              {vista === "usuarios" && empresaUsuarios && (
                <UsuariosEmpresa empresaId={empresaUsuarios} onVolver={() => { setVista("empresas"); setEmpresaUsuarios(null); }} />
              )}

              {vista === "auditoria" && (
                <Auditoria />
              )}
            </main>

            <nav className="md:hidden flex border-t border-white/8 bg-[#0a1122] shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {NAV.map(({ key, label, Ico }) => (
                <button key={key} onClick={() => navegar(key)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${navActivo(key) ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
                  <Ico cls="w-5 h-5" />
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              ))}
              <button onClick={logout} className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-500 hover:text-red-400 transition-colors">
                <IcoLogout cls="w-5 h-5" />
                <span className="text-[10px] font-semibold">Salir</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
