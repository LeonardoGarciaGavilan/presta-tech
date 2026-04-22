// src/pages/Rutas.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, formatCedula } from "../utils/prestamosUtils";
import { PROVINCIAS, PROVINCIAS_MUNICIPIOS } from "../utils/provincias-municipios";
import ReciboPago from "./recibopago";
import { usePago } from "../hooks/usePago";

// ─── Leaflet ─────────────────────────────────────────────────────────────────
let leafletReady = false;
const loadLeaflet = () =>
  new Promise((resolve) => {
    if (window.L && leafletReady) { resolve(window.L); return; }
    if (!document.getElementById("lf-css")) {
      const l = document.createElement("link");
      l.id = "lf-css"; l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
    if (document.getElementById("lf-js")) {
      const wait = setInterval(() => { if (window.L) { clearInterval(wait); leafletReady = true; resolve(window.L); } }, 80);
    } else {
      const s = document.createElement("script");
      s.id = "lf-js";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload = () => { leafletReady = true; resolve(window.L); };
      document.head.appendChild(s);
    }
  });

const ALIASES_OSM = {
  "Santo Domingo de Guzmán": "Santo Domingo",
  "Santiago de los Caballeros": "Santiago",
  "San Francisco de Macorís": "San Francisco de Macorís",
  "Bajos de Haina": "Haina",
  "Sabana Grande de Boyá": "Sabana Grande de Boyá",
  "San José de Los Llanos": "San José de los Llanos",
};
const osm = (n) => ALIASES_OSM[n] ?? n;

const freeQuery = (parts) => {
  const q = parts.filter(Boolean).join(", ");
  return `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=do&accept-language=es&q=${encodeURIComponent(q)}`;
};

const structuredQuery = (municipio, provincia) => {
  const params = new URLSearchParams({ format: "json", limit: "1", countrycodes: "do", "accept-language": "es" });
  if (municipio) params.set("city", osm(municipio));
  if (provincia) params.set("state", osm(provincia));
  params.set("country", "Dominican Republic");
  return `https://nominatim.openstreetmap.org/search?${params}`;
};

const geocode = async (c) => {
  if (!c.municipio && !c.provincia && !c.sector && !c.direccion) return null;

  const mun = c.municipio ? osm(c.municipio) : null;
  const prov = c.provincia ? osm(c.provincia) : null;
  const RD = "República Dominicana";

  const municipioValido = c.municipio && c.provincia &&
    (PROVINCIAS_MUNICIPIOS[c.provincia] ?? []).includes(c.municipio);

  const intentos = [];

  if (c.direccion && c.sector && mun)
    intentos.push({ url: freeQuery([c.direccion, c.sector, mun, prov, RD]), label: "direccion-sector", precision: 1 });

  if (c.direccion && mun)
    intentos.push({ url: freeQuery([c.direccion, mun, prov, RD]), label: "direccion", precision: 1 });

  if (c.sector && mun)
    intentos.push({ url: freeQuery([c.sector, mun, prov, RD]), label: "sector", precision: 2 });

  if (municipioValido)
    intentos.push({ url: structuredQuery(c.municipio, c.provincia), label: "municipio", precision: 3 });

  if (mun)
    intentos.push({ url: freeQuery([mun, prov, RD]), label: "municipio-texto", precision: 3 });

  if (prov)
    intentos.push({ url: structuredQuery(null, c.provincia), label: "provincia", precision: 4 });

  for (const intento of intentos) {
    try {
      const r = await fetch(intento.url, { headers: { "Accept-Language": "es" } });
      const d = await r.json();
      if (d.length)
        return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), precision: intento.precision, label: intento.label };
      await new Promise(res => setTimeout(res, 400));
    } catch { }
  }
  return null;
};

