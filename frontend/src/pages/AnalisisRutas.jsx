import { useState, useEffect, useMemo } from "react";
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
  if (ef >= 80) return { label: "Excelente", color: "text-emerald-600" };
  if (ef >= 60) return { label: "Estable", color: "text-amber-500" };
  return { label: "Riesgoso", color: "text-red-600" };
};

export default function AnalisisRutas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRutas = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/finanzas/rutas");
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Error al cargar datos de rutas");
      } finally {
        setLoading(false);
      }
    };
    fetchRutas();
  }, []);

  // Procesamiento de datos con score
  const rutasProcesadas = useMemo(() => {
    if (!data?.rutas) return [];

    return data.rutas.map((ruta) => {
      const eficiencia = ruta.dineroEnCalle > 0
        ? Math.round((ruta.capitalRecuperado / ruta.dineroEnCalle) * 10000) / 100
        : 0;

      const rentabilidad = ruta.dineroEnCalle > 0
        ? Math.round((ruta.totalInteres / ruta.dineroEnCalle) * 10000) / 100
        : 0;

      const riesgo = ruta.dineroEnCalle > 0 ? ruta.dineroEnCalle : 0;

      const score = Math.round(
        (eficiencia * 0.5) +
        (rentabilidad * 0.3) -
        ((riesgo / 100000) * 0.2)
      );

      return {
        ...ruta,
        eficiencia,
        rentabilidad,
        score,
      };
    }).sort((a, b) => b.score - a.score);
  }, [data]);

  const topRuta = rutasProcesadas[0];

  // Recomendaciones con montos
  const recomendaciones = useMemo(() => {
    if (!rutasProcesadas.length) return [];

    const rec = [];

    const top = rutasProcesadas[0];
    const worst = rutasProcesadas[rutasProcesadas.length - 1];

    if (top?.eficiencia > 80) {
      rec.push({
        tipo: "SUCCESS",
        mensaje: `Invierte más en "${top.nombre}"`,
        accion: `Sugerido: +${formatMoney(Math.round(top.dineroEnCalle * 0.2))}`,
      });
    }

    if (worst?.eficiencia < 60 && worst?.dineroEnCalle > 0) {
      rec.push({
        tipo: "CRITICAL",
        mensaje: `Reduce exposición en "${worst.nombre}"`,
        accion: `Reducir: ${formatMoney(Math.round(worst.dineroEnCalle * 0.3))}`,
      });
    }

    return rec;
  }, [rutasProcesadas]);

