// src/pages/Empleados.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n);

const fmtFecha = (d) =>
  d ? new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "—";

const hoyStr = () => new Date().toISOString().slice(0, 10);
const mesStr = () => new Date().toISOString().slice(0, 7);

const formatCedula = (v = "") => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`;
};

const FRECUENCIA_LABEL = { SEMANAL: "Semanal", QUINCENAL: "Quincenal", MENSUAL: "Mensual" };
const METODO_LABEL     = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque" };
const TIPO_DESCUENTO_LABEL = { TARDANZA: "Tardanza", AUSENCIA: "Ausencia", PRESTAMO: "Préstamo", OTRO: "Otro" };

const ESTADO_ASISTENCIA = {
  PRESENTE:   { label: "Presente",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  AUSENTE:    { label: "Ausente",    color: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500"     },
  TARDANZA:   { label: "Tardanza",   color: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500"   },
  MEDIO_DIA:  { label: "Medio día",  color: "bg-sky-100 text-sky-700 border-sky-200",             dot: "bg-sky-500"     },
  FERIADO:    { label: "Feriado",    color: "bg-violet-100 text-violet-700 border-violet-200",    dot: "bg-violet-500"  },
  VACACIONES: { label: "Vacaciones", color: "bg-blue-100 text-blue-700 border-blue-200",          dot: "bg-blue-500"    },
};

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const iBase = "w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent placeholder:text-gray-400";

// ─── Componentes pequeños ──────────────────────────────────────────────────────

const Spin = () => (
  <div className="flex justify-center items-center py-16">
    <div className="w-7 h-7 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium max-w-sm
      ${type === "success" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"}`}>
      {type === "success"
        ? <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
      {message}
    </div>
  );
};