const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ─── Algoritmo vecino más cercano para organizar por cercanía ──────────────
const organizarPorCercania = (clientes) => {
  const conCoords = clientes.filter(c => (c.cliente ?? c).latitud && (c.cliente ?? c).longitud);
  const sinCoords = clientes.filter(c => !(c.cliente ?? c).latitud || !(c.cliente ?? c).longitud);
  if (conCoords.length < 2) return clientes;

  const dist = (a, b) => {
    const ca = a.cliente ?? a; const cb = b.cliente ?? b;
    const dLat = (ca.latitud - cb.latitud) * Math.PI / 180;
    const dLon = (ca.longitud - cb.longitud) * Math.PI / 180;
    const x = Math.sin(dLat/2)**2 + Math.cos(ca.latitud*Math.PI/180)*Math.cos(cb.latitud*Math.PI/180)*Math.sin(dLon/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  };

  const ruta = [conCoords[0]];
  const restantes = [...conCoords.slice(1)];
  while (restantes.length) {
    const ultimo = ruta[ruta.length - 1];
    let minDist = Infinity, minIdx = 0;
    restantes.forEach((c, i) => { const d = dist(ultimo, c); if (d < minDist) { minDist = d; minIdx = i; } });
    ruta.push(restantes.splice(minIdx, 1)[0]);
  }
  return [...ruta, ...sinCoords];
};
const fmtFechaLarga = (f) => new Intl.DateTimeFormat("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(f + "T12:00:00"));
const FREQ = { DIARIO: "Diario", SEMANAL: "Semanal", QUINCENAL: "Quincenal", MENSUAL: "Mensual" };

// ─── Estilos globales ─────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("rutas-css")) {
  const s = document.createElement("style"); s.id = "rutas-css";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    .rutas-root * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }

    @keyframes fadeUp   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
    @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
    @keyframes slideIn  { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
    @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.12);opacity:.7} }

    .anim-fadeup  { animation: fadeUp  .3s cubic-bezier(.22,.61,.36,1) both }
    .anim-fadein  { animation: fadeIn  .25s ease both }
    .anim-slidein { animation: slideIn .3s cubic-bezier(.22,.61,.36,1) both }

    .leaflet-container { border-radius:1rem; z-index:0 }

    .rpin { width:30px; height:30px; border-radius:50%; border:2.5px solid #fff;
      box-shadow:0 3px 8px rgba(0,0,0,.25); display:flex; align-items:center;
      justify-content:center; color:#fff; font-size:11px; font-weight:800; background:#2563eb;
      transition:transform .15s; }
    .rpin:hover { transform:scale(1.15) }
    .rpin.at  { background:#dc2626 }
    .rpin.vis { background:#16a34a }

    .stat-card { transition: transform .2s, box-shadow .2s; }
    .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.08); }

    .ruta-card { transition: transform .2s, box-shadow .2s; }
    .ruta-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(37,99,235,.1); }

    .cliente-item { transition: box-shadow .15s; }
    .cliente-item:hover { box-shadow: 0 4px 16px rgba(0,0,0,.07); }

    .drag-handle { cursor: grab; touch-action: none; }
    .drag-handle:active { cursor: grabbing; }
    .drag-over { border-color: #2563eb !important; background: #eff6ff !important; transform: scale(1.01); }
    .drag-ghost { opacity: .4; }

    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }

    .thin-scroll::-webkit-scrollbar { width:4px; height:4px }
    .thin-scroll::-webkit-scrollbar-track { background:transparent }
    .thin-scroll::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:4px }

    .mobile-safe-bottom { padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); }

    .tab-pill { transition: all .2s; }
    .tab-pill.active { background:#1d4ed8; color:#fff; box-shadow:0 4px 12px rgba(29,78,216,.25); }

    @keyframes check-pop { 0%{transform:scale(0)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
    .check-pop { animation: check-pop .2s cubic-bezier(.22,.61,.36,1) }

    .modal-backdrop { backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }

    .input-field:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.12); }

    .progress-bar-track { background:#e5e7eb; border-radius:99px; overflow:hidden; }
    .progress-bar-fill  { height:100%; border-radius:99px; background:linear-gradient(90deg,#2563eb,#3b82f6); transition:width .5s cubic-bezier(.22,.61,.36,1); }

    @media (max-width:640px) {
      .hide-mobile { display:none !important }
      .full-mobile { width:100% !important }
    }
  `;
  document.head.appendChild(s);
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl text-sm font-semibold anim-fadeup ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
      style={{ maxWidth: "calc(100vw - 2rem)" }}>
      <span className="text-base">{type === "success" ? "✅" : "❌"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-40 hover:opacity-80 text-lg leading-none">×</button>
    </div>
  );
};

const Spin = ({ sm }) => (
  <div className={`flex justify-center ${sm ? "py-3" : "py-16"}`}>
    <div className={`border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin ${sm ? "w-5 h-5" : "w-8 h-8"}`} />
  </div>
);

const EmptyState = ({ icon, title, subtitle, action, actionLabel }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm py-16 px-6 text-center anim-fadeup">
    <div className="text-5xl mb-4">{icon}</div>
    <p className="font-bold text-gray-800 text-lg">{title}</p>
    {subtitle && <p className="text-sm text-gray-400 mt-1.5 max-w-xs mx-auto">{subtitle}</p>}
    {action && (
      <button onClick={action}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
        {actionLabel}
      </button>
    )}
  </div>
);

// ─── MapaRuta ─────────────────────────────────────────────────────────────────
const MapaRuta = ({ clientes, visitadoIds = [] }) => {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [geocoded, setGeo] = useState([]);

  useEffect(() => {
    let dead = false;
    loadLeaflet().then(L => {
      if (dead || !divRef.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const m = L.map(divRef.current, { zoomControl: true }).setView([18.74, -70.16], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
      }).addTo(m);
      mapRef.current = m;
      setReady(true); setBusy(false);
    });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!clientes?.length || !ready) return;
    setBusy(true);
    (async () => {
      const out = [];
      const sinCoords = [];

      for (let i = 0; i < clientes.length; i++) {
        const c = clientes[i];
        const cli = c.cliente ?? c;
        if (cli.latitud && cli.longitud) {
          const label = cli.coordsAproximadas ? "municipio" : "exacta";
          out[i] = { ...c, coords: { lat: cli.latitud, lng: cli.longitud, precision: cli.coordsAproximadas ? 3 : 1, label } };
        } else {
          out[i] = { ...c, coords: null };
          sinCoords.push(i);
        }
      }

      for (const i of sinCoords) {
        const cli = clientes[i].cliente ?? clientes[i];
        const coords = await geocode(cli);

        out[i] = { ...out[i], coords };

        if (coords && cli.id) {
          api.patch(`/clientes/${cli.id}`, {
            latitud: coords.lat,
            longitud: coords.lng,
            coordsAproximadas: true,
          }).catch(() => { });
        }

        if (i !== sinCoords[sinCoords.length - 1]) await new Promise(r => setTimeout(r, 1150));
      }

      setGeo(out); setBusy(false);
    })();
  }, [clientes, ready]);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    const m = mapRef.current;
    m.eachLayer(l => { if (l._ruta) m.removeLayer(l); });
    const pts = geocoded.filter(c => c.coords);
    if (!pts.length) return;
    const bounds = [];

    const precLabels = {
      "exacta": { icon: "📍", text: "Ubicación exacta (pin)", color: "#16a34a" },
      "direccion-sector": { icon: "🏠", text: "Calle + sector", color: "#2563eb" },
      "direccion": { icon: "🏠", text: "Nivel calle", color: "#2563eb" },
      "sector": { icon: "🏘", text: "Sector / barrio", color: "#7c3aed" },
      "municipio": { icon: "🏙", text: "Municipio (aprox.)", color: "#d97706" },
      "municipio-texto": { icon: "🏙", text: "Municipio (aprox.)", color: "#d97706" },
      "provincia": { icon: "🗺", text: "Provincia (aprox.)", color: "#dc2626" },
    };

    pts.forEach((c, i) => {
      const { lat, lng } = c.coords;
      const cli = c.cliente ?? c;
      const vis = visitadoIds.includes(c.rutaClienteId ?? c.id);
      const at = c.tieneAtrasados;
      const esExacta = c.coords.label === "exacta";
      const esCacheada = (c.cliente ?? c)?.coordsAproximadas === true;

      let pinStyle = "";
      if (esExacta) pinStyle = "border-color:#fbbf24;border-width:3px";
      else if (esCacheada) pinStyle = "border-color:#9ca3af;border-style:dashed";
      const pinHtml = `<div class="rpin ${vis ? "vis" : at ? "at" : ""}" style="${pinStyle}">${i + 1}</div>`;
      const icon = L.divIcon({ className: "", html: pinHtml, iconSize: [30, 30], iconAnchor: [15, 15] });
      const mk = L.marker([lat, lng], { icon }); mk._ruta = true;

      const prec = precLabels[c.coords.label] ?? precLabels["provincia"];
      const dir = [cli.direccion, cli.sector, cli.municipio, cli.provincia].filter(Boolean).join(", ") || "Sin dirección";
      const obsHtml = c.observacion
        ? `<div style="background:#fffbeb;border:1px solid #fde68a;padding:4px 8px;border-radius:6px;font-size:11px;margin-top:5px">💡 ${c.observacion}</div>`
        : "";
      const cobraHtml = c.totalACobrar > 0
        ? `<div style="margin-top:5px;font-size:13px;font-weight:700;color:#16a34a">💵 ${formatCurrency(c.totalACobrar)}</div>`
        : "";
      const precHtml = `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:${prec.color}18;border:1px solid ${prec.color}40">
        <span style="font-size:11px">${prec.icon}</span>
        <span style="font-size:10px;font-weight:700;color:${prec.color}">${prec.text}</span>
      </div>`;

      mk.bindPopup(`<div style="min-width:180px;font-family:'Plus Jakarta Sans',system-ui;padding:2px 0;line-height:1.4">
        <div style="font-size:14px;font-weight:700;color:#111827">${cli.nombre} ${cli.apellido}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">${dir}</div>
        ${obsHtml}
        ${cobraHtml}
        ${precHtml}
      </div>`, { maxWidth: 240 });

      mk.addTo(m); bounds.push([lat, lng]);
    });

    if (pts.length > 1) {
      const pl = L.polyline(bounds, { color: "#2563eb", weight: 3, opacity: .5, dashArray: "8,10" });
      pl._ruta = true; pl.addTo(m);
    }
    m.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [geocoded, visitadoIds]);

  const withCoords = geocoded.filter(c => c.coords).length;
  const exactaCount = geocoded.filter(c => c.coords?.label === "exacta" && !(c.cliente ?? c)?.coordsAproximadas).length;
  const cachedCount = geocoded.filter(c => c.coords && (c.cliente ?? c)?.coordsAproximadas === true).length;
  const geocodCount = geocoded.filter(c => c.coords && c.coords.label !== "exacta" && !(c.cliente ?? c)?.coordsAproximadas).length;

  return (
    <div className="relative">
      <div ref={divRef} style={{ height: "300px", width: "100%" }} className="rounded-2xl border border-gray-200" />
      {busy && (
        <div className="absolute inset-0 bg-white/85 rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold">{!ready ? "Cargando mapa…" : "Ubicando clientes…"}</p>
        </div>
      )}
      {!busy && withCoords > 0 && (
        <div className="absolute top-2 right-2 z-[400] bg-white/95 border border-gray-200 rounded-xl shadow-sm px-3 py-2 text-[10px] font-semibold space-y-1">
          {exactaCount > 0 && <div className="flex items-center gap-1.5"><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563eb", border: "2px solid #fbbf24" }} />📍 {exactaCount} exacta{exactaCount !== 1 ? "s" : ""}</div>}
          {cachedCount > 0 && <div className="flex items-center gap-1.5"><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563eb", border: "1.5px dashed #9ca3af" }} />💾 {cachedCount} cacheada{cachedCount !== 1 ? "s" : ""}</div>}
          {geocodCount > 0 && <div className="flex items-center gap-1.5"><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />~ {geocodCount} geocodif.</div>}
        </div>
      )}
      {!busy && geocoded.length > 0 && withCoords === 0 && (
        <div className="absolute inset-0 bg-white/92 rounded-2xl flex flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-3xl">📍</p>
          <p className="text-sm font-bold text-gray-600">No se encontraron ubicaciones</p>
          <p className="text-xs text-gray-400 max-w-xs">Los clientes deben tener al menos municipio o provincia registrados.</p>
        </div>
      )}
    </div>
  );
};

// ─── ModalRuta ────────────────────────────────────────────────────────────────
const ModalRuta = ({ ruta, onConfirm, onClose, loading }) => {
  const [nombre, setNombre] = useState(ruta?.nombre ?? "");
  const [desc, setDesc] = useState(ruta?.descripcion ?? "");

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(15,23,42,0.6)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 0
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-md sm:mb-8 sm:mx-4 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", animation: "fadeUp 0.2s ease" }}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">🗺️</div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{ruta ? "Editar ruta" : "Nueva ruta"}</h3>
            <p className="text-xs text-gray-400">Nombre y descripción</p>
          </div>
        </div>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 tracking-wide uppercase">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="ej: Zona Norte, Ruta del lunes…" autoFocus
              className="input-field w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 tracking-wide uppercase">Descripción <span className="font-normal normal-case text-gray-400">(opcional)</span></label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Notas adicionales…"
              className="input-field w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 resize-none transition-all" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">Cancelar</button>
          <button onClick={() => onConfirm({ nombre, descripcion: desc })} disabled={loading || !nombre.trim()}
            className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : ruta ? "Guardar cambios" : "Crear ruta"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ─── ModalObs ─────────────────────────────────────────────────────────────────
const ModalObs = ({ rc, rutaId, onSaved, onClose }) => {
  const [obs, setObs] = useState(rc.observacion || rc.cliente?.observaciones || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/rutas/${rutaId}/clientes/${rc.id}`, { observacion: obs }); onSaved(); }
    catch { } finally { setSaving(false); }
  };

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(15,23,42,0.6)",
        display: "flex", alignItems: "flex-end", justifyContent: "center"
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-md sm:mb-8 sm:mx-4 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", animation: "fadeUp 0.2s ease" }}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-xl">💡</div>
          <div>
            <h3 className="font-bold text-gray-900">Observación de ubicación</h3>
            <p className="text-xs text-gray-400">{rc.cliente.nombre} {rc.cliente.apellido}</p>
          </div>
        </div>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} autoFocus
          placeholder="ej: cerca de la casa roja, portón azul, 2do piso…"
          className="input-field w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 resize-none mb-4 transition-all" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-bold">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center transition-all active:scale-95">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ─── ModalMasa ────────────────────────────────────────────────────────────────