// Alertas priorizadas
  const alertasPriorizadas = useMemo(() => {
    if (!rutasProcesadas.length) return { criticas: [], normales: [] };

    const criticas = [];
    const normales = [];

    rutasProcesadas.forEach((r) => {
      if (r.eficiencia < 50) {
        criticas.push({
          ruta: r.nombre,
          mensaje: `Rendimiento crítico (${r.eficiencia}%)`,
          tipo: "CRITICAL",
        });
      } else if (r.eficiencia < 70) {
        normales.push({
          ruta: r.nombre,
          mensaje: `Rendimiento bajo (${r.eficiencia}%)`,
          tipo: "WARNING",
        });
      }

      if (r.dineroEnCalle > 150000) {
        normales.push({
          ruta: r.nombre,
          mensaje: `Alto dinero en calle`,
          tipo: "WARNING",
        });
      }
    });

    return { criticas, normales };
  }, [rutasProcesadas]);

  // Análisis por cobrador
  const cobradores = useMemo(() => {
    if (!rutasProcesadas.length) return [];

    const map = {};

    rutasProcesadas.forEach((r) => {
      if (!map[r.cobrador]) {
        map[r.cobrador] = {
          nombre: r.cobrador,
          rutas: 0,
          eficienciaTotal: 0,
          clientesTotal: 0,
        };
      }
      map[r.cobrador].rutas += 1;
      map[r.cobrador].eficienciaTotal += r.eficiencia;
      map[r.cobrador].clientesTotal += r.clientesActivos;
    });

    return Object.values(map).map((c) => ({
      ...c,
      eficienciaPromedio: Math.round(c.eficienciaTotal / c.rutas),
    })).sort((a, b) => b.eficienciaPromedio - a.eficienciaPromedio);
  }, [rutasProcesadas]);

  // Distribución de dinero
  const distribucion = useMemo(() => {
    if (!rutasProcesadas.length) return [];

    const total = rutasProcesadas.reduce((acc, r) => acc + r.dineroEnCalle, 0);

    return rutasProcesadas
      .map((r) => ({
        nombre: r.nombre,
        dinero: r.dineroEnCalle,
        porcentaje: total > 0 ? Math.round((r.dineroEnCalle / total) * 100) : 0,
      }))
      .sort((a, b) => b.porcentaje - a.porcentaje);
  }, [rutasProcesadas]);

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5" style={{ animation: "fadeUp 0.3s ease both" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            📊 Análisis de Rutas
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Rendimiento de cobranza por zona
          </p>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <>
          {/* Empty State */}
          {!data.rutas || data.rutas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium">No hay datos de rutas disponibles aún</p>
            </div>
          ) : (
            <>
              {/* Resumen Global */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-400 mb-1">Total Cobrado</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">
                    {formatMoney(data.totales?.totalCobrado)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-400 mb-1">Total Interés</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-600">
                    {formatMoney(data.totales?.totalInteres)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-400 mb-1">En Calle</p>
                  <p className="text-lg sm:text-xl font-bold text-orange-600">
                    {formatMoney(data.totales?.dineroEnCalle)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-400 mb-1">Clientes Activos</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">
                    {data.totales?.clientesActivos}
                  </p>
                </div>
              </div>

              {/* Alertas Prioritarias */}
              {alertasPriorizadas.criticas.length > 0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                  <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2">
                    🚨 Prioridad Alta
                  </h3>
                  <div className="space-y-1">
                    {alertasPriorizadas.criticas.map((a, i) => (
                      <p key={i} className="text-sm text-red-600">
                        <span className="font-semibold">{a.ruta}:</span> {a.mensaje}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Recomendaciones Inteligentes */}
              {recomendaciones.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">🧠 Recomendaciones</h3>
                  <div className="space-y-2">
                    {recomendaciones.map((r, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${
                          r.tipo === "SUCCESS"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : r.tipo === "CRITICAL"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        <p className="text-sm font-medium">{r.mensaje}</p>
                        <p className="text-xs opacity-80 mt-1">{r.accion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alertas Normales */}
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

              {/* Distribución de Dinero */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4">💰 Distribución del dinero</h3>
                <div className="space-y-3">
                  {distribucion.map((d, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{d.nombre}</span>
                        <span className="font-semibold">{d.porcentaje}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${d.porcentaje}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Análisis por Cobrador */}
              {cobradores.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">👤 Rendimiento por cobrador</h3>
                  <div className="space-y-2">
                    {cobradores.map((c, i) => {
                      const estado = getEstado(c.eficienciaPromedio);
                      return (
                        <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-800">{c.nombre}</span>
                          <span className={`${estado.color} font-semibold`}>
                            {c.eficienciaPromedio}% ({estado.label})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Ruta */}
              {topRuta && (
                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      🏆 Mejor Rendimiento
                    </span>
                    <span className="text-xs text-gray-500">{topRuta.cobrador}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{topRuta.nombre}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Interés</p>
                      <p className="text-lg font-bold text-emerald-600">{formatMoney(topRuta.totalInteres)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Eficiencia</p>
                      <p className="text-lg font-bold text-emerald-600">{topRuta.eficiencia}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">En Calle</p>
                      <p className="text-lg font-bold text-orange-600">{formatMoney(topRuta.dineroEnCalle)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ranking de Rutas */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-700">Ranking de Rutas</h3>
                </div>

                {/* Header de tabla */}
                <div className="grid grid-cols-9 gap-2 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
                  <div className="col-span-1">#</div>
                  <div className="col-span-2">Ruta</div>
                  <div className="col-span-2 text-right">Cobrado</div>
                  <div className="col-span-1 text-right">En Calle</div>
                  <div className="col-span-1 text-center">Efic.</div>
                  <div className="col-span-1 text-center">Estado</div>
                </div>

                {/* Lista de rutas */}
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                  {rutasProcesadas.map((ruta, index) => {
                    const ef = ruta.eficiencia;
                    const es = getEstado(ef);

                    return (
                      <div
                        key={ruta.rutaId}
                        className="grid grid-cols-9 gap-2 px-5 py-4 hover:bg-gray-50 transition-colors items-center"
                      >
                        <div className="col-span-1">
                          <span
                            className={`text-sm font-bold ${
                              index === 0
                                ? "text-yellow-500"
                                : index === 1
                                ? "text-gray-400"
                                : index === 2
                                ? "text-amber-600"
                                : "text-gray-400"
                            }`}
                          >
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
                        <div className="col-span-1 text-right">
                          <p className="text-sm font-bold text-orange-600">{formatMoney(ruta.dineroEnCalle)}</p>
                        </div>
                        <div className="col-span-1 text-center">
                          <p className={`text-sm font-bold ${es.color}`}>
                            {ef}%
                          </p>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                            ef >= 80 ? "bg-emerald-100 text-emerald-700" :
                            ef >= 60 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {es.label}
                          </span>
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