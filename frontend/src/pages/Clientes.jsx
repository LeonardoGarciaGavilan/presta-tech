// src/pages/Clientes.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import EstadoCuenta from "../components/EstadoCuenta";
import api from "../services/api";
import { PROVINCIAS_MUNICIPIOS, PROVINCIAS } from "../utils/provincias-municipios";
import { getSectores } from "../utils/sectores-municipios";

// ─── Leaflet dinámico ─────────────────────────────────────────────────────────
let lfReady = false;
const loadLeaflet = () => new Promise((resolve) => {
  if (window.L && lfReady) { resolve(window.L); return; }
  if (!document.getElementById("lf-css")) {
    const l = document.createElement("link"); l.id = "lf-css"; l.rel = "stylesheet";
    l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(l);
  }
  if (document.getElementById("lf-js")) {
    const t = setInterval(() => { if (window.L) { clearInterval(t); lfReady = true; resolve(window.L); } }, 80);
  } else {
    const s = document.createElement("script"); s.id = "lf-js";
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => { lfReady = true; resolve(window.L); }; document.head.appendChild(s);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCedula = (v) => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 3) return d; if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3)}`; return `${d.slice(0, 3)}-${d.slice(3, 10)}-${d.slice(10)}`; };
const formatTelefono = (v) => { const d = v.replace(/\D/g, "").slice(0, 10); if (d.length <= 3) return d; if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`; return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; };
const formatIngresos = (v) => { const r = v.replace(/[^\d.]/g, ""); const p = r.split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return p.slice(0, 2).join("."); };
const stripIngresos = (v) => v.replace(/,/g, "");
const PREFIJOS_RD = ["809", "829", "849"];
const validateTel = (v) => { const d = v.replace(/\D/g, ""); if (!d) return true; return d.length === 10 && PREFIJOS_RD.includes(d.slice(0, 3)); };

const INITIAL_FORM = {
  nombre: "", apellido: "", cedula: "", telefono: "", celular: "", email: "",
  provincia: "", municipio: "", sector: "", direccion: "",
  ocupacion: "", empresaLaboral: "", ingresos: "", observaciones: "",
  latitud: null, longitud: null, rutaId: "",
};

if (typeof document !== "undefined" && !document.getElementById("clientes-styles")) {
  const s = document.createElement("style"); s.id = "clientes-styles";
  s.textContent = `
    @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .modal-enter{animation:fadeUp 0.2s ease}
    .leaflet-container{z-index:0}
  `;
  document.head.appendChild(s);
}

const POR_PAGINA = 20;