const ModalMasa = ({ rutaId, yaEnRuta, onDone, onClose }) => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [provincia, setProv] = useState("");
  const [municipio, setMun] = useState("");
  const [munis, setMunis] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [pag, setPag] = useState(1);
  const [filtroEst, setFiltroEst] = useState("");
  const [usarRango, setUsarRango] = useState(false);
  const [rangoVenc, setRangoVenc] = useState({ desde: "", hasta: "" });
  const PP = 20;

  useEffect(() => {
    Promise.all([
      api.get("/clientes?activo=true&limit=1000"),
      api.get("/prestamos?limit=2000"),
    ]).then(([rc, rp]) => {
      const prestamos = Array.isArray(rp.data) ? rp.data : (rp.data?.data ?? []);
      const estadoMap = {};
      const venceMap = {};
      for (const p of prestamos) {
        const cid = p.clienteId;
        if (!estadoMap[cid] || p.estado === "ATRASADO") estadoMap[cid] = p.estado;
        else if (estadoMap[cid] !== "ATRASADO" && p.estado === "ACTIVO") estadoMap[cid] = p.estado;
        for (const cuota of (p.cuotas ?? [])) {
          if (!cuota.pagada) {
            if (!venceMap[cid]) venceMap[cid] = [];
            venceMap[cid].push(cuota.fechaVencimiento);
          }
        }
      }
      const clientesRaw = Array.isArray(rc.data) ? rc.data : (rc.data?.data ?? []);
      const clientes = clientesRaw
        .filter(c => !yaEnRuta.includes(c.id))
        .map(c => ({ ...c, estadoPrestamo: estadoMap[c.id] ?? null, _cuotasVenc: venceMap[c.id] ?? [] }));
      setTodos(clientes);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!provincia) { setMunis([]); setMun(""); return; }
    setMunis(PROVINCIAS_MUNICIPIOS[provincia] ?? []);
    setMun("");
  }, [provincia]);

  const filtrados = useMemo(() => todos.filter(c => {
    const q = busqueda.toLowerCase().trim();
    const qSinGuiones = q.replace(/-/g, "");
    const mb = !q ||
      `${c.nombre ?? ""} ${c.apellido ?? ""}`.toLowerCase().includes(q) ||
      (qSinGuiones && (c.cedula ?? "").replace(/\D/g, "").includes(qSinGuiones)) ||
      (c.sector ?? "").toLowerCase().includes(q) ||
      (c.direccion ?? "").toLowerCase().includes(q) ||
      (c.municipio ?? "").toLowerCase().includes(q) ||
      (c.provincia ?? "").toLowerCase().includes(q);
    const mp = !provincia || c.provincia === provincia;
    const mm = !municipio || c.municipio === municipio;
    const me = !filtroEst ||
      (filtroEst === "SIN_PRESTAMO" ? !c.estadoPrestamo :
        filtroEst === "ACTIVO" ? c.estadoPrestamo === "ACTIVO" :
          filtroEst === "ATRASADO" ? c.estadoPrestamo === "ATRASADO" :
            c.estadoPrestamo === filtroEst);
    let ms = true;
    if (usarRango && (rangoVenc.desde || rangoVenc.hasta)) {
      ms = false;
      const desde = rangoVenc.desde ? new Date(rangoVenc.desde + "T00:00:00") : null;
      const hasta = rangoVenc.hasta ? new Date(rangoVenc.hasta + "T23:59:59") : null;
      for (const fv of (c._cuotasVenc ?? [])) {
        const d = new Date(fv);
        if ((!desde || d >= desde) && (!hasta || d <= hasta)) { ms = true; break; }
      }
    }
    return mb && mp && mm && me && ms;
  }), [todos, busqueda, provincia, municipio, filtroEst, usarRango, rangoVenc]);

  useEffect(() => setPag(1), [busqueda, provincia, municipio, filtroEst, usarRango, rangoVenc]);

  const paginados = filtrados.slice((pag - 1) * PP, pag * PP);
  const totalPags = Math.max(1, Math.ceil(filtrados.length / PP));
  const todosCheck = filtrados.length > 0 && filtrados.every(c => sel.has(c.id));

  const toggleTodos = () => {
    const ids = new Set(filtrados.map(c => c.id));
    setSel(prev => { const n = new Set(prev); todosCheck ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  };
  const toggle = id => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const limpiarFiltros = () => { setFiltroEst(""); setUsarRango(false); setRangoVenc({ desde: "", hasta: "" }); };
  const hayFiltrosActivos = filtroEst || usarRango;

  const atajosFecha = [
    { label: "Hoy", fn: () => { const h = new Date().toISOString().slice(0, 10); setRangoVenc({ desde: h, hasta: h }); } },
    {
      label: "Esta semana", fn: () => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
        const lun = new Date(hoy); lun.setDate(hoy.getDate() - dow);
        const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
        const fmt = d => d.toISOString().slice(0, 10);
        setRangoVenc({ desde: fmt(lun), hasta: fmt(dom) });
      }
    },
    {
      label: "Próx. 7 días", fn: () => {
        const hoy = new Date(); const fin = new Date(hoy); fin.setDate(hoy.getDate() + 7);
        const fmt = d => d.toISOString().slice(0, 10);
        setRangoVenc({ desde: fmt(hoy), hasta: fmt(fin) });
      }
    },
    {
      label: "Este mes", fn: () => {
        const hoy = new Date();
        const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        const fmt = d => d.toISOString().slice(0, 10);
        setRangoVenc({ desde: fmt(ini), hasta: fmt(fin) });
      }
    },
  ];

  const confirmar = async () => {
    if (!sel.size) return;
    setSaving(true);
    try {
      await Promise.all([...sel].map(clienteId => api.post(`/rutas/${rutaId}/clientes`, { clienteId })));
      onDone(sel.size);
    } catch (e) { alert(e.response?.data?.message ?? "Error"); }
    finally { setSaving(false); }
  };

  const content = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        overflowY: "auto", background: "rgba(15,23,42,0.65)"
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ minHeight: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem" }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ animation: "fadeUp 0.2s ease" }}>

          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Agregar clientes</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {sel.size > 0
                  ? <span className="text-blue-600 font-bold">{sel.size} seleccionado{sel.size !== 1 ? "s" : ""}</span>
                  : "Selecciona uno o varios clientes"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg transition-all">×</button>
          </div>

          <div className="px-6 py-3 border-b border-gray-100 space-y-3 bg-white">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, cédula, sector…"
                className="input-field w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-gray-50 transition-all" />
            </div>

            <div className="flex gap-2">
              <select value={provincia} onChange={e => setProv(e.target.value)}
                className="input-field flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700 transition-all">
                <option value="">Todas las provincias</option>
                {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {munis.length > 0 && (
                <select value={municipio} onChange={e => setMun(e.target.value)}
                  className="input-field flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700 transition-all">
                  <option value="">Todos los municipios</option>
                  {munis.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado de pago</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: "", label: "Todos", icon: null },
                  { key: "ACTIVO", label: "Al día", icon: "✅" },
                  { key: "ATRASADO", label: "Atrasados", icon: "⚠️" },
                  { key: "SIN_PRESTAMO", label: "Sin préstamo", icon: "🆕" },
                ].map(f => (
                  <button key={f.key} type="button" onClick={() => setFiltroEst(f.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${filtroEst === f.key
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}>
                    {f.icon && <span>{f.icon}</span>}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pb-0.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setUsarRango(v => !v)}
                    className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${usarRango ? "bg-amber-500" : "bg-gray-200"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${usarRango ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                  <span className="text-xs font-bold text-gray-600">📅 Filtrar por vencimiento de cuota</span>
                </label>
                {hayFiltrosActivos && (
                  <button type="button" onClick={limpiarFiltros}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-all">
                    Limpiar filtros
                  </button>
                )}
              </div>

              {usarRango && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 space-y-2.5 anim-fadeup">
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[130px]">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">Desde</span>
                      <input type="date" value={rangoVenc.desde}
                        onChange={e => setRangoVenc(r => ({ ...r, desde: e.target.value }))}
                        className="input-field flex-1 border border-amber-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:ring-amber-400 transition-all" />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-[130px]">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">Hasta</span>
                      <input type="date" value={rangoVenc.hasta}
                        onChange={e => setRangoVenc(r => ({ ...r, hasta: e.target.value }))}
                        className="input-field flex-1 border border-amber-200 rounded-xl px-2.5 py-2 text-xs bg-white focus:ring-amber-400 transition-all" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {atajosFecha.map(a => (
                      <button key={a.label} type="button" onClick={a.fn}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all whitespace-nowrap shadow-sm">
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {filtrados.length > 0 && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={todosCheck} onChange={toggleTodos} className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-xs font-semibold text-gray-600">
                    Seleccionar todos los filtrados
                    <span className="ml-1 text-blue-600">({filtrados.length})</span>
                  </span>
                </label>
                {sel.size > 0 && (
                  <button onClick={() => setSel(new Set())} className="text-xs text-red-500 hover:text-red-700 font-semibold">
                    Limpiar selección
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="thin-scroll" style={{ maxHeight: "calc(100vh - 520px)", minHeight: "180px", overflowY: "auto" }}>
            {loading ? (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-xs text-gray-400 font-medium">Cargando clientes y préstamos…</p>
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🔍</p>
                <p className="font-semibold">Sin resultados</p>
                <p className="text-xs mt-1">Prueba con otro nombre o filtro</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {paginados.map(c => (
                  <label key={c.id} className={`flex items-center gap-3 px-6 py-3.5 cursor-pointer transition-colors ${sel.has(c.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 rounded accent-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{c.nombre} {c.apellido}</p>
                        {c.estadoPrestamo === "ATRASADO" && (
                          <span className="badge bg-red-100 text-red-700">⚠ Atrasado</span>
                        )}
                        {c.estadoPrestamo === "ACTIVO" && (
                          <span className="badge bg-emerald-100 text-emerald-700">✅ Al día</span>
                        )}
                        {!c.estadoPrestamo && (
                          <span className="badge bg-gray-100 text-gray-500">Sin préstamo</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono">{formatCedula(c.cedula ?? "")}</p>
                      {(c.direccion || c.sector || c.municipio) && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          📍 {[c.direccion, c.sector, c.municipio, c.provincia].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    {sel.has(c.id) && (
                      <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 check-pop">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {totalPags > 1 && (
            <div className="px-6 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-xs text-gray-400">{(pag - 1) * PP + 1}–{Math.min(pag * PP, filtrados.length)} de {filtrados.length}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPag(p => Math.max(1, p - 1))} disabled={pag === 1}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center">‹</button>
                <span className="px-2.5 py-1 text-xs text-gray-600 font-semibold">{pag}/{totalPags}</span>
                <button onClick={() => setPag(p => Math.min(totalPags, p + 1))} disabled={pag === totalPags}
                  className="w-7 h-7 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center">›</button>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-white">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">Cancelar</button>
            <button onClick={confirmar} disabled={saving || sel.size === 0}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95">
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : `Agregar${sel.size > 0 ? ` ${sel.size}` : ""} cliente${sel.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ─── VistaDia ─────────────────────────────────────────────────────────────────
const VistaDia = ({ rutaId, rutaNombre, onVolver, showToast }) => {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(hoyStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("todos");
  const [mapa, setMapa] = useState(false);
  const [cobradoHoy, setCobradoHoy] = useState(0);
  const [ordenLocal, setOrdenLocal] = useState(null);

  // Estado para cobros rápidos
  const [cobrandoIds, setCobrandoIds] = useState(new Set());
  const [cobradoOkIds, setCobradoOkIds] = useState(new Set());

  // Estado para recibo y confirmación
  const [reciboData, setReciboData] = useState(null);
  const [showRecibo, setShowRecibo] = useState(false);
  const [confirmCobro, setConfirmCobro] = useState(null);

  const hoy = hoyStr();

  // ── Helpers de cuota ──────────────────────────────────────────────────────
  const getMontoProximaCuota = (clienteData) => {
    const prestamo = clienteData.prestamos?.find(p => ["ACTIVO", "ATRASADO"].includes(p.estado));
    if (!prestamo?.proximaCuota) return null;
    const cuota = prestamo.proximaCuota;
    return {
      prestamoId: prestamo.id,
      cuotaId:    cuota.id,
      monto:      cuota.monto + (cuota.mora || 0),
      numero:     cuota.numero,
      tieneMora:  (cuota.mora || 0) > 0,
    };
  };

  const puedeCobroRapido = (clienteData) => {
    if (!clienteData.tienePrestamos || clienteData.visitadoHoy) return false;
    return !!getMontoProximaCuota(clienteData);
  };

  const getMontoCobrar = (clienteData) => {
    return getMontoProximaCuota(clienteData)?.monto ?? 0;
  };

  // ── Cargar datos ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    setOrdenLocal(null);
    try { const r = await api.get(`/rutas/${rutaId}/dia?fecha=${fecha}`); setData(r.data); }
    catch { } finally { setLoading(false); }
  }, [rutaId, fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get(`/pagos/resumen`).then(r => setCobradoHoy(r.data?.cobradoHoy ?? 0)).catch(() => {});
  }, []);

  // ── Marcar visitado — SIN cargar() al final ───────────────────────────────
  // ✅ FIX: Eliminado cargar() para evitar recarga completa de la pantalla
  const toggleVisit = async (rcId, actual) => {
    // Actualización optimista inmediata en UI
    setData(p => ({
      ...p,
      clientes: p.clientes.map(c => c.rutaClienteId === rcId ? { ...c, visitadoHoy: !actual } : c),
      resumen: { ...p.resumen, visitadosHoy: p.resumen.visitadosHoy + (!actual ? 1 : -1) },
    }));
    try {
      await api.patch(`/rutas/clientes/${rcId}/visita`, { visitado: !actual });
      showToast(!actual ? "Marcado como visitado ✓" : "Visita desmarcada");
      // ✅ NO se llama cargar() — la actualización optimista es suficiente
    } catch {
      // Revertir si falla
      setData(p => ({
        ...p,
        clientes: p.clientes.map(c => c.rutaClienteId === rcId ? { ...c, visitadoHoy: actual } : c),
        resumen: { ...p.resumen, visitadosHoy: p.resumen.visitadosHoy + (actual ? 1 : -1) },
      }));
      showToast("Error al actualizar", "error");
    }
  };

  // ── Cobro rápido ──────────────────────────────────────────────────────────
  const ejecutarCobroRapido = async (clienteData) => {
    const rcId = clienteData.rutaClienteId;
    if (cobrandoIds.has(rcId)) return;

    const infoCuota = getMontoProximaCuota(clienteData);
    if (!infoCuota) {
      showToast("No hay cuota pendiente para cobrar", "error");
      return;
    }

    const { prestamoId, cuotaId, monto, numero } = infoCuota;

    setCobrandoIds(prev => new Set(prev).add(rcId));

    try {
      const res = await api.post("/pagos", {
        prestamoId,
        cuotaId,
        montoPagado: monto,
        metodo: "EFECTIVO",
      });

      setCobradoOkIds(prev => new Set(prev).add(rcId));
      setCobradoHoy(prev => prev + monto);

      // Marcar como visitado en backend
      await api.patch(`/rutas/clientes/${rcId}/visita`, { visitado: true });

      // Guardar recibo
      if (res.data && Object.keys(res.data).length > 0) {
        setReciboData(res.data);
        setShowRecibo(true);
      }

      // ✅ Actualización local — sin recargar todo
      setData(prev => {
        if (!prev) return prev;
        const nuevosClientes = prev.clientes.map(rc =>
          rc.rutaClienteId === rcId
            ? { ...rc, visitadoHoy: true, _debeVisitar: false, _tieneAtrasados: false }
            : rc
        );
        const visitadosHoy = nuevosClientes.filter(c => c.visitadoHoy).length;
        return {
          ...prev,
          clientes: nuevosClientes,
          resumen: { ...prev.resumen, visitadosHoy },
        };
      });

      showToast(`✅ Cobrado Cuota #${numero} · RD$ ${formatCurrency(monto)}`);

    } catch (e) {
      showToast(e.response?.data?.message ?? "Error al cobrar, intenta nuevamente", "error");
    } finally {
      setCobrandoIds(prev => {
        const n = new Set(prev);
        n.delete(rcId);
        return n;
      });
    }
  };

  // ── Organizar por cercanía ────────────────────────────────────────────────
  const handleCercaniaDia = () => {
    const clientes = data?.clientes ?? [];
    const conCoords = clientes.filter(c => c.cliente?.latitud && c.cliente?.longitud);
    if (conCoords.length < 2) {
      showToast("Se necesitan al menos 2 clientes con coordenadas", "error");
      return;
    }
    const nuevo = organizarPorCercania(clientes);
    setOrdenLocal(nuevo);
    showToast(`✓ ${conCoords.length} clientes organizados por cercanía`);
  };

  const clientesOrdenados = ordenLocal ?? data?.clientes ?? [];
  const visitadoIds = clientesOrdenados.filter(c => c.visitadoHoy).map(c => c.rutaClienteId);
  const filtrados = clientesOrdenados.filter(c => {
    if (tab === "hoy") return c.debeVisitar && !c.visitadoHoy;
    if (tab === "visitados") return c.visitadoHoy;
    return true;
  });
  const conCoordsDia = (data?.clientes ?? []).filter(c => c.cliente?.latitud && c.cliente?.longitud).length;

  const progreso = data ? Math.round((data.resumen.visitadosHoy / Math.max(data.resumen.aVisitarHoy, 1)) * 100) : 0;
  const fmt = (n) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 0 }).format(n);

  const esFechaFutura = fecha > hoy;
  const sinSubRutaFutura = esFechaFutura && !data?.esSubRuta && !loading;

  return (
    <div className="space-y-4 anim-fadeup">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onVolver} className="w-9 h-9 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-all shrink-0">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-gray-900 truncate text-lg">{rutaNombre}</h2>
            {data?.esSubRuta && (
              <span className="badge bg-amber-100 text-amber-700">🗓️ Sub-ruta del día</span>
            )}
            {ordenLocal && !sinSubRutaFutura && (
              <span className="badge bg-violet-100 text-violet-700">🧭 Por cercanía</span>
            )}
          </div>
          <p className="text-xs text-gray-400 capitalize">{fmtFechaLarga(fecha)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {conCoordsDia >= 2 && !sinSubRutaFutura && (
            <button onClick={handleCercaniaDia} title="Organizar por cercanía"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${ordenLocal ? "bg-violet-600 text-white border-violet-600 shadow-sm" : "bg-white text-violet-600 border-violet-200 hover:bg-violet-50"}`}>
              🧭 <span className="hide-mobile">Cercanía</span>
            </button>
          )}
          <button onClick={() => setMapa(m => !m)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${mapa ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            🗺️ <span className="hide-mobile">{mapa ? "Ocultar" : "Mapa"}</span>
          </button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="input-field border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
        </div>
      </div>

      {/* Banner cobrado del día */}
      {cobradoHoy > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 anim-fadeup">
          <span className="text-2xl">💰</span>
          <div>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Cobrado hoy</p>
            <p className="text-lg font-extrabold text-emerald-700">{fmt(cobradoHoy)}</p>
          </div>
        </div>
      )}

      {/* Banner: fecha futura sin sub-ruta */}
      {sinSubRutaFutura && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-8 text-center anim-fadeup">
          <div className="text-5xl mb-4">📅</div>
          <p className="font-bold text-gray-800 text-lg">Ruta no generada para este día</p>
          <p className="text-sm text-gray-400 mt-1.5 max-w-xs mx-auto">
            El día <strong>{fmtFechaLarga(fecha)}</strong> aún no tiene una ruta generada.
            Ve a <strong>Gestionar</strong> y usa <strong>🗓️ Ruta del día</strong> para seleccionar los clientes.
          </p>
          <button onClick={onVolver}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
            ⚙️ Ir a Gestionar
          </button>
        </div>
      )}

      {loading ? <Spin /> : sinSubRutaFutura ? null : !data ? null : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "A visitar hoy", v: data.resumen.aVisitarHoy, icon: "📋", c: "text-blue-700", bg: "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100" },
              { label: "Visitados", v: data.resumen.visitadosHoy, icon: "✅", c: "text-emerald-700", bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100" },
              { label: "Con atrasos", v: data.resumen.conAtrasados, icon: "⚠️", c: "text-red-700", bg: "bg-gradient-to-br from-red-50 to-red-100/50 border-red-100" },
              { label: "Total a cobrar", v: formatCurrency(data.resumen.totalACobrarHoy), icon: "💵", c: "text-gray-800", bg: "bg-gradient-to-br from-gray-50 to-slate-100/50 border-gray-100" },
            ].map(k => (
              <div key={k.label} className={`stat-card ${k.bg} border rounded-2xl px-4 py-3.5`}>
                <p className="text-lg mb-1">{k.icon}</p>
                <p className={`text-xl font-bold ${k.c}`}>{k.v}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {data.resumen.aVisitarHoy > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">Progreso del día</span>
                <span className="text-sm font-bold text-blue-600">{progreso}%</span>
              </div>
              <div className="progress-bar-track h-2">
                <div className="progress-bar-fill" style={{ width: `${progreso}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">{data.resumen.visitadosHoy} de {data.resumen.aVisitarHoy} visitas completadas</p>
            </div>
          )}

          {mapa && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 anim-fadeup">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mapa de ruta · {data.clientes.length} clientes</p>
              <MapaRuta clientes={data.clientes} visitadoIds={visitadoIds} />
              <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                {[["🔵", "Pendiente"], ["🟢", "Visitado"], ["🔴", "Atrasado"]].map(([ico, lbl]) => (
                  <span key={lbl} className="text-[10px] text-gray-400 font-medium">{ico} {lbl}</span>
                ))}
                <span className="text-[10px] text-gray-300 font-medium">·</span>
                <span className="text-[10px] text-amber-500 font-semibold">⭕ Borde dorado = pin exacto</span>
              </div>
            </div>
          )}

          <div className="flex gap-1.5 bg-gray-100 p-1 rounded-2xl">
            {[
              { key: "todos", label: `Todos`, count: data.clientes.length },
              { key: "hoy", label: `Por cobrar`, count: data.resumen.aVisitarHoy - data.resumen.visitadosHoy },
              { key: "visitados", label: `Visitados`, count: data.resumen.visitadosHoy },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`tab-pill flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${tab === t.key ? "active" : "text-gray-500 hover:text-gray-700"}`}>
                <span className="truncate">{t.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-white/25 text-white" : "bg-white text-gray-500"}`}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtrados.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400">
                <div className="text-4xl mb-2">{tab === "visitados" ? "📋" : "🎉"}</div>
                <p className="font-semibold text-gray-500">
                  {tab === "visitados" ? "Ninguno marcado como visitado aún" : tab === "hoy" ? "¡Sin cobros pendientes!" : "No hay clientes en esta ruta"}
                </p>
              </div>
            ) : filtrados.map((c, idx) => (
              <div key={c.rutaClienteId}
                className={`cliente-item bg-white rounded-2xl border overflow-hidden transition-all ${cobradoOkIds.has(c.rutaClienteId) || c.visitadoHoy ? "border-emerald-200" : c.tieneAtrasados ? "border-red-200" : c.debeVisitar ? "border-blue-200" : "border-gray-100"}`}>

                <div className={`px-4 py-3 flex items-center justify-between gap-3 ${cobradoOkIds.has(c.rutaClienteId) || c.visitadoHoy ? "bg-emerald-50" : c.tieneAtrasados ? "bg-red-50" : c.debeVisitar ? "bg-blue-50" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${c.visitadoHoy ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-gray-500"}`}>
                      {c.visitadoHoy ? "✓" : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">{c.cliente.nombre} {c.cliente.apellido}</p>
                        {c.tieneAtrasados && <span className="badge bg-red-100 text-red-700">⚠ Atrasado</span>}
                        {c.visitadoHoy && <span className="badge bg-emerald-100 text-emerald-700">✓ Visitado</span>}
                      </div>
                      <p className="text-xs text-gray-400 font-mono">{formatCedula(c.cliente.cedula ?? "")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(() => {
                      const estaAtrasado = c.tieneAtrasados;
                      const enProgreso = cobrandoIds.has(c.rutaClienteId);
                      const cobroExitoso = cobradoOkIds.has(c.rutaClienteId);
                      const puedeRapido = puedeCobroRapido(c);

                      if (cobroExitoso || c.visitadoHoy) {
                        return (
                          <span className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                            ✅ Cobrado
                          </span>
                        );
                      }

                      if (enProgreso) {
                        return (
                          <span className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-500 whitespace-nowrap flex items-center gap-1.5">
                            <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            Cobrando...
                          </span>
                        );
                      }

                      if (puedeRapido) {
                        const montoCobrar = getMontoCobrar(c);
                        return (
                          <>
                            <button
                              onClick={() => {
                                if (!enProgreso) {
                                  setConfirmCobro({ cliente: c, monto: montoCobrar });
                                }
                              }}
                              disabled={enProgreso}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50 ${estaAtrasado ? "bg-red-600 border-red-600 text-white hover:bg-red-700" : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"}`}>
                              <span>Cobrar {formatCurrency(montoCobrar)}</span>
                            </button>
                            <button
                              onClick={() => {
                                const prestamo = c.prestamos?.[0];
                                if (prestamo) navigate(`/pagos?prestamoId=${prestamo.id}`);
                              }}
                              title="Más opciones"
                              className="px-2 py-2 rounded-xl text-xs font-bold border bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 transition-all active:scale-95">
                              ⋯
                            </button>
                          </>
                        );
                      }

                      if (c.tienePrestamos && !c.visitadoHoy) {
                        return (
                          <button
                            onClick={() => {
                              const prestamo = c.prestamos?.[0];
                              if (prestamo) navigate(`/pagos?prestamoId=${prestamo.id}`);
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold border bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200 transition-all active:scale-95 whitespace-nowrap">
                            ⋯ Abrir modal
                          </button>
                        );
                      }

                      return null;
                    })()}
                    <button onClick={() => toggleVisit(c.rutaClienteId, c.visitadoHoy)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 whitespace-nowrap ${c.visitadoHoy ? "bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50" : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-sm"}`}>
                      {c.visitadoHoy ? "Desmarcar" : "✓"}
                    </button>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-300 shrink-0 mt-0.5">📍</span>
                    <div>
                      {c.cliente.direccion
                        ? <p className="text-gray-700 text-sm">{c.cliente.direccion}{c.cliente.sector ? `, ${c.cliente.sector}` : ""}</p>
                        : <p className="text-gray-400 italic text-sm">Sin dirección registrada</p>}
                      {c.cliente.municipio && <p className="text-xs text-gray-400 mt-0.5">{c.cliente.municipio}{c.cliente.provincia ? `, ${c.cliente.provincia}` : ""}</p>}
                    </div>
                  </div>

                  {(() => {
                    const obs = c.observacion || c.cliente?.observaciones;
                    return obs ? (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <span className="text-amber-500 shrink-0 text-sm">💡</span>
                        <p className="text-xs text-amber-800 font-semibold">{obs}</p>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex items-center gap-2 flex-wrap">
                    {c.cliente.telefono && (
                      <a href={`tel:${c.cliente.telefono}`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 transition-colors">
                        📞 {c.cliente.telefono}
                      </a>
                    )}
                    {c.cliente.celular && (
                      <a href={`tel:${c.cliente.celular}`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 transition-colors">
                        📱 {c.cliente.celular}
                      </a>
                    )}
                    {c.cliente.latitud && c.cliente.longitud && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${c.cliente.latitud},${c.cliente.longitud}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 transition-colors">
                        🧭 Navegar
                      </a>
                    )}
                  </div>

                  {c.cuotasAVencer.length > 0 && (() => {
                    const proxCuota = c.cuotasAVencer[0];
                    const montoProximo = proxCuota?.total ?? 0;

                    return (
                      <div className="space-y-2 pt-1">
                        <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${c.tieneAtrasados ? "bg-red-100 border border-red-200" : "bg-blue-50 border border-blue-100"}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${c.tieneAtrasados ? "text-red-700" : "text-blue-700"}`}>
                              {c.tieneAtrasados ? "⚠ Cuota(s) vencida(s)" : "📅 Próxima cuota"}
                            </span>
                            {c.cuotasAVencer.length > 1 && (
                              <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full text-gray-500">
                                +{c.cuotasAVencer.length - 1} más
                              </span>
                            )}
                          </div>
                          <span className={`text-sm font-bold ${c.tieneAtrasados ? "text-red-700" : "text-blue-700"}`}>
                            {formatCurrency(montoProximo)}
                          </span>
                        </div>
                        {c.cuotasAVencer.length > 1 && (
                          <div className="flex items-center justify-between px-1 text-[10px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1">
                            <span>📊 {c.cuotasAVencer.length} cuotas pendientes</span>
                            <span className="font-semibold">{formatCurrency(c.totalACobrar)} total</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {c.cuotasAVencer.length === 0 && c.tieneAtrasados &&
                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs text-red-700 font-semibold">⚠ Préstamos atrasados — visitar para gestionar</div>}
                  {c.cuotasAVencer.length === 0 && !c.tieneAtrasados && c.tienePrestamos &&
                    <p className="text-xs text-gray-400 italic">Sin cuotas pendientes para hoy</p>}
                  {!c.tienePrestamos &&
                    <p className="text-xs text-gray-400 italic">Sin préstamos activos</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Confirmación de Cobro */}
      {confirmCobro && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 99999, padding: "1rem", boxSizing: "border-box"
          }}
          onClick={(e) => e.target === e.currentTarget && setConfirmCobro(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ animation: "fadeUp 0.2s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${confirmCobro.cliente.tieneAtrasados ? "bg-red-100" : "bg-emerald-100"}`}>
                  💵
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Confirmar cobro</h3>
                  <p className="text-xs text-gray-400">Revisa antes de confirmar</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Cliente</span>
                  <span className="text-sm font-bold text-gray-800">
                    {confirmCobro.cliente.cliente.nombre} {confirmCobro.cliente.cliente.apellido}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">Monto a cobrar</span>
                  <span className={`text-lg font-bold ${confirmCobro.cliente.tieneAtrasados ? "text-red-600" : "text-emerald-600"}`}>
                    RD$ {formatCurrency(confirmCobro.monto)}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmCobro(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const clienteData = confirmCobro.cliente;
                    setConfirmCobro(null);
                    await ejecutarCobroRapido(clienteData);
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95">
                  ✓ Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Recibo */}
      {showRecibo && reciboData && createPortal(
        <div
          style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            zIndex: 99999, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRecibo(false);
              setReciboData(null);
            }
          }}
        >
          <div style={{
            background: "white", borderRadius: "16px",
            width: "100%", maxWidth: "380px",
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 10px 40px rgba(0,0,0,0.25)"
          }}>
            <ReciboPago
              data={reciboData}
              onClose={() => {
                setShowRecibo(false);
                setReciboData(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── ModalGenerarDia ──────────────────────────────────────────────────────────
const ModalGenerarDia = ({ orden, selDia, setSelDia, fechaDia, setFechaDia, generando, onConfirmar, onClose }) => {
  const [busqDia, setBusqDia] = useState("");
  const [filtroEstDia, setFiltroEstDia] = useState("");
  const [filtroVencDia, setFiltroVencDia] = useState(false);
  const [rangoVencDia, setRangoVencDia] = useState({ desde: "", hasta: "" });

  const ordenFiltrado = useMemo(() => orden.filter(rc => {
    const cli = rc.cliente;
    const q = busqDia.toLowerCase().trim();
    const qd = q.replace(/\D/g, "");
    const mb = !q ||
      `${cli.nombre ?? ""} ${cli.apellido ?? ""}`.toLowerCase().includes(q) ||
      (qd && (cli.cedula ?? "").replace(/\D/g, "").includes(qd)) ||
      (cli.sector ?? "").toLowerCase().includes(q) ||
      (cli.municipio ?? "").toLowerCase().includes(q);
    const me = !filtroEstDia ||
      (filtroEstDia === "ATRASADO" ? rc._tieneAtrasados :
       filtroEstDia === "ACTIVO"   ? (rc._tienePrestamos && !rc._tieneAtrasados) :
       filtroEstDia === "HOY"      ? rc._debeVisitar : true);
    let ms = true;
    if (filtroVencDia && (rangoVencDia.desde || rangoVencDia.hasta)) {
      ms = false;
      const desde = rangoVencDia.desde ? new Date(rangoVencDia.desde + "T00:00:00") : null;
      const hasta  = rangoVencDia.hasta  ? new Date(rangoVencDia.hasta  + "T23:59:59") : null;
      for (const fv of (rc._cuotasVenc ?? [])) {
        const d = new Date(fv);
        if ((!desde || d >= desde) && (!hasta || d <= hasta)) { ms = true; break; }
      }
    }
    return mb && me && ms;
  }), [orden, busqDia, filtroEstDia, filtroVencDia, rangoVencDia]);

  const todosCheck = ordenFiltrado.length > 0 && ordenFiltrado.every(rc => selDia.has(rc.id));
  const toggleTodos = () => {
    const ids = new Set(ordenFiltrado.map(rc => rc.id));
    setSelDia(prev => {
      const n = new Set(prev);
      todosCheck ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id));
      return n;
    });
  };

  const content = (
    <div
      style={{
        position:"fixed",inset:0,zIndex:99999,
        background:"rgba(15,23,42,0.65)",overflowY:"auto"
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ minHeight:"100%",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1.5rem 1rem" }}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden anim-fadeup">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">🗓️ Generar ruta del día</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {selDia.size > 0
                  ? <span className="text-blue-600 font-bold">{selDia.size} seleccionado{selDia.size !== 1 ? "s" : ""}</span>
                  : "Filtra y selecciona los clientes a visitar"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all">×</button>
          </div>
          <div className="px-6 py-3 border-b border-gray-100 space-y-3 bg-white">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fecha</label>
              <input type="date" value={fechaDia} min={hoyStr()}
                onChange={e => setFechaDia(e.target.value)}
                className="input-field flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50" />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={busqDia} onChange={e => setBusqDia(e.target.value)}
                placeholder="Buscar por nombre, cédula, sector…"
                className="input-field w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-gray-50 transition-all" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[{key:"",label:"Todos"},{key:"HOY",label:"Con cobro hoy",icon:"📅"},{key:"ACTIVO",label:"Al día",icon:"✅"},{key:"ATRASADO",label:"Atrasados",icon:"⚠️"}].map(f => (
                <button key={f.key} type="button" onClick={() => setFiltroEstDia(f.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${filtroEstDia === f.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  {f.icon && <span>{f.icon}</span>}{f.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setFiltroVencDia(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${filtroVencDia ? "bg-amber-500" : "bg-gray-200"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${filtroVencDia ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <span className="text-xs font-bold text-gray-600">📅 Filtrar por vencimiento</span>
              </label>
              {filtroVencDia && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 space-y-2 anim-fadeup">
                  <div className="flex gap-2 flex-wrap">
                    {[
                      {label:"Hoy",fn:()=>{const h=hoyStr();setRangoVencDia({desde:h,hasta:h});}},
                      {label:"Esta semana",fn:()=>{const h=new Date();h.setHours(0,0,0,0);const dow=h.getDay()===0?6:h.getDay()-1;const l=new Date(h);l.setDate(h.getDate()-dow);const d=new Date(l);d.setDate(l.getDate()+6);setRangoVencDia({desde:l.toISOString().slice(0,10),hasta:d.toISOString().slice(0,10)});}},
                      {label:"Próx. 7 días",fn:()=>{const h=new Date();const f=new Date(h);f.setDate(h.getDate()+7);setRangoVencDia({desde:h.toISOString().slice(0,10),hasta:f.toISOString().slice(0,10)});}},
                    ].map(a => (
                      <button key={a.label} type="button" onClick={a.fn}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all">
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="date" value={rangoVencDia.desde} onChange={e => setRangoVencDia(r=>({...r,desde:e.target.value}))}
                      className="input-field flex-1 border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs bg-white" />
                    <input type="date" value={rangoVencDia.hasta} onChange={e => setRangoVencDia(r=>({...r,hasta:e.target.value}))}
                      className="input-field flex-1 border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs bg-white" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600">
                <input type="checkbox" checked={todosCheck} onChange={toggleTodos}
                  className="w-4 h-4 rounded accent-blue-600" />
                Seleccionar filtrados ({ordenFiltrado.length})
              </label>
              {selDia.size > 0 && (
                <button onClick={() => setSelDia(new Set())} className="text-xs text-red-500 hover:text-red-700 font-semibold">
                  Limpiar selección
                </button>
              )}
            </div>
          </div>
          <div className="thin-scroll divide-y divide-gray-50" style={{ maxHeight:"320px",overflowY:"auto" }}>
            {ordenFiltrado.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">🔍</p>
                <p className="font-semibold text-sm">Sin resultados</p>
                <p className="text-xs mt-1">Prueba con otro filtro</p>
              </div>
            ) : ordenFiltrado.map(rc => (
              <label key={rc.id} className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${selDia.has(rc.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <input type="checkbox" checked={selDia.has(rc.id)}
                  onChange={() => setSelDia(prev => { const n = new Set(prev); n.has(rc.id) ? n.delete(rc.id) : n.add(rc.id); return n; })}
                  className="w-4 h-4 rounded accent-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{rc.cliente.nombre} {rc.cliente.apellido}</p>
                    {rc._tieneAtrasados && <span className="badge bg-red-100 text-red-700">⚠ Atrasado</span>}
                    {rc._debeVisitar && !rc._tieneAtrasados && <span className="badge bg-blue-100 text-blue-700">📅 Hoy</span>}
                  </div>
                  {rc.cliente.municipio && <p className="text-xs text-gray-400 truncate">📍 {[rc.cliente.sector,rc.cliente.municipio].filter(Boolean).join(", ")}</p>}
                </div>
                {selDia.has(rc.id) && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 check-pop">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
              </label>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-white">
            <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-all">Cancelar</button>
            <button onClick={onConfirmar} disabled={generando || !selDia.size}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95">
              {generando ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "🗓️"}
              {generando ? "Generando…" : `Generar con ${selDia.size} cliente${selDia.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ─── GestionRuta ──────────────────────────────────────────────────────────────
const GestionRuta = ({ ruta, onVolver, showToast, modalAgregar, setModalAgregar, isAdmin = false }) => {
  const [det, setDet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mObs, setMObs] = useState(null);
  const [mEdit, setMEdit] = useState(false);
  const [savEdit, setSavEdit] = useState(false);
  const [mapa, setMapa] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [orden, setOrden] = useState([]);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [ordenModificado, setOrdenModificado] = useState(false);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/rutas/${ruta.id}`);
      setDet(r.data);

      const clientes = r.data.clientes ?? [];
      try {
        const rp = await api.get("/prestamos?limit=2000");
        const prestamos = Array.isArray(rp.data) ? rp.data : (rp.data?.data ?? []);
        const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
        const estadoMap = {}; const venceMap = {};
        for (const p of prestamos) {
          const cid = p.clienteId;
          if (!estadoMap[cid] || p.estado === "ATRASADO") estadoMap[cid] = p.estado;
          for (const c of (p.cuotas ?? [])) {
            if (!c.pagada) {
              if (!venceMap[cid]) venceMap[cid] = [];
              venceMap[cid].push(c.fechaVencimiento);
            }
          }
        }
        const enriquecidos = clientes.map(rc => ({
          ...rc,
          _tieneAtrasados: estadoMap[rc.clienteId] === "ATRASADO",
          _tienePrestamos: !!estadoMap[rc.clienteId],
          _debeVisitar: (venceMap[rc.clienteId] ?? []).some(fv => new Date(fv) <= hoy) || estadoMap[rc.clienteId] === "ATRASADO",
          _cuotasVenc: venceMap[rc.clienteId] ?? [],
        }));
        setOrden(enriquecidos);
      } catch {
        setOrden(clientes);
      }
      setOrdenModificado(false);
    }
    catch { } finally { setLoading(false); }
  }, [ruta.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const onDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      const el = document.getElementById(`rc-card-${idx}`);
      if (el) el.classList.add("drag-ghost");
    }, 0);
  };

  const onDragEnter = (idx) => {
    if (dragIdx.current === idx) return;
    dragOverIdx.current = idx;
    setOrden(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next;
    });
  };

  const onDragEnd = (idx) => {
    const el = document.getElementById(`rc-card-${idx}`);
    if (el) el.classList.remove("drag-ghost");
    dragIdx.current = null;
    dragOverIdx.current = null;
    setOrdenModificado(true);
  };

  const onDragOver = (e) => e.preventDefault();

  const guardarOrden = async () => {
    setGuardandoOrden(true);
    try {
      await api.patch(`/rutas/${ruta.id}/reordenar`, {
        orden: orden.map((rc, i) => ({ id: rc.id, orden: i + 1 })),
      });
      showToast("Orden guardado ✓");
      setOrdenModificado(false);
      setDet(prev => ({ ...prev, clientes: orden }));
    } catch {
      showToast("Error al guardar el orden", "error");
      cargar();
    } finally { setGuardandoOrden(false); }
  };

  const cancelarOrden = () => {
    setOrden(det?.clientes ?? []);
    setOrdenModificado(false);
  };

  const quitar = async (rcId) => {
    if (!window.confirm("¿Quitar este cliente de la ruta?")) return;
    try { await api.delete(`/rutas/${ruta.id}/clientes/${rcId}`); showToast("Cliente quitado de la ruta"); cargar(); }
    catch { showToast("Error al quitar cliente", "error"); }
  };

  const editarRuta = async ({ nombre, descripcion }) => {
    setSavEdit(true);
    try { await api.patch(`/rutas/${ruta.id}`, { nombre, descripcion }); showToast("Ruta actualizada ✓"); setMEdit(false); cargar(); }
    catch { showToast("Error al actualizar", "error"); } finally { setSavEdit(false); }
  };

  const yaEnRuta = det?.clientes?.map(rc => rc.clienteId) ?? [];
  const paraMap = orden.map(rc => ({ rutaClienteId: rc.id, cliente: rc.cliente, observacion: rc.observacion, tieneAtrasados: false, totalACobrar: 0 }));

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return orden;
    const qSinGuiones = q.replace(/-/g, "");
    return orden.filter(rc =>
      `${rc.cliente.nombre} ${rc.cliente.apellido}`.toLowerCase().includes(q) ||
      (qSinGuiones && (rc.cliente.cedula ?? "").replace(/\D/g, "").includes(qSinGuiones)) ||
      (rc.cliente.sector ?? "").toLowerCase().includes(q) ||
      (rc.cliente.municipio ?? "").toLowerCase().includes(q)
    );
  }, [orden, busqueda]);

  const modoOrden = !busqueda;

  const handleAgregado = (n) => {
    setModalAgregar(false);
    cargar();
    showToast(`${n} cliente${n !== 1 ? "s" : ""} agregado${n !== 1 ? "s" : ""} ✓`);
  };

  const handleOrganizarCercania = async () => {
    if (orden.length < 2) return;
    const conCoords = orden.filter(rc => rc.cliente?.latitud && rc.cliente?.longitud);
    if (conCoords.length < 2) { showToast("Se necesitan al menos 2 clientes con coordenadas", "error"); return; }
    const nuevo = organizarPorCercania(orden);
    setOrden(nuevo);
    setOrdenModificado(true);
    showToast(`✓ ${conCoords.length} clientes organizados por cercanía`);
  };

  const [modalGenerarDia, setModalGenerarDia] = useState(false);
  const [selDia, setSelDia] = useState(new Set());
  const [fechaDia, setFechaDia] = useState(hoyStr());
  const [generando, setGenerando] = useState(false);

  const abrirGenerarDia = () => {
    const presel = new Set(
      orden.filter(rc => rc._debeVisitar !== false).map(rc => rc.id)
    );
    setSelDia(presel.size > 0 ? presel : new Set(orden.map(rc => rc.id)));
    setFechaDia(hoyStr());
    setModalGenerarDia(true);
  };

  const confirmarGenerarDia = async () => {
    if (!selDia.size) { showToast("Selecciona al menos un cliente", "error"); return; }
    setGenerando(true);
    try {
      await api.post(`/rutas/${ruta.id}/generar-dia`, {
        rutaClienteIds: [...selDia],
        fecha: fechaDia,
      });
      showToast(`Ruta del día generada con ${selDia.size} cliente${selDia.size !== 1 ? "s" : ""} ✓`);
      setModalGenerarDia(false);
    } catch { showToast("Error al generar ruta del día", "error"); }
    finally { setGenerando(false); }
  };

  return (
    <>
      {mObs && <ModalObs rc={mObs} rutaId={ruta.id} onSaved={() => { setMObs(null); cargar(); showToast("Observación guardada ✓"); }} onClose={() => setMObs(null)} />}
      {mEdit && <ModalRuta ruta={det} onConfirm={editarRuta} onClose={() => setMEdit(false)} loading={savEdit} />}
      {modalAgregar && <ModalMasa rutaId={ruta.id} yaEnRuta={yaEnRuta} onDone={handleAgregado} onClose={() => setModalAgregar(false)} />}

      {modalGenerarDia && (
        <ModalGenerarDia
          orden={orden}
          selDia={selDia}
          setSelDia={setSelDia}
          fechaDia={fechaDia}
          setFechaDia={setFechaDia}
          generando={generando}
          onConfirmar={confirmarGenerarDia}
          onClose={() => setModalGenerarDia(false)}
        />
      )}

      <div className="space-y-4 anim-fadeup">
        <div className="flex items-start gap-3 flex-wrap">
          <button onClick={onVolver} className="w-9 h-9 rounded-2xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-all mt-0.5 shrink-0">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-900 text-lg truncate">{det?.nombre ?? ruta.nombre}</h2>
              <button onClick={() => setMEdit(true)} className="text-xs text-blue-500 hover:text-blue-700 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors">Editar</button>
            </div>
            {det?.descripcion && <p className="text-xs text-gray-400 mt-0.5">{det.descripcion}</p>}
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{det?.clientes?.length ?? 0} clientes en esta ruta</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {(det?.clientes?.length ?? 0) > 0 && (
              <button onClick={() => setMapa(m => !m)}
                className={`w-9 h-9 rounded-2xl border flex items-center justify-center text-sm transition-all ${mapa ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                🗺️
              </button>
            )}
            {orden.length >= 2 && (
              <button onClick={handleOrganizarCercania} title="Organizar clientes por cercanía geográfica"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold transition-all active:scale-95">
                🧭 <span className="hide-mobile">Cercanía</span>
              </button>
            )}
            {orden.length > 0 && (
              <button onClick={abrirGenerarDia}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all active:scale-95">
                🗓️ <span className="hide-mobile">Ruta del día</span>
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setModalAgregar(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Agregar
              </button>
            )}
          </div>
        </div>

        {mapa && paraMap.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 anim-fadeup">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vista del mapa</p>
            <MapaRuta clientes={paraMap} visitadoIds={[]} />
          </div>
        )}

        {(det?.clientes?.length ?? 0) > 5 && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente en esta ruta…"
              className="input-field w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white transition-all" />
          </div>
        )}

        {ordenModificado && (
          <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 anim-fadeup">
            <div className="flex items-center gap-2">
              <span className="text-blue-500 text-lg">↕️</span>
              <p className="text-sm font-bold text-blue-700">Orden modificado</p>
              <p className="text-xs text-blue-500 hidden sm:block">Guarda los cambios para que se apliquen en la ruta del día</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={cancelarOrden}
                className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all">
                Cancelar
              </button>
              <button onClick={guardarOrden} disabled={guardandoOrden}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60 flex items-center gap-1.5 transition-all active:scale-95">
                {guardandoOrden
                  ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : "💾"} Guardar orden
              </button>
            </div>
          </div>
        )}

        {loading ? <Spin /> : det?.clientes?.length === 0 ? (
          <EmptyState icon="👤" title="Esta ruta no tiene clientes"
            subtitle={isAdmin ? "Agrega clientes para comenzar a organizar tus cobros" : "El administrador aún no ha agregado clientes a esta ruta"}
            action={isAdmin ? () => setModalAgregar(true) : null} actionLabel="+ Agregar clientes" />
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold">Sin resultados para "{busqueda}"</p>
          </div>
        ) : (
          <>
            {modoOrden && orden.length > 1 && !ordenModificado && (
              <p className="text-[10px] text-gray-400 text-center font-medium">
                ☰ Arrastra el ícono para cambiar el orden de visita
              </p>
            )}
            <div className="space-y-2.5">
              {clientesFiltrados.map((rc, idx) => (
                <div
                  key={rc.id}
                  id={`rc-card-${idx}`}
                  draggable={modoOrden}
                  onDragStart={modoOrden ? (e) => onDragStart(e, idx) : undefined}
                  onDragEnter={modoOrden ? () => onDragEnter(idx) : undefined}
                  onDragOver={modoOrden ? onDragOver : undefined}
                  onDragEnd={modoOrden ? () => onDragEnd(idx) : undefined}
                  className="cliente-item bg-white rounded-2xl border border-gray-100 shadow-sm p-4 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                        {modoOrden && (
                          <div className="drag-handle w-5 flex flex-col items-center gap-[3px] py-0.5 px-0.5 rounded-lg hover:bg-gray-100 transition-colors">
                            <span className="w-3.5 h-0.5 bg-gray-300 rounded-full" />
                            <span className="w-3.5 h-0.5 bg-gray-300 rounded-full" />
                            <span className="w-3.5 h-0.5 bg-gray-300 rounded-full" />
                          </div>
                        )}
                        <span className="w-7 h-7 rounded-xl bg-gray-100 border border-gray-200 text-xs font-bold text-gray-500 flex items-center justify-center">{idx + 1}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800">{rc.cliente.nombre} {rc.cliente.apellido}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{formatCedula(rc.cliente.cedula ?? "")}</p>
                        {rc.cliente.direccion && (
                          <p className="text-xs text-gray-500 mt-1 truncate">📍 {[rc.cliente.direccion, rc.cliente.sector, rc.cliente.municipio].filter(Boolean).join(", ")}</p>
                        )}
                        {(rc.cliente.telefono || rc.cliente.celular || (rc.cliente.latitud && rc.cliente.longitud)) && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {rc.cliente.telefono && <a href={`tel:${rc.cliente.telefono}`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">📞 {rc.cliente.telefono}</a>}
                            {rc.cliente.celular && <a href={`tel:${rc.cliente.celular}`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">📱 {rc.cliente.celular}</a>}
                            {rc.cliente.latitud && rc.cliente.longitud && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${rc.cliente.latitud},${rc.cliente.longitud}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 transition-colors">
                                🧭 Navegar
                              </a>
                            )}
                          </div>
                        )}
                        {(() => {
                          const obs = rc.observacion || rc.cliente?.observaciones;
                          return obs ? (
                            <div className="mt-2 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                              <span className="text-amber-500 shrink-0 text-xs mt-0.5">💡</span>
                              <p className="text-xs text-amber-800 font-medium flex-1 leading-relaxed">{obs}</p>
                              <button onClick={() => setMObs(rc)} className="shrink-0 text-[10px] text-amber-500 hover:text-amber-700 font-bold underline ml-1">Editar</button>
                            </div>
                          ) : (
                            <button onClick={() => setMObs(rc)} className="mt-1.5 text-xs text-blue-400 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors">
                              <span>+</span> Agregar nota de ubicación
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {isAdmin && (
                      <button onClick={() => quitar(rc.id)} className="w-8 h-8 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ─── Rutas (main) ─────────────────────────────────────────────────────────────
export default function Rutas() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMIN";
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [mNueva, setMNueva] = useState(false);
  const [savN, setSavN] = useState(false);
  const [vista, setVista] = useState(null);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [tabPrincipal, setTabPrincipal] = useState("rutas");
  const [usuarios, setUsuarios] = useState([]);
  const [asignando, setAsignando] = useState({});
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const cargar = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/rutas"); setRutas(r.data); }
    catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/rutas/usuarios").then(r => setUsuarios(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [isAdmin]);

  const crear = async ({ nombre, descripcion }) => {
    setSavN(true);
    try { await api.post("/rutas", { nombre, descripcion }); showToast("Ruta creada ✓"); setMNueva(false); cargar(); }
    catch (e) { showToast(e.response?.data?.message ?? "Error al crear", "error"); }
    finally { setSavN(false); }
  };

  const eliminar = async r => {
    if (!window.confirm(`¿Eliminar la ruta "${r.nombre}"?`)) return;
    try { await api.delete(`/rutas/${r.id}`); showToast("Ruta eliminada"); cargar(); }
    catch { showToast("Error al eliminar", "error"); }
  };

  const handleAsignarUsuario = async (rutaId, usuarioId) => {
    setAsignando(p => ({ ...p, [rutaId]: true }));
    try {
      if (usuarioId === "") {
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        const adminId = user?.id;
        if (!adminId) throw new Error("No hay usuario");
        await api.patch(`/rutas/${rutaId}/asignar-usuario`, { usuarioId: adminId });
        showToast("Cobrador removido — ruta reasignada al admin ✓");
      } else {
        await api.patch(`/rutas/${rutaId}/asignar-usuario`, { usuarioId });
        showToast("Cobrador asignado ✓");
      }
      cargar();
    } catch { showToast("Error al asignar cobrador", "error"); }
    finally { setAsignando(p => ({ ...p, [rutaId]: false })); }
  };

  if (vista?.tipo === "dia") return (
    <div className="rutas-root">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <VistaDia rutaId={vista.ruta.id} rutaNombre={vista.ruta.nombre} onVolver={() => setVista(null)} showToast={showToast} />
    </div>
  );

  if (vista?.tipo === "gestion") return (
    <div className="rutas-root">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <GestionRuta ruta={vista.ruta} onVolver={() => { setVista(null); cargar(); setModalAgregar(false); }}
        showToast={showToast} modalAgregar={modalAgregar} setModalAgregar={setModalAgregar} isAdmin={isAdmin} />
    </div>
  );

  return (
    <div className="rutas-root">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {mNueva && <ModalRuta onConfirm={crear} onClose={() => setMNueva(false)} loading={savN} />}

      <div className="space-y-5 anim-fadeup">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Rutas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Organiza tus zonas de cobro y clientes a visitar</p>
          </div>
          {isAdmin && tabPrincipal === "rutas" && (
            <button onClick={() => setMNueva(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              <span>Nueva ruta</span>
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="flex gap-1.5 bg-gray-100 p-1 rounded-2xl w-fit">
            {[["rutas","🗺️ Rutas"],["cobradores","👥 Cobradores"]].map(([k,l]) => (
              <button key={k} onClick={() => setTabPrincipal(k)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${tabPrincipal === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {l}
              </button>
            ))}
          </div>
        )}

        {tabPrincipal === "rutas" && (
          <>
            {!loading && rutas.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Rutas activas", v: rutas.length, icon: "🗺️", c: "text-blue-700", bg: "bg-blue-50 border-blue-100" },
                  { label: "Total clientes", v: rutas.reduce((s, r) => s + (r.clientes?.length ?? 0), 0), icon: "👥", c: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
                  { label: "Promedio / ruta", v: rutas.length ? Math.round(rutas.reduce((s, r) => s + (r.clientes?.length ?? 0), 0) / rutas.length) : 0, icon: "📊", c: "text-purple-700", bg: "bg-purple-50 border-purple-100" },
                ].map(k => (
                  <div key={k.label} className={`stat-card ${k.bg} border rounded-2xl px-4 py-3.5 ${k.label === "Promedio / ruta" ? "hidden sm:block" : ""}`}>
                    <p className="text-lg mb-1">{k.icon}</p>
                    <p className={`text-2xl font-extrabold ${k.c}`}>{k.v}</p>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>
            )}

            {loading ? <Spin /> : rutas.length === 0 ? (
              <EmptyState icon="🗺️" title="No tienes rutas creadas"
                subtitle="Crea una ruta para organizar los clientes que visitas cada día"
                action={isAdmin ? () => setMNueva(true) : null} actionLabel="+ Crear primera ruta" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rutas.map((r, i) => (
                  <div key={r.id} className="ruta-card bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
                    style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="h-1.5" style={{ background: `linear-gradient(90deg, hsl(${(i * 47 + 210) % 360}, 75%, 55%), hsl(${(i * 47 + 240) % 360}, 70%, 65%))` }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-extrabold text-gray-900 truncate text-base leading-tight">{r.nombre}</h3>
                          {r.descripcion && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.descripcion}</p>}
                          {isAdmin && r.usuario && (
                            <p className="text-xs text-blue-500 mt-1 font-semibold">👤 {r.usuario.nombre}</p>
                          )}
                        </div>
                        {isAdmin && (
                          <button onClick={() => eliminar(r)}
                            className="w-8 h-8 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex -space-x-1.5">
                          {[...Array(Math.min(r.clientes?.length ?? 0, 3))].map((_, j) => (
                            <div key={j} className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">{j + 1}</div>
                          ))}
                        </div>
                        <span className="text-sm font-bold text-gray-700">{r.clientes?.length ?? 0}</span>
                        <span className="text-xs text-gray-400">cliente{(r.clientes?.length ?? 0) !== 1 ? "s" : ""}</span>
                        {(r.clientes?.length ?? 0) === 0 && <span className="badge bg-amber-100 text-amber-700 ml-auto">Sin clientes</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setVista({ tipo: "dia", ruta: r })}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95">
                          📅 Ruta del día
                        </button>
                        <button onClick={() => setVista({ tipo: "gestion", ruta: r })}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold border border-gray-200 transition-all active:scale-95">
                          ⚙️ Gestionar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tabPrincipal === "cobradores" && isAdmin && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Asigna un cobrador responsable a cada ruta. El cobrador solo verá sus rutas asignadas.</p>
            {loading ? <Spin /> : rutas.length === 0 ? (
              <EmptyState icon="👥" title="No hay rutas" subtitle="Crea rutas primero para asignar cobradores" />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {rutas.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="w-3 h-10 rounded-full shrink-0" style={{ background: `hsl(${(i * 47 + 210) % 360}, 75%, 55%)` }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{r.nombre}</p>
                        <p className="text-xs text-gray-400">{r.clientes?.length ?? 0} cliente{(r.clientes?.length ?? 0) !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={r.usuario?.id ?? ""}
                          onChange={e => handleAsignarUsuario(r.id, e.target.value)}
                          disabled={asignando[r.id]}
                          className="input-field border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 min-w-[160px] focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50">
                          <option value="">Sin cobrador</option>
                          {usuarios.map(u => (
                            <option key={u.id} value={u.id}>{u.nombre} {u.rol === "ADMIN" ? "(Admin)" : ""}</option>
                          ))}
                        </select>
                        {asignando[r.id] && <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />}
                        {r.usuario && !asignando[r.id] && (
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                            {r.usuario.nombre.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}