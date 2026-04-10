// src/pages/Alertas.jsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getSocket, connectSocket } from "../services/socket";

// ─── Config visual ────────────────────────────────────────────────────────────
const TIPO_CONFIG = {
  REFINANCIAMIENTO: { label: "Refinanciamiento", icon: "🔄", color: "amber" },
  CAMBIO_FRECUENCIA: { label: "Cambio de Frecuencia", icon: "📅", color: "violet" },
  CAMBIO_TASA: { label: "Cambio de Tasa", icon: "📊", color: "blue" },
  CAMBIO_CUOTAS: { label: "Cambio de Cuotas", icon: "🔢", color: "sky" },
  CAMBIO_FECHA_PAGO: { label: "Cambio de Fecha", icon: "📆", color: "emerald" },
  CANCELACION: { label: "Cancelación", icon: "🚫", color: "red" },
  CAMBIO_ESTADO: { label: "Cambio de Estado", icon: "🔀", color: "gray" },
};

const TIPOS_REFI = new Set(["REFINANCIAMIENTO", "CAMBIO_FRECUENCIA", "CAMBIO_TASA", "CAMBIO_CUOTAS", "CAMBIO_FECHA_PAGO"]);

const COL = {
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400", icon: "bg-amber-100", bar: "bg-amber-400" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-400", icon: "bg-violet-100", bar: "bg-violet-400" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-400", icon: "bg-blue-100", bar: "bg-blue-400" },
  sky: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", badge: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-400", icon: "bg-sky-100", bar: "bg-sky-400" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400", icon: "bg-emerald-100", bar: "bg-emerald-400" },
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400", icon: "bg-red-100", bar: "bg-red-400" },
  gray: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", badge: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400", icon: "bg-gray-100", bar: "bg-gray-300" },
};

const fmt = (n) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(n);

const fmtHora = (d) =>
  new Intl.DateTimeFormat("es-DO", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));

const fmtFechaCompleta = (d) =>
  new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

const fmtRelativo = (d) => {
  const fecha = new Date(d);
  const ahora = new Date();
  const diffMin = Math.floor((ahora - fecha) / 60000);
  if (diffMin < 1) return "Ahora mismo";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  return fmtHora(d);
};