// ─── Hook de debounce ─────────────────────────────────────────────────────────
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Mapa interactivo ─────────────────────────────────────────────────────────
const MapaUbicacion = ({ lat, lng, onCoordsChange }) => {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    loadLeaflet().then(L => {
      if (dead || !divRef.current || mapRef.current) return;
      const map = L.map(divRef.current, { zoomControl: true })
        .setView([lat ?? 18.74, lng ?? -70.16], lat ? 15 : 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map);
      if (lat && lng) {
        const mk = L.marker([lat, lng], { draggable: true }).addTo(map);
        mk.on("dragend", e => { const p = e.target.getLatLng(); onCoordsChange(p.lat, p.lng); });
        markRef.current = mk;
      }
      map.on("click", e => {
        const { lat: clat, lng: clng } = e.latlng;
        if (markRef.current) { markRef.current.setLatLng([clat, clng]); }
        else {
          const mk = L.marker([clat, clng], { draggable: true }).addTo(map);
          mk.on("dragend", ev => { const p = ev.target.getLatLng(); onCoordsChange(p.lat, p.lng); });
          markRef.current = mk;
        }
        onCoordsChange(clat, clng);
      });
      mapRef.current = map;
      setReady(true);
    });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !ready) return;
    if (lat && lng) {
      if (markRef.current) { markRef.current.setLatLng([lat, lng]); }
      else {
        const mk = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
        mk.on("dragend", e => { const p = e.target.getLatLng(); onCoordsChange(p.lat, p.lng); });
        markRef.current = mk;
      }
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 15));
    } else if (!lat && markRef.current) {
      mapRef.current.removeLayer(markRef.current);
      markRef.current = null;
    }
  }, [lat, lng, ready]);

  const limpiar = () => {
    if (markRef.current && mapRef.current) { mapRef.current.removeLayer(markRef.current); markRef.current = null; }
    onCoordsChange(null, null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={divRef} style={{ height: "280px", width: "100%" }} />
        {!ready && (
          <div className="absolute inset-0 bg-white flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Cargando mapa…</span>
          </div>
        )}
        {ready && !lat && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
            <span className="bg-black/65 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
              👆 Haz clic en el mapa para marcar la ubicación
            </span>
          </div>
        )}
      </div>
      {lat && lng ? (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-emerald-500 shrink-0">📍</span>
            <div className="min-w-0">
              <p className="text-xs text-emerald-700 font-semibold">Ubicación guardada</p>
              <p className="text-[10px] text-emerald-500 font-mono truncate">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
            </div>
          </div>
          <button type="button" onClick={limpiar}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-200 transition-all">
            ✕ Limpiar pin
          </button>
        </div>
      ) : ready && (
        <p className="text-[10px] text-gray-400 text-center">También puedes arrastrar el pin para ajustar la posición exacta</p>
      )}
    </div>
  );
};

// ─── UI atoms ─────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium ${type === "success" ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-red-50 border-red-400 text-red-800"}`}
      style={{ animation: "slideIn 0.25s ease" }}>
      {type === "success"
        ? <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};