const StatCard = ({ label, value, sub, color = "bg-slate-800", small }) => (
  <div className={`${color} rounded-2xl p-4 text-white`}>
    <p className={`font-bold leading-none ${small ? "text-lg mt-1" : "text-3xl"}`}>{value}</p>
    <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mt-1.5">{label}</p>
    {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
  </div>
);

// ─── Modal genérico ───────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start overflow-y-auto py-6 z-50 px-3"
    onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Tab navigation ───────────────────────────────────────────────────────────
const TABS = [
  { id: "empleados",  label: "Empleados",  icon: "👥" },
  { id: "asistencia", label: "Asistencia", icon: "📋" },
  { id: "pagos",      label: "Pagos",      icon: "💰" },
  { id: "descuentos", label: "Descuentos", icon: "✂️"  },
];

// ─── Formulario empleado ──────────────────────────────────────────────────────
const FORM_INICIAL = {
  nombre: "", apellido: "", cedula: "", telefono: "", celular: "", email: "",
  cargo: "", departamento: "", salario: "", frecuenciaPago: "QUINCENAL",
  fechaIngreso: hoyStr(), observaciones: "",
};

const FormEmpleado = ({ inicial, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState(inicial ?? FORM_INICIAL);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Nombre *</label>
          <input className={iBase} value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Nombre" required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Apellido *</label>
          <input className={iBase} value={form.apellido} onChange={e => set("apellido", e.target.value)} placeholder="Apellido" required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Cédula *</label>
          <input className={iBase} value={form.cedula}
            onChange={e => set("cedula", formatCedula(e.target.value))}
            placeholder="001-0000000-0" required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Cargo *</label>
          <input className={iBase} value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Cobrador, Admin…" required />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Departamento</label>
          <input className={iBase} value={form.departamento} onChange={e => set("departamento", e.target.value)} placeholder="Cobranza, Oficina…" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Teléfono</label>
          <input className={iBase} value={form.telefono} onChange={e => set("telefono", e.target.value)} placeholder="(809) 000-0000" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
          <input className={iBase} value={form.email} type="email" onChange={e => set("email", e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Salario *</label>
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-gray-50">
            <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0">RD$</span>
            <input value={form.salario} onChange={e => set("salario", e.target.value)}
              placeholder="0.00" inputMode="decimal" required
              className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Frecuencia de pago *</label>
          <select className={iBase} value={form.frecuenciaPago} onChange={e => set("frecuenciaPago", e.target.value)}>
            <option value="SEMANAL">Semanal</option>
            <option value="QUINCENAL">Quincenal</option>
            <option value="MENSUAL">Mensual</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Fecha de ingreso *</label>
          <input className={iBase} type="date" value={form.fechaIngreso} onChange={e => set("fechaIngreso", e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Observaciones</label>
        <textarea className={iBase} rows={2} value={form.observaciones} onChange={e => set("observaciones", e.target.value)} placeholder="Notas adicionales…" />
      </div>
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
        <button type="submit" disabled={guardando} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-all active:scale-95 flex items-center justify-center gap-2">
          {guardando && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Guardar
        </button>
      </div>
    </form>
  );
};

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function Empleados() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.rol === "ADMIN";

  const [tab, setTab]               = useState("empleados");
  const [toast, setToast]           = useState(null);
  const [loading, setLoading]       = useState(false);

  // Empleados
  const [empleados, setEmpleados]   = useState([]);
  const [resumen, setResumen]       = useState(null);
  const [verInactivos, setVerInactivos] = useState(false);
  const [modalEmp, setModalEmp]     = useState(null); // null | "nuevo" | empleado
  const [guardando, setGuardando]   = useState(false);

  // Asistencia
  const [fechaAsist, setFechaAsist] = useState(hoyStr());
  const [asistencia, setAsistencia] = useState([]);
  const [loadingAsist, setLoadingAsist] = useState(false);
  const [modalAsist, setModalAsist] = useState(null); // empleadoRow

  // Pagos
  const [pagos, setPagos]           = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [modalPago, setModalPago]   = useState(false);
  const [formPago, setFormPago]     = useState({ empleadoId: "", periodo: mesStr(), descripcion: "", metodoPago: "EFECTIVO", referencia: "", observaciones: "", descuentoIds: [] });
  const [descuentosEmp, setDescuentosEmp] = useState([]);

  // Descuentos
  const [modalDesc, setModalDesc]   = useState(false);
  const [formDesc, setFormDesc]     = useState({ empleadoId: "", tipo: "TARDANZA", descripcion: "", monto: "" });

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  // ── Protección de ruta ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) navigate("/dashboard");
  }, [isAdmin, navigate]);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  const cargarEmpleados = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, resRes] = await Promise.all([
        api.get(`/empleados${verInactivos ? "?inactivos=true" : ""}`),
        api.get("/empleados/resumen"),
      ]);
      setEmpleados(Array.isArray(empRes.data) ? empRes.data : []);
      setResumen(resRes.data);
    } catch { showToast("Error al cargar empleados", "error"); }
    finally { setLoading(false); }
  }, [verInactivos]);

  useEffect(() => { cargarEmpleados(); }, [cargarEmpleados]);

  // ── Asistencia ─────────────────────────────────────────────────────────────
  const cargarAsistencia = useCallback(async (fecha) => {
    setLoadingAsist(true);
    try {
      const r = await api.get(`/empleados/asistencia?fecha=${fecha}`);
      setAsistencia(Array.isArray(r.data) ? r.data : []);
    } catch { showToast("Error al cargar asistencia", "error"); }
    finally { setLoadingAsist(false); }
  }, []);

  useEffect(() => { if (tab === "asistencia") cargarAsistencia(fechaAsist); }, [tab, fechaAsist, cargarAsistencia]);

  // ── Pagos ──────────────────────────────────────────────────────────────────
  const cargarPagos = useCallback(async () => {
    setLoadingPagos(true);
    try {
      const r = await api.get("/empleados/pagos");
      setPagos(Array.isArray(r.data) ? r.data : []);
    } catch { showToast("Error al cargar pagos", "error"); }
    finally { setLoadingPagos(false); }
  }, []);

  useEffect(() => { if (tab === "pagos") cargarPagos(); }, [tab, cargarPagos]);

  // ── Guardar empleado ───────────────────────────────────────────────────────
  const handleGuardarEmpleado = async (form) => {
    setGuardando(true);
    try {
      const payload = { ...form, cedula: form.cedula.replace(/\D/g, ""), salario: parseFloat(form.salario) };
      if (modalEmp === "nuevo") { await api.post("/empleados", payload); showToast("Empleado creado ✓"); }
      else { await api.patch(`/empleados/${modalEmp.id}`, payload); showToast("Empleado actualizado ✓"); }
      setModalEmp(null);
      cargarEmpleados();
    } catch { showToast("Error al guardar", "error"); }
    finally { setGuardando(false); }
  };

  // ── Desactivar / Reactivar ─────────────────────────────────────────────────
  const handleDesactivar = async (emp) => {
    if (!window.confirm(`¿Desactivar a ${emp.nombre} ${emp.apellido}?`)) return;
    try { await api.delete(`/empleados/${emp.id}`); showToast(`${emp.nombre} desactivado`); cargarEmpleados(); }
    catch { showToast("Error", "error"); }
  };
  const handleReactivar = async (emp) => {
    try { await api.patch(`/empleados/${emp.id}/reactivar`); showToast(`${emp.nombre} reactivado`); cargarEmpleados(); }
    catch { showToast("Error", "error"); }
  };

  // ── Registrar asistencia ───────────────────────────────────────────────────
  const handleGuardarAsistencia = async (form) => {
    try {
      await api.post("/empleados/asistencia", { ...form, fecha: fechaAsist });
      showToast("Asistencia guardada ✓");
      setModalAsist(null);
      cargarAsistencia(fechaAsist);
    } catch { showToast("Error al guardar asistencia", "error"); }
  };

  // Guardar asistencia masiva (un click por estado)
  const handleAsistenciaRapida = async (empleadoId, estado) => {
    try {
      await api.post("/empleados/asistencia", { empleadoId, fecha: fechaAsist, estado });
      cargarAsistencia(fechaAsist);
    } catch { showToast("Error", "error"); }
  };

  // ── Cargar descuentos cuando se abre modal pago ────────────────────────────
  const abrirModalPago = async (empleadoId = "") => {
    setFormPago(p => ({ ...p, empleadoId, descuentoIds: [] }));
    if (empleadoId) {
      try {
        const r = await api.get(`/empleados/${empleadoId}/descuentos`);
        setDescuentosEmp(Array.isArray(r.data) ? r.data : []);
      } catch { setDescuentosEmp([]); }
    } else { setDescuentosEmp([]); }
    setModalPago(true);
  };

  const handleEmpleadoPagoChange = async (empleadoId) => {
    setFormPago(p => ({ ...p, empleadoId, descuentoIds: [] }));
    if (empleadoId) {
      try {
        const r = await api.get(`/empleados/${empleadoId}/descuentos`);
        setDescuentosEmp(Array.isArray(r.data) ? r.data : []);
      } catch { setDescuentosEmp([]); }
    } else { setDescuentosEmp([]); }
  };

  // ── Registrar pago ─────────────────────────────────────────────────────────
  const handleGuardarPago = async (e) => {
    e.preventDefault();
    if (!formPago.empleadoId) { showToast("Selecciona un empleado", "error"); return; }
    try {
      await api.post("/empleados/pagos", formPago);
      showToast("Pago registrado ✓");
      setModalPago(false);
      cargarPagos();
      cargarEmpleados();
    } catch { showToast("Error al registrar pago", "error"); }
  };

  // ── Registrar descuento ────────────────────────────────────────────────────
  const handleGuardarDescuento = async (e) => {
    e.preventDefault();
    try {
      await api.post("/empleados/descuentos", { ...formDesc, monto: parseFloat(formDesc.monto) });
      showToast("Descuento registrado ✓");
      setModalDesc(false);
      setFormDesc({ empleadoId: "", tipo: "TARDANZA", descripcion: "", monto: "" });
    } catch { showToast("Error al registrar descuento", "error"); }
  };

  const handleEliminarDescuento = async (id) => {
    if (!window.confirm("¿Eliminar este descuento?")) return;
    try {
      await api.delete(`/empleados/descuentos/${id}`);
      showToast("Descuento eliminado");
    } catch { showToast("Error al eliminar", "error"); }
  };

  // ── Empleado seleccionado para pago (para mostrar salario) ─────────────────
  const empSelPago = useMemo(() =>
    empleados.find(e => e.id === formPago.empleadoId), [empleados, formPago.empleadoId]);

  const totalDescSeleccionados = useMemo(() =>
    descuentosEmp.filter(d => formPago.descuentoIds.includes(d.id)).reduce((s, d) => s + d.monto, 0),
    [descuentosEmp, formPago.descuentoIds]);

  const netoEstimado = empSelPago ? Math.max(0, empSelPago.salario - totalDescSeleccionados) : 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* ── Modal Empleado ── */}
      {modalEmp && (
        <Modal title={modalEmp === "nuevo" ? "Nuevo Empleado" : `Editar — ${modalEmp.nombre}`} onClose={() => setModalEmp(null)}>
          <FormEmpleado
            inicial={modalEmp !== "nuevo" ? {
              ...modalEmp,
              cedula: formatCedula(modalEmp.cedula),
              salario: modalEmp.salario.toString(),
              fechaIngreso: modalEmp.fechaIngreso?.slice(0, 10),
            } : null}
            onGuardar={handleGuardarEmpleado}
            onCancelar={() => setModalEmp(null)}
            guardando={guardando}
          />
        </Modal>
      )}

      {/* ── Modal Asistencia ── */}
      {modalAsist && (
        <ModalAsistencia
          row={modalAsist}
          fecha={fechaAsist}
          onGuardar={handleGuardarAsistencia}
          onCancelar={() => setModalAsist(null)}
        />
      )}

      {/* ── Modal Pago ── */}
      {modalPago && (
        <Modal title="Registrar Pago de Salario" onClose={() => setModalPago(false)}>
          <form onSubmit={handleGuardarPago} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Empleado *</label>
              <select className={iBase} value={formPago.empleadoId} onChange={e => handleEmpleadoPagoChange(e.target.value)} required>
                <option value="">Seleccionar empleado…</option>
                {empleados.filter(e => e.activo).map(e => (
                  <option key={e.id} value={e.id}>{e.nombre} {e.apellido} — {e.cargo}</option>
                ))}
              </select>
            </div>

            {empSelPago && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
                <p className="font-bold text-blue-800">{empSelPago.nombre} {empSelPago.apellido}</p>
                <p className="text-blue-600 text-xs mt-0.5">Salario: <span className="font-bold">{fmt(empSelPago.salario)}</span> · {FRECUENCIA_LABEL[empSelPago.frecuenciaPago]}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Período *</label>
                <input className={iBase} value={formPago.periodo} onChange={e => setFormPago(p => ({ ...p, periodo: e.target.value }))} placeholder="2026-03" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Método *</label>
                <select className={iBase} value={formPago.metodoPago} onChange={e => setFormPago(p => ({ ...p, metodoPago: e.target.value }))}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Descripción</label>
              <input className={iBase} value={formPago.descripcion} onChange={e => setFormPago(p => ({ ...p, descripcion: e.target.value }))} placeholder="Quincena 1 — Marzo 2026…" />
            </div>

            {/* Descuentos pendientes */}
            {descuentosEmp.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Descuentos pendientes (selecciona los que aplican)</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {descuentosEmp.map(d => (
                    <label key={d.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all ${formPago.descuentoIds.includes(d.id) ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}>
                      <input type="checkbox" className="w-4 h-4 rounded text-red-500"
                        checked={formPago.descuentoIds.includes(d.id)}
                        onChange={e => setFormPago(p => ({
                          ...p,
                          descuentoIds: e.target.checked
                            ? [...p.descuentoIds, d.id]
                            : p.descuentoIds.filter(x => x !== d.id),
                        }))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{d.descripcion}</p>
                        <p className="text-[10px] text-gray-500">{TIPO_DESCUENTO_LABEL[d.tipo]} · {fmtFecha(d.fecha)}</p>
                      </div>
                      <span className="text-xs font-bold text-red-600">{fmt(d.monto)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen neto */}
            {empSelPago && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Salario bruto</span><span className="font-semibold">{fmt(empSelPago.salario)}</span></div>
                {totalDescSeleccionados > 0 && <div className="flex justify-between text-xs"><span className="text-red-500">Descuentos</span><span className="font-semibold text-red-600">− {fmt(totalDescSeleccionados)}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5"><span>Salario neto</span><span className="text-emerald-700">{fmt(netoEstimado)}</span></div>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setModalPago(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95">Registrar pago</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal Descuento ── */}
      {modalDesc && (
        <Modal title="Registrar Descuento" onClose={() => setModalDesc(false)}>
          <form onSubmit={handleGuardarDescuento} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Empleado *</label>
              <select className={iBase} value={formDesc.empleadoId} onChange={e => setFormDesc(p => ({ ...p, empleadoId: e.target.value }))} required>
                <option value="">Seleccionar empleado…</option>
                {empleados.filter(e => e.activo).map(e => (
                  <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Tipo *</label>
                <select className={iBase} value={formDesc.tipo} onChange={e => setFormDesc(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="TARDANZA">Tardanza</option>
                  <option value="AUSENCIA">Ausencia</option>
                  <option value="PRESTAMO">Préstamo</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Monto *</label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 bg-gray-50">
                  <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0">RD$</span>
                  <input value={formDesc.monto} onChange={e => setFormDesc(p => ({ ...p, monto: e.target.value }))}
                    placeholder="0.00" inputMode="decimal" required
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Descripción *</label>
              <input className={iBase} value={formDesc.descripcion} onChange={e => setFormDesc(p => ({ ...p, descripcion: e.target.value }))} placeholder="Razón del descuento…" required />
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setModalDesc(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all active:scale-95">Guardar descuento</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Layout principal ── */}
      <div className="space-y-5 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gestión de personal, asistencia y nómina</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tab === "empleados" && (
              <button onClick={() => setModalEmp("nuevo")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Nuevo Empleado
              </button>
            )}
            {tab === "pagos" && (
              <button onClick={() => abrirModalPago()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
                💰 Registrar Pago
              </button>
            )}
            {tab === "descuentos" && (
              <button onClick={() => setModalDesc(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
                ✂️ Nuevo Descuento
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {resumen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Empleados activos" value={resumen.totalEmpleados} sub="En plantilla" color="bg-slate-800" />
            <StatCard label="Presentes hoy" value={resumen.presentesHoy} sub={`${resumen.ausentesHoy} ausentes`} color="bg-emerald-600" />
            <StatCard label="Pagado este mes" value={fmt(resumen.pagadoEsteMes)} sub={`${resumen.pagosMesCount} pagos`} color="bg-blue-600" small />
            <StatCard label="Descuentos pendientes" value={fmt(resumen.descuentosPendientesMonto)} sub={`${resumen.descuentosPendientesCount} registros`} color="bg-red-500" small />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${tab === t.id ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {t.icon} <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── TAB: Empleados ── */}
          {tab === "empleados" && (
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <p className="text-xs text-gray-500 font-medium">{empleados.length} {verInactivos ? "inactivos" : "activos"}</p>
                <button onClick={() => setVerInactivos(v => !v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${verInactivos ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
                  {verInactivos ? "Ver activos" : "Ver inactivos"}
                </button>
              </div>

              {loading ? <Spin /> : empleados.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">👥</p>
                  <p className="font-semibold">No hay empleados {verInactivos ? "inactivos" : "activos"}</p>
                  {!verInactivos && <button onClick={() => setModalEmp("nuevo")} className="mt-3 text-xs text-blue-500 hover:underline">Agregar el primero</button>}
                </div>
              ) : (
                <>
                  {/* Tabla desktop */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3 text-left font-semibold">Empleado</th>
                          <th className="px-4 py-3 text-left font-semibold">Cargo</th>
                          <th className="px-4 py-3 text-left font-semibold">Salario</th>
                          <th className="px-4 py-3 text-left font-semibold">Frecuencia</th>
                          <th className="px-4 py-3 text-left font-semibold">Ingreso</th>
                          <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {empleados.map(e => (
                          <tr key={e.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{e.nombre} {e.apellido}</p>
                              <p className="text-xs text-gray-400 font-mono">{formatCedula(e.cedula)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-700">{e.cargo}</p>
                              {e.departamento && <p className="text-xs text-gray-400">{e.departamento}</p>}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{fmt(e.salario)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{FRECUENCIA_LABEL[e.frecuenciaPago]}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{fmtFecha(e.fechaIngreso)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {!verInactivos ? (
                                  <>
                                    <button onClick={() => abrirModalPago(e.id)} className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Pagar</button>
                                    <button onClick={() => setModalEmp(e)} className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">Editar</button>
                                    <button onClick={() => handleDesactivar(e)} className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">Desactivar</button>
                                  </>
                                ) : (
                                  <button onClick={() => handleReactivar(e)} className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Reactivar</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tarjetas móvil */}
                  <div className="sm:hidden divide-y divide-gray-50">
                    {empleados.map(e => (
                      <div key={e.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-gray-900">{e.nombre} {e.apellido}</p>
                            <p className="text-xs text-gray-500">{e.cargo} {e.departamento ? `· ${e.departamento}` : ""}</p>
                          </div>
                          <p className="font-bold text-gray-800 text-sm">{fmt(e.salario)}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {!verInactivos ? (
                            <>
                              <button onClick={() => abrirModalPago(e.id)} className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">Pagar</button>
                              <button onClick={() => setModalEmp(e)} className="flex-1 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">Editar</button>
                              <button onClick={() => handleDesactivar(e)} className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200">Desactivar</button>
                            </>
                          ) : (
                            <button onClick={() => handleReactivar(e)} className="w-full py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">Reactivar</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TAB: Asistencia ── */}
          {tab === "asistencia" && (
            <div>
              {/* Selector de fecha */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 flex-wrap">
                <input type="date" value={fechaAsist} max={hoyStr()}
                  onChange={e => setFechaAsist(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                <div className="flex gap-1.5">
                  {["Hoy", "Ayer"].map((l, i) => (
                    <button key={l} onClick={() => setFechaAsist(i === 0 ? hoyStr() : new Date(Date.now() - 86400000).toISOString().slice(0, 10))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${fechaAsist === (i === 0 ? hoyStr() : new Date(Date.now() - 86400000).toISOString().slice(0, 10)) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 ml-auto">
                  {asistencia.filter(r => r.asistencia?.estado === "PRESENTE" || r.asistencia?.estado === "TARDANZA").length}/{asistencia.length} presentes
                </p>
              </div>

              {loadingAsist ? <Spin /> : asistencia.length === 0 ? (
                <div className="text-center py-16 text-gray-400"><p>No hay empleados activos</p></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {asistencia.map(({ empleado: emp, asistencia: reg }) => {
                    const est = reg?.estado;
                    const cfg = est ? ESTADO_ASISTENCIA[est] : null;
                    return (
                      <div key={emp.id} className="flex items-center gap-3 px-4 py-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                          {emp.nombre.charAt(0)}{emp.apellido.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{emp.nombre} {emp.apellido}</p>
                          <p className="text-xs text-gray-400">{emp.cargo}</p>
                        </div>
                        {/* Estado actual */}
                        {cfg ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color} shrink-0`}>{cfg.label}</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-400 border-gray-200 shrink-0">Sin registro</span>
                        )}
                        {/* Hora entrada/salida */}
                        {reg?.entrada && (
                          <div className="text-xs text-gray-500 shrink-0 hidden sm:block">
                            {reg.entrada}{reg.salida ? ` → ${reg.salida}` : ""}
                          </div>
                        )}
                        {/* Botones rápidos */}
                        <div className="flex gap-1 shrink-0">
                          {["PRESENTE", "AUSENTE", "TARDANZA"].map(estado => (
                            <button key={estado} onClick={() => handleAsistenciaRapida(emp.id, estado)}
                              title={ESTADO_ASISTENCIA[estado].label}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all
                                ${est === estado ? ESTADO_ASISTENCIA[estado].color : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"}`}>
                              {estado === "PRESENTE" ? "✓" : estado === "AUSENTE" ? "✗" : "~"}
                            </button>
                          ))}
                          <button onClick={() => setModalAsist({ empleado: emp, asistencia: reg })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition-all"
                            title="Más opciones">⋯</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Pagos ── */}
          {tab === "pagos" && (
            <div>
              {loadingPagos ? <Spin /> : pagos.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-4xl mb-3">💰</p>
                  <p className="font-semibold">No hay pagos registrados</p>
                  <button onClick={() => abrirModalPago()} className="mt-3 text-xs text-blue-500 hover:underline">Registrar primer pago</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3 text-left font-semibold">Empleado</th>
                        <th className="px-4 py-3 text-left font-semibold">Período</th>
                        <th className="px-4 py-3 text-right font-semibold">Bruto</th>
                        <th className="px-4 py-3 text-right font-semibold">Desc.</th>
                        <th className="px-4 py-3 text-right font-semibold">Neto</th>
                        <th className="px-4 py-3 text-left font-semibold">Método</th>
                        <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pagos.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{p.empleado.nombre} {p.empleado.apellido}</p>
                            <p className="text-xs text-gray-400">{p.empleado.cargo}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <p>{p.periodo}</p>
                            {p.descripcion && <p className="text-xs text-gray-400">{p.descripcion}</p>}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt(p.salarioBruto)}</td>
                          <td className="px-4 py-3 text-right text-sm">
                            {p.totalDescuentos > 0
                              ? <span className="text-red-600 font-semibold">− {fmt(p.totalDescuentos)}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(p.salarioNeto)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{METODO_LABEL[p.metodoPago]}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{fmtFecha(p.fechaPago)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200 font-bold text-sm">
                        <td colSpan={2} className="px-4 py-3 text-gray-500">Total</td>
                        <td className="px-4 py-3 text-right">{fmt(pagos.reduce((s, p) => s + p.salarioBruto, 0))}</td>
                        <td className="px-4 py-3 text-right text-red-600">{fmt(pagos.reduce((s, p) => s + p.totalDescuentos, 0))}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{fmt(pagos.reduce((s, p) => s + p.salarioNeto, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Descuentos ── */}
          {tab === "descuentos" && (
            <TabDescuentos empleados={empleados} showToast={showToast} handleEliminar={handleEliminarDescuento} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Modal asistencia detallado ───────────────────────────────────────────────
function ModalAsistencia({ row, fecha, onGuardar, onCancelar }) {
  const { empleado: emp, asistencia: reg } = row;
  const [form, setForm] = useState({
    empleadoId: emp.id,
    entrada:    reg?.entrada    ?? "",
    salida:     reg?.salida     ?? "",
    estado:     reg?.estado     ?? "PRESENTE",
    observacion: reg?.observacion ?? "",
  });

  return (
    <Modal title={`Asistencia — ${emp.nombre} ${emp.apellido}`} onClose={onCancelar}>
      <form onSubmit={e => { e.preventDefault(); onGuardar(form); }} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Estado</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ESTADO_ASISTENCIA).map(([k, v]) => (
              <button type="button" key={k} onClick={() => setForm(p => ({ ...p, estado: k }))}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${form.estado === k ? v.color : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Hora de entrada</label>
            <input type="time" className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.entrada} onChange={e => setForm(p => ({ ...p, entrada: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Hora de salida</label>
            <input type="time" className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.salida} onChange={e => setForm(p => ({ ...p, salida: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Observación</label>
          <input className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.observacion} onChange={e => setForm(p => ({ ...p, observacion: e.target.value }))} placeholder="Nota opcional…" />
        </div>
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onCancelar} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
          <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Tab Descuentos — componente separado para poder cargar por empleado ──────
function TabDescuentos({ empleados, showToast, handleEliminar }) {
  const [empId, setEmpId]       = useState("");
  const [descuentos, setDesc]   = useState([]);
  const [loading, setLoading]   = useState(false);

  const cargar = useCallback(async (id) => {
    if (!id) { setDesc([]); return; }
    setLoading(true);
    try {
      const r = await api.get(`/empleados/${id}/descuentos`);
      setDesc(Array.isArray(r.data) ? r.data : []);
    } catch { showToast("Error al cargar descuentos", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { cargar(empId); }, [empId, cargar]);

  const fmt = (n = 0) =>
    new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n);

  const TIPO_DESCUENTO_LABEL = { TARDANZA: "Tardanza", AUSENCIA: "Ausencia", PRESTAMO: "Préstamo", OTRO: "Otro" };

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-50">
        <select
          className="w-full sm:w-64 border border-gray-200 bg-gray-50 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={empId} onChange={e => setEmpId(e.target.value)}>
          <option value="">— Seleccionar empleado —</option>
          {empleados.filter(e => e.activo).map(e => (
            <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>
          ))}
        </select>
      </div>

      {!empId ? (
        <div className="text-center py-16 text-gray-400"><p>Selecciona un empleado para ver sus descuentos</p></div>
      ) : loading ? <Spin /> : descuentos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✂️</p>
          <p className="font-semibold">Sin descuentos pendientes</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {descuentos.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{d.descripcion}</p>
                <p className="text-xs text-gray-400">{TIPO_DESCUENTO_LABEL[d.tipo]} · {new Date(d.fecha).toLocaleDateString("es-DO")}</p>
              </div>
              <span className="font-bold text-red-600 text-sm shrink-0">− {fmt(d.monto)}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${d.aplicado ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                {d.aplicado ? "Aplicado" : "Pendiente"}
              </span>
              {!d.aplicado && (
                <button onClick={() => { handleEliminar(d.id); cargar(empId); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total pendiente</span>
            <span className="font-bold text-red-600">{fmt(descuentos.filter(d => !d.aplicado).reduce((s, d) => s + d.monto, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}