// Clave local YYYY-MM-DD sin conversión UTC
const claveDia = (d) => {
  const f = new Date(d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

const hoyStr = () => claveDia(new Date());
const haceDiasStr = (n) => claveDia(new Date(Date.now() - n * 86400000));

// Comparar claves locales para evitar desfase por zona horaria
const labelDia = (clave) => {
  const hoy = claveDia(new Date());
  const ayer = claveDia(new Date(Date.now() - 86400000));
  if (clave === hoy) return "Hoy";
  if (clave === ayer) return "Ayer";
  const fecha = new Date(clave + "T12:00:00"); // mediodía local para evitar desfases
  const mismoAnio = fecha.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("es-DO", {
    weekday: "long", day: "2-digit", month: "long",
    ...(mismoAnio ? {} : { year: "numeric" }),
  }).format(fecha);
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spin = () => (
  <div className="flex justify-center items-center py-20">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium max-w-sm ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : type === "realtime" ? "bg-blue-50 border-blue-200 text-blue-800"
          : "bg-red-50 border-red-200 text-red-800"
      }`}>
      {type === "success" && <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      {type === "realtime" && <span className="text-lg shrink-0">🔔</span>}
      {type === "error" && <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
      <span className="flex-1 min-w-0">{message}</span>
    </div>
  );
};

// ─── Indicador de conexión WebSocket ─────────────────────────────────────────
const WsStatus = ({ conectado }) => (
  <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${conectado ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-gray-100 border-gray-200 text-gray-400"
    }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${conectado ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
    {conectado ? "En vivo" : "Sin conexión"}
  </div>
);

// ─── Chip de tipo ─────────────────────────────────────────────────────────────
const TipoChip = ({ tipo }) => {
  const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.CAMBIO_ESTADO;
  const col = COL[cfg.color];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ─── Fila de cambio (antes → después) ────────────────────────────────────────
const CambioFila = ({ label, antes, despues }) => (
  <div className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0 flex-wrap">
    <span className="text-[11px] text-gray-400 font-semibold w-32 shrink-0">{label}</span>
    <div className="flex items-center gap-2 flex-wrap">
      {antes !== undefined && (
        <span className="text-[11px] font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-lg border border-red-100 line-through">{antes}</span>
      )}
      {antes !== undefined && despues !== undefined && (
        <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      )}
      {despues !== undefined && (
        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">{despues}</span>
      )}
    </div>
  </div>
);

// ─── Bloque de detalle de cambios ─────────────────────────────────────────────
const DetallesCambios = ({ alertas }) => {
  const filas = [];
  for (const a of alertas) {
    const d = typeof a.detalle === "string" ? JSON.parse(a.detalle) : (a.detalle ?? {});
    if (a.tipo === "REFINANCIAMIENTO") {
      if (d.saldoRefinanciado) filas.push({ key: "saldo", label: "Saldo refinanciado", antes: undefined, despues: fmt(d.saldoRefinanciado) });
      if (d.nuevaCuota) filas.push({ key: "cuota", label: "Nueva cuota estimada", antes: undefined, despues: fmt(d.nuevaCuota) });
      if (d.motivo) filas.push({ key: "motivo", label: "Motivo", antes: undefined, despues: d.motivo });
    }
    if (a.tipo === "CAMBIO_TASA" && d.tasaAnterior !== undefined)
      filas.push({ key: "tasa", label: "Tasa de interés", antes: `${d.tasaAnterior}%`, despues: `${d.tasaNueva}%` });
    if (a.tipo === "CAMBIO_CUOTAS" && d.cuotasAntes !== undefined)
      filas.push({ key: "cuotas", label: "Cuotas pendientes", antes: `${d.cuotasAntes}`, despues: `${d.cuotasNuevas}` });
    if (a.tipo === "CAMBIO_FRECUENCIA" && d.frecuenciaAnterior)
      filas.push({ key: "frec", label: "Frecuencia", antes: d.frecuenciaAnterior, despues: d.frecuenciaNueva });
    if (a.tipo === "CAMBIO_FECHA_PAGO" && d.nuevaFecha)
      filas.push({ key: "fecha", label: "Próxima cuota", antes: undefined, despues: d.nuevaFecha });
    if (a.tipo === "CANCELACION") {
      if (d.estadoAnterior) filas.push({ key: "estc", label: "Estado anterior", antes: undefined, despues: d.estadoAnterior });
      if (d.monto) filas.push({ key: "montoc", label: "Monto", antes: undefined, despues: fmt(d.monto) });
    }
    if (a.tipo === "CAMBIO_ESTADO") {
      if (d.estadoAnterior && d.estadoNuevo) filas.push({ key: "estado", label: "Estado", antes: d.estadoAnterior, despues: d.estadoNuevo });
      if (d.motivo) filas.push({ key: "motce", label: "Motivo", antes: undefined, despues: d.motivo });
      if (d.monto) filas.push({ key: "montce", label: "Monto", antes: undefined, despues: fmt(d.monto) });
    }
  }
  if (filas.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl bg-white border border-gray-100 px-3 py-0.5 shadow-sm">
      {filas.map(f => <CambioFila key={f.key} label={f.label} antes={f.antes} despues={f.despues} />)}
    </div>
  );
};

// ─── Agrupar alertas de la misma sesión ──────────────────────────────────────
function agruparAlertas(alertas) {
  const ordenadas = [...alertas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const grupos = [], usadas = new Set();

  for (let i = 0; i < ordenadas.length; i++) {
    const base = ordenadas[i];
    if (usadas.has(base.id)) continue;

    if (TIPOS_REFI.has(base.tipo)) {
      const sesion = [base];
      usadas.add(base.id);
      const baseTime = new Date(base.createdAt).getTime();
      for (let j = 0; j < ordenadas.length; j++) {
        if (usadas.has(ordenadas[j].id)) continue;
        if (ordenadas[j].prestamoId !== base.prestamoId) continue;
        if (!TIPOS_REFI.has(ordenadas[j].tipo)) continue;
        if (Math.abs(new Date(ordenadas[j].createdAt).getTime() - baseTime) <= 30000) {
          sesion.push(ordenadas[j]); usadas.add(ordenadas[j].id);
        }
      }
      const ORDER = ["REFINANCIAMIENTO", "CAMBIO_TASA", "CAMBIO_CUOTAS", "CAMBIO_FRECUENCIA", "CAMBIO_FECHA_PAGO"];
      sesion.sort((a, b) => (ORDER.indexOf(a.tipo) === -1 ? 99 : ORDER.indexOf(a.tipo)) - (ORDER.indexOf(b.tipo) === -1 ? 99 : ORDER.indexOf(b.tipo)));
      grupos.push({
        id: base.id, prestamoId: base.prestamoId, clienteNombre: base.clienteNombre,
        createdAt: base.createdAt, usuarioId: base.usuarioId,
        usuarioNombre: base.usuarioNombre ?? "Sistema",
        leida: sesion.every(a => a.leida), agrupada: sesion.length > 1, alertas: sesion,
        tipoPrincipal: sesion.find(a => a.tipo === "REFINANCIAMIENTO")?.tipo ?? base.tipo,
      });
    } else {
      usadas.add(base.id);
      grupos.push({
        id: base.id, prestamoId: base.prestamoId, clienteNombre: base.clienteNombre,
        createdAt: base.createdAt, usuarioId: base.usuarioId,
        usuarioNombre: base.usuarioNombre ?? "Sistema",
        leida: base.leida, agrupada: false, alertas: [base],
        tipoPrincipal: base.tipo,
      });
    }
  }
  return grupos;
}

// ─── Card de grupo ────────────────────────────────────────────────────────────
const GrupoCard = ({ grupo, onMarcarLeidas, onVerPrestamo, esNueva }) => {
  const [expandido, setExpandido] = useState(!grupo.leida);
  const cfg = TIPO_CONFIG[grupo.tipoPrincipal] ?? TIPO_CONFIG.CAMBIO_ESTADO;
  const col = COL[cfg.color];
  const leida = grupo.leida;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${esNueva ? "ring-2 ring-blue-400 ring-offset-1" : ""
      } ${leida ? "bg-white border-gray-200 shadow-sm" : `${col.bg} ${col.border} shadow-md`}`}>
      {!leida && <div className={`h-1 w-full ${col.bar}`} />}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícono */}
          <div className="relative shrink-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl ${leida ? "bg-gray-100" : col.icon} shadow-sm`}>
              {cfg.icon}
            </div>
            {!leida && <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${col.dot} border-2 border-white`} />}
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            {/* Cliente + hora */}
            <div className="flex items-start justify-between gap-2">
              <p className={`font-bold text-sm ${leida ? "text-gray-500" : "text-gray-900"}`}>{grupo.clienteNombre}</p>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold ${leida ? "text-gray-400" : col.text}`}>{fmtRelativo(grupo.createdAt)}</p>
                <p className="text-[10px] text-gray-400">{fmtHora(grupo.createdAt)}</p>
              </div>
            </div>

            {/* Chips de tipos */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {grupo.alertas.map(a => <TipoChip key={a.id} tipo={a.tipo} />)}
            </div>

            {/* Descripción */}
            <p className={`text-xs mt-2 leading-relaxed ${leida ? "text-gray-400" : "text-gray-600"}`}>
              {grupo.alertas[0].descripcion}
            </p>

            {/* Usuario que realizó el cambio */}
            <div className={`flex items-center gap-2 mt-2 py-2 px-3 rounded-xl border text-[11px] ${leida ? "bg-gray-50 border-gray-100 text-gray-400" : "bg-white/60 border-gray-100 text-gray-500"
              }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${leida ? "bg-gray-200 text-gray-500" : "bg-blue-100 text-blue-600"
                }`}>
                {(grupo.usuarioNombre === "Sistema" || grupo.usuarioNombre === "Sistema automático")
                  ? "⚙" : grupo.usuarioNombre?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-gray-700">{grupo.usuarioNombre ?? "Sistema"}</span>
                <span className="text-gray-300 mx-1.5">·</span>
                <span>{fmtFechaCompleta(grupo.createdAt)}</span>
              </div>
            </div>

            {/* Detalle expandible */}
            {expandido && <DetallesCambios alertas={grupo.alertas} />}

            {/* Acciones */}
            <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-black/5 flex-wrap">
              <button onClick={() => setExpandido(e => !e)}
                className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${leida ? "text-gray-400 hover:text-gray-600" : `${col.text} hover:opacity-70`}`}>
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expandido ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {expandido ? "Ocultar detalle" : `Ver detalle${grupo.agrupada ? ` (${grupo.alertas.length} cambios)` : ""}`}
              </button>

              <button onClick={() => onVerPrestamo(grupo.prestamoId)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-500 hover:text-blue-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Ver préstamo
              </button>

              {!leida && (
                <button onClick={() => onMarcarLeidas(grupo.alertas.map(a => a.id))}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors ml-auto">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Marcar leída
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Separador de día ─────────────────────────────────────────────────────────
const SeparadorDia = ({ fecha, count }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-px bg-gray-200" />
    <div className="flex items-center gap-2 shrink-0 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
      <span className="text-xs font-bold text-gray-600 capitalize">{labelDia(fecha)}</span>
      <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{count}</span>
    </div>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

// ─── Selector de fecha ────────────────────────────────────────────────────────
// rango: { modo: "dia", desde, hasta } | { modo: "rango", desde, hasta }
const SelectorFecha = ({ rango, onRango, loading }) => {
  const esModoDia = rango.modo === "dia";
  const esHoy = esModoDia && rango.desde === hoyStr();

  const irDia = (dia) => onRango({ modo: "dia", desde: dia, hasta: dia });
  const irRango = (desde, hasta) => onRango({ modo: "rango", desde, hasta });

  const navAnterior = () => {
    if (!esModoDia) return;
    irDia(haceDiasStr((new Date(hoyStr()) - new Date(rango.desde)) / 86400000 + 1));
  };
  const navSiguiente = () => {
    if (!esModoDia) return;
    const sig = claveDia(new Date(new Date(rango.desde + "T12:00:00").getTime() + 86400000));
    if (sig <= hoyStr()) irDia(sig);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">📅 Seleccionar período</p>
        {esModoDia && (
          <div className="flex items-center gap-1.5">
            <button onClick={navAnterior} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 transition-all disabled:opacity-40" title="Día anterior">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={navSiguiente} disabled={loading || esHoy}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 transition-all disabled:opacity-40" title="Día siguiente">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Input de fecha (solo en modo día) + etiqueta */}
      {esModoDia ? (
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={rango.desde}
            max={hoyStr()}
            onChange={e => e.target.value && irDia(e.target.value)}
            disabled={loading}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
          />
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gray-700 capitalize">{labelDia(rango.desde)}</p>
            {!esHoy && (
              <button onClick={() => irDia(hoyStr())} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors">
                Ir a hoy →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
          <span className="text-indigo-500 text-sm">📆</span>
          <span className="text-sm font-bold text-indigo-700 capitalize">{labelDia(rango.desde)}</span>
          <svg className="w-3.5 h-3.5 text-indigo-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          <span className="text-sm font-bold text-indigo-700 capitalize">{labelDia(rango.hasta)}</span>
          <button onClick={() => irDia(hoyStr())} className="ml-auto text-[10px] font-bold text-indigo-400 hover:text-indigo-700 transition-colors">
            Volver a día ×
          </button>
        </div>
      )}

      {/* Atajos rápidos */}
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {[
          { label: "Hoy",        activo: esModoDia && rango.desde === hoyStr(),         fn: () => irDia(hoyStr()) },
          { label: "Ayer",       activo: esModoDia && rango.desde === haceDiasStr(1),   fn: () => irDia(haceDiasStr(1)) },
          { label: "Antes de ayer", activo: esModoDia && rango.desde === haceDiasStr(2), fn: () => irDia(haceDiasStr(2)) },
          { label: "Últimos 7 días", activo: !esModoDia && rango.desde === haceDiasStr(6), fn: () => irRango(haceDiasStr(6), hoyStr()), rango: true },
        ].map(a => (
          <button key={a.label} onClick={a.fn} disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-50 flex items-center gap-1 ${
              a.activo
                ? a.rango ? "bg-indigo-600 text-white border-indigo-600" : "bg-blue-600 text-white border-blue-600"
                : "bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-500 border-gray-200 hover:border-blue-200"
            }`}>
            {a.rango && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function Alertas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.rol === "ADMIN";

  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroLeida, setFiltroLeida] = useState("todas");
  const [filtroUsuario, setFiltroUsuario] = useState("TODOS");
  const [marcando, setMarcando] = useState(false);
  const [nuevasIds, setNuevasIds] = useState(new Set());

  // ── Rango seleccionado — por defecto hoy (modo día) ─────────────────────
  const [rango, setRango] = useState({ modo: "dia", desde: hoyStr(), hasta: hoyStr() });

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  // ── Cargar alertas del rango ──────────────────────────────────────────────
  const cargar = useCallback(async (desde, hasta) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ desde, hasta });
      const r = await api.get(`/prestamos/alertas?${params}`);
      setAlertas(Array.isArray(r.data) ? r.data : []);
    } catch { showToast("Error al cargar alertas", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAdmin) { navigate("/dashboard"); return; }
    cargar(rango.desde, rango.hasta);
  }, [isAdmin, navigate, cargar, rango.desde, rango.hasta]);

  // ── WebSocket: conectar y escuchar alertas en tiempo real ──────────────────
  useEffect(() => {
    if (!isAdmin || !user?.empresaId) return;

    connectSocket(user.empresaId);
    const socket = getSocket();

    const onNuevaAlerta = (alerta) => {
      // Solo agregar si la alerta cae dentro del rango visible
      const diaAlerta = claveDia(alerta.createdAt);
      if (diaAlerta >= rango.desde && diaAlerta <= rango.hasta) {
        setAlertas(prev => {
          if (prev.some(a => a.id === alerta.id)) return prev;
          return [alerta, ...prev];
        });
      }
      // Marcar como "nueva" visualmente por 8 segundos
      setNuevasIds(prev => new Set([...prev, alerta.id]));
      setTimeout(() => {
        setNuevasIds(prev => { const next = new Set(prev); next.delete(alerta.id); return next; });
      }, 8000);
      // Toast siempre
      const cfg = TIPO_CONFIG[alerta.tipo] ?? TIPO_CONFIG.CAMBIO_ESTADO;
      showToast(
        `${cfg.icon} ${alerta.clienteNombre} — ${cfg.label} por ${alerta.usuarioNombre ?? "Sistema"}`,
        "realtime"
      );
    };

    socket.on("nueva_alerta", onNuevaAlerta);

    return () => {
      socket.off("nueva_alerta", onNuevaAlerta);
    };
  }, [isAdmin, user?.empresaId, rango.desde, rango.hasta]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const marcarLeidas = async (ids) => {
    try {
      await Promise.all(ids.map(id => api.patch(`/prestamos/alertas/${id}/leer`)));
      setAlertas(prev => prev.map(a => ids.includes(a.id) ? { ...a, leida: true } : a));
    } catch { showToast("Error al marcar como leída", "error"); }
  };

  const marcarTodas = async () => {
    setMarcando(true);
    try {
      await api.patch("/prestamos/alertas/marcar-todas");
      setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
      showToast("Todas las alertas marcadas como leídas ✓");
    } catch { showToast("Error al marcar alertas", "error"); }
    finally { setMarcando(false); }
  };

  // ── Lista de usuarios únicos para el filtro ────────────────────────────────
  const usuariosUnicos = useMemo(() => {
    const mapa = new Map();
    for (const a of alertas) {
      if (!mapa.has(a.usuarioId)) {
        mapa.set(a.usuarioId, a.usuarioNombre ?? "Sistema");
      }
    }
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [alertas]);

  // ── Filtrar ────────────────────────────────────────────────────────────────
  const alertasFiltradas = useMemo(() => alertas.filter(a => {
    const matchTipo = filtroTipo === "TODOS" || a.tipo === filtroTipo;
    const matchLeida = filtroLeida === "todas" || (filtroLeida === "noLeidas" ? !a.leida : a.leida);
    const matchUsuario = filtroUsuario === "TODOS" || a.usuarioId === filtroUsuario;
    return matchTipo && matchLeida && matchUsuario;
  }), [alertas, filtroTipo, filtroLeida, filtroUsuario]);

  // ── Agrupar: por día en modo rango, lista plana en modo día ─────────────
  const grupos = useMemo(() => agruparAlertas(alertasFiltradas), [alertasFiltradas]);
  const { gruposPorDia, ordenDias } = useMemo(() => {
    if (rango.modo === "dia") return { gruposPorDia: null, ordenDias: null };
    const porDia = {}, dias = [];
    for (const g of grupos) {
      const dia = claveDia(g.createdAt);
      if (!porDia[dia]) { porDia[dia] = []; dias.push(dia); }
      porDia[dia].push(g);
    }
    return { gruposPorDia: porDia, ordenDias: dias };
  }, [grupos, rango.modo]);

  const noLeidas = alertas.filter(a => !a.leida).length;
  const tiposUsados = [...new Set(alertas.map(a => a.tipo))];

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
              {noLeidas > 0 && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-sm animate-pulse">
                  {noLeidas}
                </span>
              )}
              <WsStatus conectado={true} />
            </div>
            <p className="text-sm text-gray-400 mt-0.5">Modificaciones y eventos registrados en préstamos</p>
          </div>

          {noLeidas > 0 && (
            <button onClick={marcarTodas} disabled={marcando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60">
              {marcando
                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              }
              Marcar todas leídas
            </button>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total eventos", value: alertas.length, sub: `${grupos.length} agrupados`, color: "bg-slate-800" },
            { label: "Sin leer", value: noLeidas, sub: noLeidas > 0 ? "Requieren atención" : "Al día ✓", color: "bg-red-500" },
            { label: "Leídas", value: alertas.length - noLeidas, sub: "Revisadas", color: "bg-emerald-600" },
            { label: rango.modo === "dia" ? "Día actual" : "Período", value: rango.modo === "dia" ? labelDia(rango.desde) : "7 días", sub: rango.modo === "dia" ? rango.desde : `${rango.desde} → ${rango.hasta}`, color: "bg-blue-600", small: true },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-2xl p-3.5 text-white`}>
              <p className={`font-bold leading-none ${s.small ? "text-lg mt-1" : "text-3xl"}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mt-1.5">{s.label}</p>
              <p className="text-[10px] opacity-50 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Selector de fecha ── */}
        <SelectorFecha
          rango={rango}
          onRango={setRango}
          loading={loading}
        />

        {/* ── Filtros ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">

          {/* Leída / no leída */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            {[
              { id: "todas", label: "Todas", count: alertas.length },
              { id: "noLeidas", label: "Sin leer", count: noLeidas },
              { id: "leidas", label: "Leídas", count: alertas.length - noLeidas },
            ].map(f => (
              <button key={f.id} onClick={() => setFiltroLeida(f.id)}
                className={`flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${filtroLeida === f.id ? "bg-blue-600 text-white shadow-sm rounded-xl" : "text-gray-500 hover:text-gray-700"}`}>
                {f.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filtroLeida === f.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"}`}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Filtro por tipo */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFiltroTipo("TODOS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filtroTipo === "TODOS" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
              Todos los tipos
            </button>
            {tiposUsados.map(tipo => {
              const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.CAMBIO_ESTADO;
              const col = COL[cfg.color];
              const active = filtroTipo === tipo;
              return (
                <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${active ? `${col.bg} ${col.text} ${col.border}` : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>

          {/* ── Filtro por usuario ── */}
          {usuariosUnicos.length > 1 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Filtrar por usuario</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFiltroUsuario("TODOS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${filtroUsuario === "TODOS" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                  👥 Todos los usuarios
                </button>
                {usuariosUnicos.map(u => (
                  <button key={u.id} onClick={() => setFiltroUsuario(u.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${filtroUsuario === u.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${filtroUsuario === u.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                      {u.nombre === "Sistema" ? "⚙" : u.nombre?.charAt(0)?.toUpperCase()}
                    </span>
                    {u.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Lista ── */}
        {loading ? <Spin /> : grupos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
            <p className="text-6xl mb-4">🔔</p>
            <p className="font-bold text-gray-700 text-xl">
              {filtroLeida === "noLeidas" ? "¡Todo al día!" : rango.modo === "rango" ? "Sin alertas en este período" : "Sin alertas este día"}
            </p>
            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
              {filtroLeida === "noLeidas"
                ? "No hay alertas pendientes de revisión"
                : rango.modo === "rango"
                  ? "No hubo actividad en los últimos 7 días"
                  : "No hubo actividad el " + labelDia(rango.desde).toLowerCase()}
            </p>
            {rango.desde !== hoyStr() && (
              <button onClick={() => setRango({ modo: "dia", desde: hoyStr(), hasta: hoyStr() })}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all">
                Ver alertas de hoy
              </button>
            )}
          </div>
        ) : rango.modo === "rango" ? (
          <div className="space-y-5 pb-6">
            {ordenDias.map(dia => (
              <div key={dia} className="space-y-2.5">
                <SeparadorDia fecha={dia} count={gruposPorDia[dia].length} />
                {gruposPorDia[dia].map(grupo => (
                  <GrupoCard
                    key={grupo.id}
                    grupo={grupo}
                    esNueva={grupo.alertas.some(a => nuevasIds.has(a.id))}
                    onMarcarLeidas={marcarLeidas}
                    onVerPrestamo={(id) => navigate(`/prestamos/${id}`)}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5 pb-6">
            {grupos.map(grupo => (
              <GrupoCard
                key={grupo.id}
                grupo={grupo}
                esNueva={grupo.alertas.some(a => nuevasIds.has(a.id))}
                onMarcarLeidas={marcarLeidas}
                onVerPrestamo={(id) => navigate(`/prestamos/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}