const Badge = ({ activo }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${activo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-red-500"}`} />
    {activo ? "Activo" : "Inactivo"}
  </span>
);

const Spinner = () => (
  <div className="flex justify-center items-center py-16">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const iBase = "w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent placeholder:text-gray-400";
const iErr = "border-red-400 bg-red-50 focus:ring-red-400";

// ─── Paginación (server-side) ─────────────────────────────────────────────────
const Paginacion = ({ pagina, totalPaginas, total, porPagina, onChange, loading }) => {
  if (totalPaginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const pages = [];
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || (i >= pagina - 1 && i <= pagina + 1)) pages.push(i);
  }
  const withE = []; let prev = null;
  for (const p of pages) { if (prev && p - prev > 1) withE.push("..."); withE.push(p); prev = p; }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 order-2 sm:order-1">
        Mostrando <span className="font-semibold text-gray-600">{desde}–{hasta}</span> de{" "}
        <span className="font-semibold text-gray-600">{total}</span>
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button onClick={() => onChange(pagina - 1)} disabled={pagina === 1 || loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        {withE.map((p, i) =>
          p === "..."
            ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
            : <button key={p} onClick={() => onChange(p)} disabled={loading}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all ${p === pagina ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>
        )}
        <button onClick={() => onChange(pagina + 1)} disabled={pagina === totalPaginas || loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
};

// ─── Tarjeta móvil ────────────────────────────────────────────────────────────
const TarjetaCliente = ({ cliente, verInactivos, onEstadoCuenta, onEdit, onDelete, onReactivar }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-semibold text-gray-900">{cliente.nombre} {cliente.apellido}</p>
        {cliente.email && <p className="text-xs text-gray-400 mt-0.5">{cliente.email}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {cliente.latitud && <span title="Tiene ubicación en mapa" className="text-xs">📍</span>}
        <Badge activo={!verInactivos} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      <div><span className="text-gray-400">Cédula</span><p className="font-mono font-medium text-gray-700">{formatCedula(cliente.cedula || "")}</p></div>
      <div><span className="text-gray-400">Teléfono</span><p className="font-medium text-gray-700">{formatTelefono(cliente.telefono || "") || "—"}</p></div>
      {cliente.provincia && <div className="col-span-2"><span className="text-gray-400">Ubicación</span><p className="font-medium text-gray-700">{[cliente.provincia, cliente.municipio, cliente.sector].filter(Boolean).join(" › ")}</p></div>}
    </div>
    <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
      {!verInactivos ? (
        <>
          <button onClick={() => onEstadoCuenta(cliente.id)} className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">Estado</button>
          <button onClick={() => onEdit(cliente)} className="flex-1 min-w-[80px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">Editar</button>
          <button onClick={() => onDelete(cliente)} className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">Desactivar</button>
        </>
      ) : (
        <button onClick={() => onReactivar(cliente)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Reactivar</button>
      )}
    </div>
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Clientes() {
  // ── Estado paginación server-side ──
  const [clientes,       setClientes]       = useState([]);
  const [totalClientes,  setTotalClientes]  = useState(0);
  const [totalPaginas,   setTotalPaginas]   = useState(1);
  const [pagina,         setPagina]         = useState(1);

  // ── Estado general ──
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [isEditing,      setIsEditing]      = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [errors,         setErrors]         = useState({});
  const [verInactivos,   setVerInactivos]   = useState(false);
  const [search,         setSearch]         = useState("");
  const [estadoCuentaId, setEstadoCuentaId] = useState(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [toast,          setToast]          = useState(null);
  const [form,           setForm]           = useState(INITIAL_FORM);
  const [mostrarMapa,    setMostrarMapa]    = useState(false);
  const [sectorLibre,    setSectorLibre]    = useState("");
  const [sectorSelect,   setSectorSelect]   = useState("");

  // ── Estado rutas ──
  const [rutas,          setRutas]          = useState([]);

  // ── Estado geolocalización ──
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Debounce del search para no disparar una petición por cada tecla
  const searchDebounced = useDebounce(search, 400);

  const municipiosDisponibles = useMemo(() =>
    form.provincia ? (PROVINCIAS_MUNICIPIOS[form.provincia] ?? []) : [], [form.provincia]);
  const sectoresDisponibles = useMemo(() =>
    form.municipio ? getSectores(form.municipio) : [], [form.municipio]);

  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);

  // ── Fetch server-side (paginación + búsqueda en BD) ──────────────────────
  const fetchClientes = useCallback(async (pg = pagina) => {
    setLoading(true);
    try {
      const endpoint = verInactivos ? "/clientes/inactivos" : "/clientes";
      const params = new URLSearchParams({
        page:   String(pg),
        limit:  String(POR_PAGINA),
        ...(searchDebounced ? { search: searchDebounced } : {}),
      });
      const res = await api.get(`${endpoint}?${params}`);

      // El backend ahora devuelve { data, total, pagina, porPagina, totalPaginas }
      setClientes(res.data.data);
      setTotalClientes(res.data.total);
      setTotalPaginas(res.data.totalPaginas);
      setPagina(res.data.pagina);
    } catch {
      showToast("Error al cargar clientes", "error");
    } finally {
      setLoading(false);
    }
  }, [verInactivos, searchDebounced, pagina, showToast]);

  // Reiniciar a página 1 cuando cambia búsqueda o modo activos/inactivos
  useEffect(() => {
    setPagina(1);
  }, [searchDebounced, verInactivos]);

  // Disparar fetch cuando cambia página, búsqueda o modo
  useEffect(() => {
    fetchClientes(pagina);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, searchDebounced, verInactivos]);

  const handlePageChange = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    setPagina(nuevaPagina);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cargar rutas disponibles (una sola vez al montar)
  useEffect(() => {
    api.get("/rutas").then(r => setRutas(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM); setErrors({}); setIsEditing(false);
    setClienteSeleccionado(null); setMostrarMapa(false);
    setSectorLibre(""); setSectorSelect("");
    setGeoError(null);
  }, []);

  const openNewModal = () => { resetForm(); setShowModal(true); };

  const obtenerMiUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta GPS");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm(p => ({
          ...p,
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          coordsAproximadas: true
        }));
        setGeoLoading(false);
        showToast("Ubicación capturada correctamente");
      },
      (error) => {
        setGeoLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError("Permiso denegado. Activa ubicación en el navegador.");
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError("No se pudo obtener la ubicación.");
            break;
          case error.TIMEOUT:
            setGeoError("Tiempo de espera agotado.");
            break;
          default:
            setGeoError("Error al obtener ubicación.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "cedula") v = formatCedula(value);
    if (name === "telefono" || name === "celular") v = formatTelefono(value);
    if (name === "ingresos") v = formatIngresos(value);
    if (name === "provincia") {
      setForm(p => ({ ...p, provincia: value, municipio: "", sector: "", latitud: null, longitud: null }));
      if (errors.provincia) setErrors(p => ({ ...p, provincia: null }));
      return;
    }
    if (name === "municipio") {
      setForm(p => ({ ...p, municipio: value, sector: "", latitud: null, longitud: null }));
      setSectorLibre(""); setSectorSelect(""); return;
    }
    if (name === "sector") {
      setSectorSelect(value);
      if (value !== "__otro__") {
        setForm(p => ({ ...p, sector: value, latitud: null, longitud: null }));
        setSectorLibre("");
      } else {
        setForm(p => ({ ...p, sector: "", latitud: null, longitud: null }));
      }
      return;
    }
    setForm(p => ({ ...p, [name]: v }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: null }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target; const ne = { ...errors };
    if (name === "cedula" && value) { const d = value.replace(/\D/g, ""); if (d.length !== 11) ne.cedula = "La cédula debe tener 11 dígitos."; else delete ne.cedula; }
    if ((name === "telefono" || name === "celular") && value) { if (!validateTel(value)) ne[name] = "Número inválido (809, 829 o 849)."; else delete ne[name]; }
    if (name === "email" && value) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) ne.email = "Correo inválido."; else delete ne.email; }
    setErrors(ne);
  };

  const validate = () => {
    const ne = {};
    const d = form.cedula.replace(/\D/g, "");
    if (!d) ne.cedula = "La cédula es obligatoria.";
    else if (d.length !== 11) ne.cedula = "La cédula debe tener 11 dígitos.";
    if (form.telefono && !validateTel(form.telefono)) ne.telefono = "Número inválido.";
    if (form.celular && !validateTel(form.celular)) ne.celular = "Número inválido.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) ne.email = "Correo inválido.";
    return ne;
  };

  const handleEdit = (c) => {
    setIsEditing(true); setClienteSeleccionado(c); setErrors({});
    setForm({
      nombre: c.nombre || "", apellido: c.apellido || "",
      cedula: c.cedula ? formatCedula(c.cedula) : "",
      telefono: c.telefono ? formatTelefono(c.telefono) : "",
      celular: c.celular ? formatTelefono(c.celular) : "",
      email: c.email || "", provincia: c.provincia || "", municipio: c.municipio || "",
      sector: c.sector || "", direccion: c.direccion || "", ocupacion: c.ocupacion || "",
      empresaLaboral: c.empresaLaboral || "",
      ingresos: c.ingresos ? formatIngresos(c.ingresos.toString()) : "",
      observaciones: c.observaciones || "",
      latitud: c.latitud ?? null, longitud: c.longitud ?? null,
      rutaId: "",
    });
    // Cargar ruta actual del cliente de forma asíncrona
    api.get(`/rutas/cliente/${c.id}`)
      .then(r => setForm(p => ({ ...p, rutaId: r.data?.rutaId ?? "" })))
      .catch(() => {});
    setMostrarMapa(!!(c.latitud && c.longitud));
    setSectorLibre("");
    const sectsGuardados = c.municipio ? (getSectores(c.municipio) ?? []) : [];
    const esSectorLista = c.sector && sectsGuardados.includes(c.sector);
    setSectorSelect(esSectorLista ? (c.sector || "") : (c.sector ? "__otro__" : ""));
    if (!esSectorLista && c.sector) setSectorLibre(c.sector);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ve = validate(); if (Object.keys(ve).length > 0) { setErrors(ve); return; }
    setSubmitting(true);
    try {
      const { rutaId, ...formSinRuta } = form;
      const payload = {
        ...formSinRuta,
        cedula: form.cedula.replace(/\D/g, ""),
        telefono: form.telefono.replace(/\D/g, ""),
        celular: form.celular.replace(/\D/g, ""),
        ingresos: form.ingresos ? parseFloat(stripIngresos(form.ingresos)) : null,
        latitud: form.latitud ?? undefined,
        longitud: form.longitud ?? undefined,
        coordsAproximadas: false,
      };
      let clienteId;
      if (isEditing) {
        await api.patch(`/clientes/${clienteSeleccionado.id}`, payload);
        clienteId = clienteSeleccionado.id;
        showToast("Cliente actualizado");
      } else {
        const res = await api.post("/clientes", payload);
        clienteId = res.data.id;
        showToast("Cliente creado");
      }
      // Asignar ruta si se seleccionó (o quitar si se dejó vacío)
      if (rutaId !== undefined) {
        api.patch(`/rutas/cliente/${clienteId}/asignar`, { rutaId: rutaId || null })
          .catch(() => {}); // silencioso — no bloquea el guardado
      }
      resetForm(); setShowModal(false);
      fetchClientes(isEditing ? pagina : 1);
    } catch { showToast("Error al guardar", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`¿Desactivar a ${c.nombre} ${c.apellido}?`)) return;
    try { await api.delete(`/clientes/${c.id}`); showToast(`${c.nombre} desactivado`); fetchClientes(pagina); }
    catch { showToast("Error al desactivar", "error"); }
  };

  const handleReactivar = async (c) => {
    if (!window.confirm(`¿Reactivar a ${c.nombre} ${c.apellido}?`)) return;
    try { await api.patch(`/clientes/${c.id}/reactivar`); showToast(`${c.nombre} reactivado`); fetchClientes(pagina); }
    catch { showToast("Error al reactivar", "error"); }
  };

  return (
    <>
      {estadoCuentaId && <EstadoCuenta clienteId={estadoCuentaId} onClose={() => setEstadoCuentaId(null)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalClientes} {verInactivos ? "inactivos" : "activos"} en total
            </p>
          </div>
          <button onClick={openNewModal}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all w-full sm:w-auto justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nuevo Cliente
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
            <div className="relative w-full sm:w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, cédula…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition" />
              {/* Indicador de búsqueda activa */}
              {search !== searchDebounced && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button onClick={() => { setVerInactivos(!verInactivos); setSearch(""); setPagina(1); }}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap ${verInactivos ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"}`}>
              {verInactivos ? "Ver Activos" : "Ver Inactivos"}
            </button>
          </div>

          {loading ? <Spinner /> : clientes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">
                {search ? `Sin resultados para "${search}"` : `No hay clientes ${verInactivos ? "inactivos" : "activos"}`}
              </p>
              {search && (
                <button onClick={() => setSearch("")} className="mt-2 text-xs text-blue-500 hover:underline">
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tabla desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-left font-semibold">Cédula</th>
                      <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Teléfono</th>
                      <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Ubicación</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clientes.map(c => (
                      <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {c.nombre} {c.apellido}
                          {c.email && <div className="text-xs text-gray-400 font-normal">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{formatCedula(c.cedula || "")}</td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{formatTelefono(c.telefono || "") || "—"}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {c.provincia ? (
                            <div>
                              <p className="text-xs font-medium text-gray-700">{c.provincia} › {c.municipio || "—"}</p>
                              {c.sector && <p className="text-xs text-gray-400">{c.sector}</p>}
                              {c.latitud && <span className="text-[10px] text-blue-500 font-medium">📍 Con coordenadas</span>}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3"><Badge activo={!verInactivos} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {!verInactivos ? (
                              <>
                                <button onClick={() => setEstadoCuentaId(c.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200"><span className="hidden lg:inline">Estado de Cuenta</span><span className="lg:hidden">Estado</span></button>
                                <button onClick={() => handleEdit(c)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">Editar</button>
                                <button onClick={() => handleDelete(c)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200">Desactivar</button>
                              </>
                            ) : (
                              <button onClick={() => handleReactivar(c)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Reactivar</button>
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
                {clientes.map(c => (
                  <div key={c.id} className="p-3">
                    <TarjetaCliente cliente={c} verInactivos={verInactivos}
                      onEstadoCuenta={setEstadoCuentaId} onEdit={handleEdit}
                      onDelete={handleDelete} onReactivar={handleReactivar} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Paginación */}
          {!loading && totalClientes > 0 && (
            <Paginacion
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalClientes}
              porPagina={POR_PAGINA}
              onChange={handlePageChange}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-start overflow-y-auto py-4 sm:py-8 z-50 px-3 sm:px-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl modal-enter">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{isEditing ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Datos personales */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Datos Personales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: "nombre", ph: "Nombre", req: true },
                    { name: "apellido", ph: "Apellido" },
                    { name: "cedula", ph: "Cédula (001-0000000-0)", req: true, hint: "Formato: 001-0000000-0" },
                    { name: "email", ph: "Correo Electrónico", type: "email" },
                    { name: "telefono", ph: "Teléfono (809) 000-0000", hint: "Prefijos: 809, 829, 849" },
                    { name: "celular", ph: "Celular (809) 000-0000", hint: "Prefijos: 809, 829, 849" },
                  ].map(f => (
                    <div key={f.name}>
                      <input name={f.name} type={f.type || "text"} value={form[f.name]} placeholder={f.ph}
                        onChange={handleChange} onBlur={handleBlur} required={!!f.req}
                        className={`${iBase} ${errors[f.name] ? iErr : ""}`} />
                      {errors[f.name] ? <p className="text-red-500 text-xs mt-1">{errors[f.name]}</p> : f.hint ? <p className="text-gray-400 text-xs mt-1">{f.hint}</p> : null}
                    </div>
                  ))}
                </div>
              </section>

              {/* Dirección */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Dirección</h3>
                  <span className="text-[10px] text-gray-400 font-medium">Provincia → Municipio → Sector → Dirección</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Provincia</label>
                    <select name="provincia" value={form.provincia} onChange={handleChange}
                      className={`${iBase} ${!form.provincia ? "text-gray-400" : "text-gray-800"}`}>
                      <option value="">Selecciona una provincia</option>
                      {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Municipio</label>
                    <select name="municipio" value={form.municipio} onChange={handleChange}
                      disabled={!form.provincia}
                      className={`${iBase} ${!form.municipio ? "text-gray-400" : "text-gray-800"} disabled:opacity-50`}>
                      <option value="">{form.provincia ? "Selecciona un municipio" : "Primero elige provincia"}</option>
                      {municipiosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Sector / Barrio
                      {sectoresDisponibles.length === 0 && form.municipio && (
                        <span className="text-gray-400 font-normal ml-1">(escribe libremente)</span>
                      )}
                    </label>
                    {sectoresDisponibles.length > 0 ? (
                      <select name="sector" value={sectorSelect} onChange={handleChange}
                        disabled={!form.municipio}
                        className={`${iBase} ${!sectorSelect ? "text-gray-400" : "text-gray-800"} disabled:opacity-50`}>
                        <option value="">Selecciona un sector</option>
                        {sectoresDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="__otro__">Otro (escribir)</option>
                      </select>
                    ) : (
                      <input name="sector" value={form.sector} onChange={handleChange}
                        placeholder={form.municipio ? "Sector o barrio…" : "Primero elige municipio"}
                        disabled={!form.municipio}
                        className={`${iBase} disabled:opacity-50`} />
                    )}
                    {sectorSelect === "__otro__" && (
                      <input value={sectorLibre}
                        onChange={e => { const v = e.target.value; setSectorLibre(v); setForm(p => ({ ...p, sector: v })); }}
                        placeholder="Escribe el sector o barrio…"
                        className={`${iBase} mt-2`} autoFocus />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección exacta</label>
                    <input name="direccion" value={form.direccion} onChange={handleChange}
                      placeholder="Calle, número, referencia…" className={iBase} />
                  </div>
                </div>
                {(form.provincia || form.municipio || form.sector) && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <span>📍</span>
                    <span>{[form.provincia, form.municipio, sectorSelect === "__otro__" ? sectorLibre : form.sector, form.direccion].filter(p => p && p !== "__otro__").join(" › ")}</span>
                  </div>
                )}
              </section>

              {/* Mapa */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Ubicación en mapa</h3>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={obtenerMiUbicacion} disabled={geoLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-all">
                      {geoLoading ? (
                        <><div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Obteniendo...</>
                      ) : "📍 Usar mi ubicación"}
                    </button>
                    <button type="button" onClick={() => setMostrarMapa(m => !m)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${mostrarMapa ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                      🗺️ {mostrarMapa ? "Ocultar mapa" : "Marcar en mapa"}
                      {form.latitud && !mostrarMapa && <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />}
                    </button>
                  </div>
                </div>
                {geoError && (
                  <div className="mb-3 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="text-sm">⚠️ {geoError}</span>
                  </div>
                )}
                {mostrarMapa && (
                  <MapaUbicacion lat={form.latitud} lng={form.longitud}
                    onCoordsChange={(lat, lng) => setForm(p => ({ ...p, latitud: lat, longitud: lng }))} />
                )}
                {!mostrarMapa && form.latitud && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-emerald-500">📍</span>
                    <p className="text-xs text-emerald-700 font-medium">✓ Ubicación guardada · {form.latitud.toFixed(5)}, {form.longitud.toFixed(5)}</p>
                  </div>
                )}
              </section>

              {/* Info financiera */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Información Financiera</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input name="ocupacion" value={form.ocupacion} placeholder="Ocupación" onChange={handleChange} className={iBase} />
                  <input name="empresaLaboral" value={form.empresaLaboral} placeholder="Empresa Laboral" onChange={handleChange} className={iBase} />
                  <div className="sm:col-span-2">
                    <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition ${errors.ingresos ? "border-red-400" : "border-gray-200"}`}>
                      <span className="px-3 py-2 bg-gray-100 text-gray-500 text-sm font-medium border-r border-gray-200 shrink-0">RD$</span>
                      <input name="ingresos" value={form.ingresos} placeholder="0.00" onChange={handleChange} onBlur={handleBlur} inputMode="decimal"
                        className="flex-1 px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none transition" />
                    </div>
                    <p className="text-gray-400 text-xs mt-1">Ingresos mensuales en pesos dominicanos</p>
                  </div>
                </div>
                <textarea name="observaciones" value={form.observaciones} placeholder="Observaciones adicionales…"
                  onChange={handleChange} className={`${iBase} mt-3`} rows={3} />

                {/* Asignación de ruta */}
                {rutas.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      🗺️ Asignar a ruta <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <select
                      value={form.rutaId}
                      onChange={e => setForm(p => ({ ...p, rutaId: e.target.value }))}
                      className={`${iBase} ${form.rutaId ? "text-gray-800" : "text-gray-400"}`}
                    >
                      <option value="">Sin ruta asignada</option>
                      {rutas.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}{r.clientes?.length !== undefined ? ` (${r.clientes.length} clientes)` : ""}
                        </option>
                      ))}
                    </select>
                    {form.rutaId && (
                      <p className="text-xs text-blue-600 font-medium mt-1">
                        ✓ Se agregará automáticamente a la ruta al guardar
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Botones */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors w-full sm:w-auto">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-all active:scale-95 shadow-sm w-full sm:w-auto">
                  {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isEditing ? "Actualizar Cliente" : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}