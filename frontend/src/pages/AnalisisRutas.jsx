import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../services/api";

const formatMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
  }).format(value || 0);

const Skeleton = ({ className }) => (
  <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />
);

const getEstado = (ef) => {
  if (ef >= 80) return { label: "Excelente", color: "text-emerald-600", bg: "bg-emerald-100", avatarBg: "bg-emerald-100", avatarText: "text-emerald-700" };
  if (ef >= 60) return { label: "Estable",   color: "text-amber-500",   bg: "bg-amber-100",   avatarBg: "bg-amber-100",   avatarText: "text-amber-700"   };
  return            { label: "Riesgoso",  color: "text-red-600",    bg: "bg-red-100",     avatarBg: "bg-red-100",     avatarText: "text-red-700"     };
};

const getInitials = (nombre = "") =>
  nombre.trim().split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");

const timeAgo = (date) => {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return "Actualizado hace unos segundos";
  if (diff < 3600) return `Actualizado hace ${Math.floor(diff / 60)} min`;
  return `Actualizado hace ${Math.floor(diff / 3600)}h`;
};

export default function AnalisisRutas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tick, setTick] = useState(0);

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/finanzas/rutas");
      setData(res.data);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar datos de rutas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRutas(); }, [fetchRutas]);

  // Actualiza label "hace X min" cada minuto
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const rutasProcesadas = useMemo(() => {
    if (!data?.rutas) return [];
    return data.rutas.map((ruta) => {
      const eficiencia = ruta.dineroEnCalle > 0
        ? Math.round((ruta.capitalRecuperado / ruta.dineroEnCalle) * 10000) / 100 : 0;
      const rentabilidad = ruta.dineroEnCalle > 0
        ? Math.round((ruta.totalInteres / ruta.dineroEnCalle) * 10000) / 100 : 0;
      const riesgo = ruta.dineroEnCalle > 0 ? ruta.dineroEnCalle : 0;
      const score = Math.round((eficiencia * 0.5) + (rentabilidad * 0.3) - ((riesgo / 100000) * 0.2));
      return { ...ruta, eficiencia, rentabilidad, score };
    }).sort((a, b) => b.score - a.score);
  }, [data]);

  const topRuta = rutasProcesadas[0];

  const recomendaciones = useMemo(() => {
    if (!rutasProcesadas.length) return [];
    const rec = [];
    const top   = rutasProcesadas[0];
    const worst = rutasProcesadas[rutasProcesadas.length - 1];
    if (top?.eficiencia > 80)
      rec.push({ tipo: "SUCCESS", mensaje: `Invierte más en "${top.nombre}"`, accion: `Sugerido: +${formatMoney(Math.round(top.dineroEnCalle * 0.2))}` });
    if (worst?.eficiencia < 60 && worst?.dineroEnCalle > 0)
      rec.push({ tipo: "CRITICAL", mensaje: `Reduce exposición en "${worst.nombre}"`, accion: `Reducir: ${formatMoney(Math.round(worst.dineroEnCalle * 0.3))}` });
    return rec;
  }, [rutasProcesadas]);

  const alertasPriorizadas = useMemo(() => {
    if (!rutasProcesadas.length) return { criticas: [], normales: [] };
    const criticas = [], normales = [];
    rutasProcesadas.forEach((r) => {
      if (r.eficiencia < 50)       criticas.push({ ruta: r.nombre, mensaje: `Rendimiento crítico (${r.eficiencia}%)` });
      else if (r.eficiencia < 70)  normales.push({ ruta: r.nombre, mensaje: `Rendimiento bajo (${r.eficiencia}%)` });
      if (r.dineroEnCalle > 150000) normales.push({ ruta: r.nombre, mensaje: "Alto dinero en calle" });
    });
    return { criticas, normales };
  }, [rutasProcesadas]);

  const cobradores = useMemo(() => {
    if (!rutasProcesadas.length) return [];
    const map = {};
    rutasProcesadas.forEach((r) => {
      if (!map[r.cobrador]) map[r.cobrador] = { nombre: r.cobrador, rutas: 0, eficienciaTotal: 0, clientesTotal: 0 };
      map[r.cobrador].rutas += 1;
      map[r.cobrador].eficienciaTotal += r.eficiencia;
      map[r.cobrador].clientesTotal   += r.clientesActivos;
    });
    return Object.values(map)
      .map((c) => ({ ...c, eficienciaPromedio: Math.round(c.eficienciaTotal / c.rutas) }))
      .sort((a, b) => b.eficienciaPromedio - a.eficienciaPromedio);
  }, [rutasProcesadas]);

  const distribucion = useMemo(() => {
    if (!rutasProcesadas.length) return [];
    const total = rutasProcesadas.reduce((acc, r) => acc + r.dineroEnCalle, 0);
    return rutasProcesadas
      .map((r) => ({ nombre: r.nombre, dinero: r.dineroEnCalle, porcentaje: total > 0 ? Math.round((r.dineroEnCalle / total) * 100) : 0 }))
      .sort((a, b) => b.porcentaje - a.porcentaje);
  }, [rutasProcesadas]);

  const BAR_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4" style={{ animation: "fadeUp 0.3s ease both" }}>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-3xl mb-2">⚠️</p>
          <p className="text-red-700 font-semibold mb-1">No se pudieron cargar los datos</p>
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            onClick={fetchRutas}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>

      {/* ── Header con timestamp + botón refresh ─────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            📊 Análisis de Rutas
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Rendimiento de cobranza por zona</p>
          {lastUpdated && !loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              🕐 {timeAgo(lastUpdated)}
            </p>
          )}
        </div>
        {!loading && (
          <button
            onClick={fetchRutas}
            title="Actualizar datos"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-base"
          >
            🔄
          </button>
        )}
      </div>

      {/* ── Skeleton ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-36" />
          <Skeleton className="h-52" />
          <Skeleton className="h-64" />
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!loading && data && (
        <>
          {!data.rutas || data.rutas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium">No hay datos de rutas disponibles aún</p>
            </div>
          ) : (
            <>
              {/* ── Resumen Global ── grid-cols-2 con text-sm en móvil ── */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Cobrado",    value: formatMoney(data.totales?.totalCobrado),  color: "text-emerald-600" },
                  { label: "Total Interés",    value: formatMoney(data.totales?.totalInteres),   color: "text-amber-600"   },
                  { label: "En Calle",         value: formatMoney(data.totales?.dineroEnCalle),  color: "text-orange-600"  },
                  { label: "Clientes Activos", value: data.totales?.clientesActivos,             color: "text-blue-600"    },
                ].map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1 leading-tight">{item.label}</p>
                    <p className={`text-sm sm:text-lg font-bold leading-snug ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* ── Alertas Críticas ──────────────────────────────────── */}
              {alertasPriorizadas.criticas.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                  <h3 className="font-bold text-red-700 mb-2">🚨 Prioridad Alta</h3>
                  <div className="space-y-1">
                    {alertasPriorizadas.criticas.map((a, i) => (
                      <p key={i} className="text-sm text-red-600">
                        <span className="font-semibold">{a.ruta}:</span> {a.mensaje}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Recomendaciones ───────────────────────────────────── */}
              {recomendaciones.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">🧠 Recomendaciones</h3>
                  <div className="space-y-2">
                    {recomendaciones.map((r, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${
                        r.tipo === "SUCCESS"  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : r.tipo === "CRITICAL" ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}>
                        <p className="text-sm font-medium">{r.mensaje}</p>
                        <p className="text-xs opacity-80 mt-1">{r.accion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Alertas Normales ──────────────────────────────────── */}
              {alertasPriorizadas.normales.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-700 mb-2">⚠️ Revisar</h3>
                  {alertasPriorizadas.normales.map((a, i) => (
                    <p key={i} className="text-sm text-amber-600">
                      <span className="font-semibold">{a.ruta}:</span> {a.mensaje}
                    </p>
                  ))}
                </div>
              )}

              {/* ── Distribución del dinero ── ahora con monto real ──── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4">💰 Distribución del dinero</h3>
                <div className="space-y-4">
                  {distribucion.map((d, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center gap-2 mb-1.5">
                        <span className="text-sm text-gray-700 font-medium truncate">{d.nombre}</span>
                        <div className="shrink-0 flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-gray-800">{d.porcentaje}%</span>
                          <span className="text-xs text-gray-400">{formatMoney(d.dinero)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${d.porcentaje}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Cobradores ── con avatares de iniciales ───────────── */}
              {cobradores.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">👤 Rendimiento por cobrador</h3>
                  <div className="space-y-1">
                    {cobradores.map((c, i) => {
                      const estado = getEstado(c.eficienciaPromedio);
                      return (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${estado.avatarBg} ${estado.avatarText}`}>
                            {getInitials(c.nombre)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                            <p className="text-xs text-gray-400">
                              {c.rutas} {c.rutas === 1 ? "ruta" : "rutas"} · {c.clientesTotal} clientes
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-bold ${estado.color}`}>{c.eficienciaPromedio}%</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.bg} ${estado.color}`}>
                              {estado.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Mejor Rendimiento ── layout 2+1 sin truncar ──────── */}
              {topRuta && (() => {
                const ef = topRuta.eficiencia;
                return (
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-emerald-600 mb-3">🏆 Mejor Rendimiento</p>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center text-sm font-bold text-emerald-800">
                        {getInitials(topRuta.cobrador)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-gray-900 leading-tight truncate">{topRuta.nombre}</h3>
                        <p className="text-xs text-gray-500">{topRuta.cobrador}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Interés generado</p>
                        <p className="text-sm font-bold text-emerald-700">{formatMoney(topRuta.totalInteres)}</p>
                      </div>
                      <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Eficiencia</p>
                        <p className="text-sm font-bold text-emerald-700">{ef}%</p>
                      </div>
                    </div>
                    <div className="bg-white/70 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-0.5">Dinero en calle</p>
                      <p className="text-sm font-bold text-orange-600">{formatMoney(topRuta.dineroEnCalle)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Ranking de Rutas ─────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-700">Ranking de Rutas</h3>
                </div>

                {/* Desktop ≥ sm */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-9 gap-2 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
                    <div className="col-span-1">#</div>
                    <div className="col-span-2">Ruta</div>
                    <div className="col-span-2 text-right">Cobrado</div>
                    <div className="col-span-2 text-right">En Calle</div>
                    <div className="col-span-1 text-center">Efic.</div>
                    <div className="col-span-1 text-center">Estado</div>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                    {rutasProcesadas.map((ruta, index) => {
                      const ef = ruta.eficiencia;
                      const es = getEstado(ef);
                      return (
                        <div key={ruta.rutaId} className="grid grid-cols-9 gap-2 px-5 py-4 hover:bg-gray-50 transition-colors items-center">
                          <div className="col-span-1">
                            <span className={`text-sm font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-600" : "text-gray-400"}`}>
                              #{index + 1}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <p className="text-sm font-semibold text-gray-800 truncate">{ruta.nombre}</p>
                            <p className="text-xs text-gray-400">{ruta.cobrador}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-bold text-emerald-600">{formatMoney(ruta.totalCobrado)}</p>
                            <p className="text-xs text-gray-400">Int: {formatMoney(ruta.totalInteres)}</p>
                          </div>
                          <div className="col-span-2 text-right">
                            <p className="text-sm font-bold text-orange-600">{formatMoney(ruta.dineroEnCalle)}</p>
                          </div>
                          <div className="col-span-1 text-center">
                            <p className={`text-sm font-bold ${es.color}`}>{ef}%</p>
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${ef >= 80 ? "bg-emerald-100 text-emerald-700" : ef >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {es.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile < sm — tarjetas apiladas con layout 2+1 */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {rutasProcesadas.map((ruta, index) => {
                    const ef = ruta.eficiencia;
                    const es = getEstado(ef);
                    const rankColor = index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-600" : "text-gray-400";
                    return (
                      <div key={ruta.rutaId} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 text-base font-bold ${rankColor}`}>#{index + 1}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{ruta.nombre}</p>
                              <p className="text-xs text-gray-400 truncate">{ruta.cobrador}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${ef >= 80 ? "bg-emerald-100 text-emerald-700" : ef >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {es.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                            <p className="text-xs text-gray-400 mb-0.5">Cobrado</p>
                            <p className="text-xs font-bold text-emerald-600 leading-tight">{formatMoney(ruta.totalCobrado)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Int: {formatMoney(ruta.totalInteres)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                            <p className="text-xs text-gray-400 mb-0.5">Eficiencia</p>
                            <p className={`text-sm font-bold leading-tight ${es.color}`}>{ef}%</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5 min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">En Calle</p>
                          <p className="text-xs font-bold text-orange-600">{formatMoney(ruta.dineroEnCalle)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </>
          )}
        </>
      )}
    </div>
  );
}