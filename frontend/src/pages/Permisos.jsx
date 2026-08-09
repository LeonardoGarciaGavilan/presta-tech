import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../services/api";

// ─── Animaciones — inyectadas una sola vez fuera del componente ───────────────
if (
  typeof document !== "undefined" &&
  !document.getElementById("permisos-styles")
) {
  const s = document.createElement("style");
  s.id = "permisos-styles";
  s.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    .pb-safe { padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); }
  `;
  document.head.appendChild(s);
}

const MODULO_LABELS = {
  DASHBOARD: "Panel",
  CLIENTES: "Clientes",
  PRESTAMOS: "Préstamos",
  PAGOS: "Pagos",
  CAJA: "Caja",
  RUTAS: "Rutas",
  REPORTES: "Reportes",
  GASTOS: "Gastos",
  FINANZAS: "Finanzas",
  EMPLEADOS: "Empleados",
  USUARIOS: "Usuarios",
  CONFIGURACION: "Configuración",
  AUDITORIA: "Auditoría",
  ALERTAS: "Alertas",
  SYNC: "Sincronización",
};

const PERMISO_LABELS = {
  "dashboard:ver": "Ver panel",
  "clientes:ver": "Ver clientes",
  "clientes:crear": "Crear clientes",
  "clientes:editar": "Editar clientes",
  "clientes:desactivar": "Desactivar clientes",
  "prestamos:ver": "Ver préstamos",
  "prestamos:crear": "Crear préstamos",
  "prestamos:editar": "Editar préstamos",
  "prestamos:revisar": "Revisar solicitudes",
  "prestamos:aprobar": "Aprobar préstamos",
  "prestamos:desembolsar": "Desembolsar préstamos",
  "prestamos:refinanciar": "Refinanciar préstamos",
  "prestamos:cancelar": "Cancelar préstamos",
  "pagos:ver": "Ver pagos",
  "pagos:registrar": "Registrar pagos",
  "pagos:revertir": "Revertir pagos",
  "caja:ver": "Ver caja",
  "caja:abrir": "Abrir caja",
  "caja:cerrar": "Cerrar caja",
  "caja:ajuste": "Ajustes de caja",
  "rutas:ver": "Ver rutas",
  "rutas:crear": "Crear rutas",
  "rutas:asignar": "Asignar clientes a rutas",
  "rutas:eliminar": "Eliminar rutas",
  "rutas:marcarVisita": "Marcar visitas",
  "reportes:ver": "Ver reportes",
  "reportes:exportar": "Exportar reportes",
  "gastos:ver": "Ver gastos",
  "gastos:crear": "Registrar gastos",
  "gastos:editar": "Editar gastos",
  "gastos:eliminar": "Eliminar gastos",
  "finanzas:ver": "Ver finanzas",
  "finanzas:inyeccionCapital": "Inyección de capital",
  "finanzas:retiroGanancias": "Retiro de ganancias",
  "empleados:ver": "Ver empleados",
  "empleados:gestionar": "Gestionar empleados",
  "empleados:asistencia": "Gestionar asistencia",
  "empleados:pagosSalario": "Pagos de salario",
  "usuarios:ver": "Ver usuarios",
  "usuarios:gestionar": "Gestionar usuarios",
  "usuarios:resetPassword": "Resetear contraseñas",
  "configuracion:ver": "Ver configuración",
  "configuracion:editar": "Editar configuración",
  "auditoria:ver": "Ver auditoría",
  "alertas:ver": "Ver alertas",
  "alertas:gestionar": "Gestionar alertas",
};

const ROL_LABEL = { ADMIN: "Admin", EMPLEADO: "Empleado" };
const ROL_BADGE = {
  ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
  EMPLEADO: "bg-gray-100 text-gray-600 border-gray-200",
};

const moduloDePermiso = (p) => p.split(":")[0];

// 0 = por defecto, 1 = permitir, 2 = denegar
function FilaPermiso({ permiso, estado, onChange }) {
  const label = PERMISO_LABELS[permiso] ?? permiso;
  const opciones = [
    { val: 0, label: "Por defecto" },
    { val: 1, label: "Permitir" },
    { val: 2, label: "Denegar" },
  ];
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
        <p className="text-xs text-gray-400 font-mono">{permiso}</p>
      </div>
      <div className="flex shrink-0 rounded-lg border border-gray-200 overflow-hidden">
        {opciones.map(({ val, label: l }) => (
          <button
            key={val}
            type="button"
            data-on={estado === val}
            onClick={() => onChange(val)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-500 data-[on=true]:text-white transition-colors ${val === 1 ? "data-[on=true]:bg-emerald-600" : val === 2 ? "data-[on=true]:bg-red-500" : "data-[on=true]:bg-gray-600"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 sm:min-w-72 sm:w-auto z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium
        ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ animation: "slideIn 0.25s ease" }}
    >
      {type === "success" ? "✅" : "❌"} {message}
      <button
        onClick={onClose}
        className="ml-auto opacity-50 hover:opacity-100 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
};

export default function Permisos() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const [usuario, setUsuario] = useState(null);
  const [base, setBase] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [estados, setEstados] = useState({});

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  useEffect(() => {
    let activo = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/usuarios/${id}/permisos`);
        if (!activo) return;
        const { usuario: u, base: b, catalogo, modulos } = res.data;

        const inicial = {};
        for (const p of catalogo) {
          if ((u.permisos ?? []).includes(p)) inicial[p] = 1;
          else if ((u.permisosNegados ?? []).includes(p)) inicial[p] = 2;
          else inicial[p] = 0;
        }
        setEstados(inicial);

        const gruposOrdenados = modulos
          .map((mod) => ({
            mod,
            label: MODULO_LABELS[mod] ?? mod,
            permisos: catalogo.filter((p) => moduloDePermiso(p) === mod),
          }))
          .filter((g) => g.permisos.length > 0);

        setUsuario(u);
        setBase(b);
        setGrupos(gruposOrdenados);
      } catch (err) {
        if (activo)
          setError(
            err.response?.data?.message ??
              "No se pudo cargar la configuración de permisos",
          );
      } finally {
        if (activo) setLoading(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [id]);

  const stats = useMemo(() => {
    const vals = Object.values(estados);
    return {
      permitidos: vals.filter((v) => v === 1).length,
      denegados: vals.filter((v) => v === 2).length,
    };
  }, [estados]);

  const efectivo = (permiso) => {
    const s = estados[permiso];
    if (s === 1) return true;
    if (s === 2) return false;
    return base.includes(permiso);
  };

  const totalCambios = useMemo(
    () => Object.keys(estados).filter((p) => estados[p] !== 0).length,
    [estados],
  );

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const permisos = Object.entries(estados)
        .filter(([, v]) => v === 1)
        .map(([p]) => p);
      const permisosNegados = Object.entries(estados)
        .filter(([, v]) => v === 2)
        .map(([p]) => p);
      const res = await api.put(`/usuarios/${id}/permisos`, {
        permisos,
        permisosNegados,
      });
      showToast(res.data?.mensaje ?? "Permisos actualizados correctamente");
      navigate("/usuarios");
    } catch (err) {
      const msg = err.response?.data?.message;
      showToast(
        Array.isArray(msg) ? msg[0] : (msg ?? "Error al guardar permisos"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !usuario) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <div className="text-4xl mb-3">🔒</div>
        <p className="font-medium text-gray-500">
          {error ?? "Usuario no encontrado"}
        </p>
        <Link
          to="/usuarios"
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          ← Volver a usuarios
        </Link>
      </div>
    );
  }

  const badgeCls = ROL_BADGE[usuario.rol] ?? ROL_BADGE.EMPLEADO;

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div
        className="space-y-4 sm:space-y-5"
        style={{ animation: "fadeUp 0.3s ease both" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              to="/usuarios"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline mb-1"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Volver a usuarios
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              Permisos
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeCls}`}
              >
                {ROL_LABEL[usuario.rol] ?? usuario.rol}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
              {usuario.nombre} · {usuario.email}
            </p>
          </div>
          <button
            onClick={handleGuardar}
            disabled={saving || totalCambios === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-all active:scale-95 whitespace-nowrap"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "💾"
            )}
            Guardar
          </button>
        </div>

        {/* ── Resumen ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 sm:px-5 py-3 sm:py-4">
            <p className="text-xl sm:text-2xl font-bold text-gray-800">
              {Object.keys(estados).length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Permisos totales</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm px-3 sm:px-5 py-3 sm:py-4">
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">
              {stats.permitidos}
            </p>
            <p className="text-xs text-emerald-600/70 mt-0.5">Permitidos</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-100 shadow-sm px-3 sm:px-5 py-3 sm:py-4">
            <p className="text-xl sm:text-2xl font-bold text-red-500">
              {stats.denegados}
            </p>
            <p className="text-xs text-red-500/70 mt-0.5">Denegados</p>
          </div>
        </div>

        {/* ── Info tri-estado ── */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
          <strong>ℹ️ Cómo funciona:</strong> “Por defecto” usa lo que ya le
          corresponde al rol (
          <span className="font-mono">
            {ROL_LABEL[usuario.rol] ?? usuario.rol}
          </span>
          ). Usa{" "}
          <span className="font-semibold text-emerald-700">Permitir</span> para
          dar acceso adicional y
          <span className="font-semibold text-red-600"> Denegar</span> para
          quitárselo explícitamente.
        </div>

        {/* ── Matriz por módulo ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {grupos.map(({ mod, label, permisos }) => (
            <div key={mod} className="px-4 sm:px-5 py-1">
              <div className="flex items-center gap-2 pt-4 pb-1 border-b border-gray-100">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  {label}
                </span>
                <span className="text-[10px] text-gray-300 font-mono">
                  {mod}
                </span>
                <span className="ml-auto text-[11px] text-gray-400">
                  {permisos.filter((p) => efectivo(p)).length}/{permisos.length}{" "}
                  activos
                </span>
              </div>
              <div>
                {permisos.map((p) => {
                  const act = efectivo(p);
                  return (
                    <div key={p}>
                      <FilaPermiso
                        permiso={p}
                        estado={estados[p]}
                        onChange={(v) =>
                          setEstados((prev) => ({ ...prev, [p]: v }))
                        }
                      />
                      <div className="-mt-2.5 mb-2 pl-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                          ${
                            estados[p] === 1
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : estados[p] === 2
                                ? "bg-red-50 text-red-600 border-red-200"
                                : act
                                  ? "bg-gray-50 text-gray-500 border-gray-200"
                                  : "bg-gray-50 text-gray-400 border-gray-200"
                          }`}
                        >
                          {estados[p] === 1
                            ? "✅ Acceso extra"
                            : estados[p] === 2
                              ? "🚫 Bloqueado"
                              : act
                                ? "✓ Activo por rol"
                                : "— Apagado"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Botón guardar (móvil, sticky inferior) ── */}
        <div className="sm:hidden pb-safe">
          <button
            onClick={handleGuardar}
            disabled={saving || totalCambios === 0}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "💾"
            )}
            Guardar permisos ({totalCambios} cambio
            {totalCambios !== 1 ? "s" : ""})
          </button>
        </div>
      </div>
    </>
  );
}
