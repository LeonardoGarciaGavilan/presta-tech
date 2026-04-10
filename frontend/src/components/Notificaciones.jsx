// src/components/Notificaciones.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificaciones } from "../hooks/useNotificaciones";

const formatCurrency = (n = 0) =>
  new Intl.NumberFormat("es-DO", { style:"currency", currency:"DOP", minimumFractionDigits:2 }).format(n);

const formatFecha = (f) =>
  f ? new Intl.DateTimeFormat("es-DO", { day:"2-digit", month:"short" }).format(new Date(f)) : null;

const TIPO_CONFIG = {
  HOY:      { label:"Vence hoy",  bg:"bg-orange-50 border-orange-200", badge:"bg-orange-100 text-orange-700", dot:"bg-orange-500", icon:"⏰" },
  PROXIMO:  { label:"Próxima",    bg:"bg-blue-50 border-blue-200",     badge:"bg-blue-100 text-blue-700",     dot:"bg-blue-400",   icon:"📅" },
  VENCIDA:  { label:"Vencida",    bg:"bg-red-50 border-red-200",       badge:"bg-red-100 text-red-700",       dot:"bg-red-500",    icon:"🚨" },
  ATRASADO: { label:"Atrasado",   bg:"bg-red-50 border-red-200",       badge:"bg-red-100 text-red-700",       dot:"bg-red-600",    icon:"⚠️" },
};

const AlertaCard = ({ alerta, onClick }) => {
  const cfg = TIPO_CONFIG[alerta.tipo] ?? TIPO_CONFIG.PROXIMO;
  return (
    <button onClick={() => onClick(alerta)}
      className={`w-full text-left px-3 py-2.5 rounded-lg border ${cfg.bg} hover:brightness-95 transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{cfg.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">{alerta.cliente}</p>
            <p className="text-xs text-gray-500 truncate">{alerta.mensaje}</p>
            {alerta.telefono && alerta.telefono !== "—" && <p className="text-[10px] text-gray-400 font-mono">{alerta.telefono}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold text-gray-800">{formatCurrency(alerta.monto)}</p>
          {alerta.fecha && <p className="text-[10px] text-gray-400">{formatFecha(alerta.fecha)}</p>}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
        </div>
      </div>
    </button>
  );
};

export default function Notificaciones() {
  const [open,      setOpen]      = useState(false);
  const [tabActivo, setTabActivo] = useState("todas");
  const panelRef                  = useRef(null);
  const navigate                  = useNavigate();
  const { alertas, resumen, total, urgentes, loading, refrescar } = useNotificaciones();

  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const alertasFiltradas = tabActivo === "todas" ? alertas
    : alertas.filter((a) => {
        if (tabActivo === "hoy")       return a.tipo === "HOY";
        if (tabActivo === "proximas")  return a.tipo === "PROXIMO";
        if (tabActivo === "vencidas")  return a.tipo === "VENCIDA";
        if (tabActivo === "atrasados") return a.tipo === "ATRASADO";
        return true;
      });

  const handleClick = (alerta) => { setOpen(false); navigate(`/prestamos/${alerta.prestamoId}`); };

  const TABS = [
    { id:"todas",     label:"Todas",     count:total },
    { id:"hoy",       label:"Hoy",       count:resumen.vencenHoy,       color:"text-orange-600" },
    { id:"vencidas",  label:"Vencidas",  count:resumen.vencidas,        color:"text-red-600" },
    { id:"proximas",  label:"Próximas",  count:resumen.proximasAVencer, color:"text-blue-600" },
    { id:"atrasados", label:"Atrasados", count:resumen.atrasados,       color:"text-red-700" },
  ];

  return (
    <div className="relative" ref={panelRef}>

      {/* Campana */}
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1 ${urgentes > 0 ? "bg-red-500" : "bg-blue-500"}`}>
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {/* Panel — full width en móvil, w-96 en sm+ */}
      {open && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto right-0 sm:right-0 top-16 sm:top-full sm:mt-2
          w-auto sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
          style={{ animation:"fadeDown 0.15s ease" }}>
          <style>{`@keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Notificaciones</h3>
              {urgentes > 0 && <p className="text-xs text-red-500 font-medium">{urgentes} urgente{urgentes > 1 ? "s" : ""}</p>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={refrescar} disabled={loading}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40">
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {/* Cerrar en móvil */}
              <button onClick={() => setOpen(false)} className="sm:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto scrollbar-hide">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTabActivo(t.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                  ${tabActivo === t.id ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[10px] font-bold ${tabActivo === t.id ? "text-white/70" : (t.color || "text-gray-400")}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto p-3 space-y-2">
            {loading
              ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
              : alertasFiltradas.length === 0
                ? <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-sm font-medium text-gray-500">{tabActivo === "todas" ? "Sin alertas pendientes" : "Sin alertas en esta categoría"}</p>
                    <p className="text-xs mt-1">Todo al día</p>
                  </div>
                : alertasFiltradas.map((a, i) => <AlertaCard key={`${a.prestamoId}-${a.tipo}-${i}`} alerta={a} onClick={handleClick} />)
            }
          </div>

          {!loading && total > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
              <p className="text-xs text-gray-400">Actualiza cada 15 min · <button onClick={refrescar} className="text-blue-500 hover:text-blue-700 font-medium">Actualizar ahora</button></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}