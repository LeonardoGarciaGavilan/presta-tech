import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatCurrency, formatDate, formatCedula } from "../utils/prestamosUtils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

if (typeof document !== "undefined" && !document.getElementById("dashboard-styles")) {
  const s = document.createElement("style");
  s.id = "dashboard-styles";
  s.textContent = `@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(s);
}

// ─── Cache helpers multi-tenant ──────────────────────────────────────────────────
const CACHE_TTL = 30 * 1000; // 30 segundos (reducido para menor riesgo de datos stale)

const getCacheKey = (empresaId) => empresaId ? `dashboard_cache_${empresaId}` : null;

const getCached = (empresaId) => {
  const cacheKey = getCacheKey(empresaId);
  if (!cacheKey) return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { data: parsed.data, ts: parsed.ts, expired: Date.now() - parsed.ts > CACHE_TTL };
  } catch { return null; }
};

const setCache = (data, empresaId) => {
  const cacheKey = getCacheKey(empresaId);
  if (!cacheKey) return;
  try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch {}
};

export const clearDashboardCache = (empresaId = null) => {
  const cacheKey = getCacheKey(empresaId);
  if (cacheKey) {
    try { localStorage.removeItem(cacheKey); } catch {}
  }
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("dashboard_cache_")) {
        localStorage.removeItem(key);
      }
    });
  } catch {}
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const saludar = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
};
const mes = (fecha) => new Intl.DateTimeFormat("es-DO", { month: "short" }).format(new Date(fecha));

const Skeleton = ({ className }) => (
  <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon, accent, delay = 0 }) => (
  <div
    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all"
    style={{ animation: `fadeUp 0.4s ease both`, animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${accent}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
    </div>
    <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-all">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
  </div>
);

// ─── Tooltip gráficos ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, currency = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {currency ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheAge,   setCacheAge]   = useState(null);
  const fetchingRef  = useRef(false);

  // ─── Procesador de datos crudos ─────────────────────────────────────────────
  const processRawData = useCallback((pRes, pgRes, allPres, allPagos, allClientes = []) => {
    const prestamos = allPres || [];
    const pagos     = allPagos || [];
    const clientes  = allClientes || [];
    const ahora     = new Date();

    const cobrosMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      cobrosMap[`${d.getFullYear()}-${d.getMonth()}`] = { mes: mes(d), cobrado: 0, pagos: 0 };
    }
    pagos.forEach((p) => {
      const d = new Date(p.createdAt), key = `${d.getFullYear()}-${d.getMonth()}`;
      if (cobrosMap[key]) { cobrosMap[key].cobrado += p.montoTotal; cobrosMap[key].pagos += 1; }
    });

    const desembolsosMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      desembolsosMap[`${d.getFullYear()}-${d.getMonth()}`] = { mes: mes(d), monto: 0, cantidad: 0 };
    }
    prestamos.forEach((p) => {
      const d = new Date(p.createdAt), key = `${d.getFullYear()}-${d.getMonth()}`;
      if (desembolsosMap[key]) { desembolsosMap[key].monto += p.monto; desembolsosMap[key].cantidad += 1; }
    });

    const resumen = pRes || { cantidades: {}, totalSaldo: 0 };
    const distribucion = [
      { name: "Activos",    value: resumen.cantidades?.activos ?? 0,    color: "#10b981" },
      { name: "Atrasados",  value: resumen.cantidades?.atrasados ?? 0,  color: "#ef4444" },
      { name: "Pagados",    value: resumen.cantidades?.pagados ?? 0,    color: "#3b82f6" },
      { name: "Cancelados", value: resumen.cantidades?.cancelados ?? 0, color: "#9ca3af" },
    ].filter((d) => d.value > 0);

    const clientesActivos     = clientes.filter((c) => c.activo).length;
    const clientesConPrestamo = [...new Set(prestamos.map((p) => p.clienteId))].length;
    const atrasados           = prestamos.filter((p) => p.estado === "ATRASADO").slice(0, 6);

    const hoy7 = new Date(); hoy7.setDate(hoy7.getDate() + 7);
    const proximasCuotas = prestamos
      .filter((p) => ["ACTIVO", "ATRASADO"].includes(p.estado))
      .flatMap((p) => (p.cuotas ?? [])
        .filter((c) => {
          const f = new Date(c.fechaVencimiento);
          return !c.pagada && f >= new Date() && f <= hoy7;
        })
        .map((c) => ({ ...c, prestamo: p }))
      )
      .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
      .slice(0, 6);

    return {
      prestamosResumen:  resumen,
      pagosResumen:      pgRes || { cobradoHoy: 0,cobradoMes: 0,pagosHoy: 0,pagosMes: 0 },
      cobrosPorMes:      Object.values(cobrosMap),
      desembolsosPorMes: Object.values(desembolsosMap),
      distribucion, atrasados, proximasCuotas,
      clientesRecientes: [...clientes]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
      totalClientes:        clientes.length,
      clientesActivos,
      clientesConPrestamo,
      clientesSinPrestamo:  Math.max(0, clientesActivos - clientesConPrestamo),
    };
  }, []);

  // ─── Fetch real desde el servidor ──────────────────────────────────────────
  const fetchFromServer = useCallback(async (empresaId, silent = false) => {
    if (!empresaId) return;
    
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setRefreshing(true);

    try {
      const [pRes, pgRes, allPres, allPagos, allClientes] = await Promise.all([
        api.get("/prestamos/resumen"),
        api.get("/pagos/resumen"),
        api.get("/prestamos?limit=1000"),
        api.get("/pagos"),
        api.get("/clientes?limit=1000"),
      ]);

      const prestamosArray = Array.isArray(allPres.data)
        ? allPres.data
        : (allPres.data?.data ?? []);

      const clientesArray = Array.isArray(allClientes.data)
        ? allClientes.data
        : (allClientes.data?.data ?? []);

      const pagosArray = Array.isArray(allPagos.data)
        ? allPagos.data
        : (allPagos.data?.data ?? []);

      const processed = processRawData(
        pRes.data, pgRes.data,
        prestamosArray, pagosArray, clientesArray,
      );

      setCache(processed, empresaId);
      setData(processed);
      setCacheAge("justo ahora");
    } catch (err) {
      console.error("[Dashboard] Error fetching:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [processRawData]);

  // ─── Estrategia stale-while-revalidate ─────────────────────────────────────
  const fetchAll = useCallback(async (force = false) => {
    const empresaId = user?.empresaId;
    if (!empresaId) {
      setLoading(false);
      return;
    }
    
    const cached = getCached(empresaId);
    if (!force && cached) {
      setData(cached.data);
      setLoading(false);
      const mins = Math.floor((Date.now() - cached.ts) / 60000);
      setCacheAge(mins === 0 ? "justo ahora" : `hace ${mins} min`);
      if (cached.expired) fetchFromServer(empresaId, true);
      return;
    }
    setLoading(!data);
    await fetchFromServer(empresaId, false);
  }, [data, fetchFromServer, user?.empresaId]);

  // ─── Fetch cuando user esté disponible ────────────────────────────────────────
  useEffect(() => {
    if (!user?.empresaId) return;
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.empresaId]);

  // ─── Skeleton ──────────────────────────────────────────────────────────────
  if (loading || !data) return (
    <div className="space-y-4 sm:space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 sm:h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    </div>
  );

  const d = data || {};

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Saludo + botón refresh ── */}
      <div className="flex items-start justify-between gap-3" style={{ animation: "fadeUp 0.3s ease both" }}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {saludar()}, <span className="text-blue-600">{user?.nombre || user?.email?.split("@")[0]}</span> 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5 hidden sm:block">
            {new Intl.DateTimeFormat("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {cacheAge && (
            <span className="text-[10px] text-gray-400 hidden sm:block">Actualizado {cacheAge}</span>
          )}
          {refreshing && !loading && (
            <span className="text-[10px] text-blue-400 hidden sm:flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizando…
            </span>
          )}
          <button
            onClick={() => { clearDashboardCache(user?.empresaId); fetchAll(true); }}
            disabled={refreshing}
            title="Forzar actualización"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 text-xs font-medium shadow-sm transition-all disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Cartera activa"   value={formatCurrency(d.prestamosResumen?.saldoPendienteTotal ?? 0)} sub="Saldo pendiente total"                icon="💼" accent="bg-blue-50"    delay={0}   />
        <KpiCard label="Cobrado hoy"      value={formatCurrency(d.pagosResumen?.cobradoHoy ?? 0)}             sub={`${d.pagosResumen?.pagosHoy ?? 0} pagos`}   icon="💰" accent="bg-emerald-50" delay={60}  />
        <KpiCard label="Atrasados"        value={d.prestamosResumen?.cantidades?.atrasados ?? 0}               sub={`${d.prestamosResumen?.cuotasVencidasHoy ?? 0} cuotas vencidas`} icon="⚠️" accent="bg-red-50" delay={120} />
        <KpiCard label="Cobrado este mes" value={formatCurrency(d.pagosResumen?.cobradoMes ?? 0)}             sub={`${d.pagosResumen?.pagosMes ?? 0} pagos`}   icon="📅" accent="bg-amber-50"   delay={180} />
      </div>

      {/* ── Stats secundarias ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3" style={{ animation: "fadeUp 0.4s ease 0.2s both" }}>
        {[
          { label: "Total préstamos", value: Object.values(d.prestamosResumen?.cantidades ?? {}).reduce((a, b) => a + b, 0), color: "text-gray-800"    },
          { label: "Activos",         value: d.prestamosResumen?.cantidades?.activos ?? 0,    color: "text-emerald-600" },
          { label: "Pagados",         value: d.prestamosResumen?.cantidades?.pagados ?? 0,    color: "text-blue-600"   },
          { label: "Total clientes",  value: d.totalClientes ?? 0,                          color: "text-gray-800"   },
          { label: "Con préstamo",    value: d.clientesConPrestamo ?? 0,                    color: "text-violet-600" },
          { label: "Sin préstamo",    value: d.clientesSinPrestamo ?? 0,                   color: "text-gray-400"   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 px-2 py-2.5 sm:px-3 sm:py-3 text-center shadow-sm">
            <p className={`text-base sm:text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[9px] sm:text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Gráficos fila 1: área + pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          style={{ animation: "fadeUp 0.4s ease 0.25s both" }}>
          <h2 className="text-sm font-bold text-gray-700 mb-3 sm:mb-4">Cobros últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={d.cobrosPorMes ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCobros" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip currency />} />
              <Area type="monotone" dataKey="cobrado" name="Cobrado" stroke="#3b82f6"
                strokeWidth={2.5} fill="url(#gradCobros)" dot={{ fill: "#3b82f6", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          style={{ animation: "fadeUp 0.4s ease 0.3s both" }}>
          <h2 className="text-sm font-bold text-gray-700 mb-3">Distribución cartera</h2>
          {(!d.distribucion || d.distribucion.length === 0)
            ? <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sin datos</div>
            : <>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={d.distribucion} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
                      paddingAngle={3} dataKey="value">
                      {d.distribucion.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => v} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                  {d.distribucion.map((e) => (
                    <div key={e.name} className="flex items-center gap-1 text-xs text-gray-600">
                      <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                      {e.name} <span className="font-bold text-gray-800">{e.value}</span>
                    </div>
                  ))}
                </div>
              </>
          }
        </div>
      </div>

      {/* ── Gráficos fila 2: barras + clientes recientes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          style={{ animation: "fadeUp 0.4s ease 0.35s both" }}>
          <h2 className="text-sm font-bold text-gray-700 mb-3 sm:mb-4">Desembolsos por mes</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={d.desembolsosPorMes ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip currency />} />
              <Bar dataKey="monto" name="Monto" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ animation: "fadeUp 0.4s ease 0.4s both" }}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">Clientes recientes</h2>
            <button onClick={() => navigate("/clientes")} className="text-xs text-blue-500 hover:underline font-medium">Ver todos →</button>
          </div>
          {(!d.clientesRecientes || d.clientesRecientes.length === 0)
            ? <div className="text-center py-10 text-gray-400 text-sm">Sin clientes registrados</div>
            : <div className="divide-y divide-gray-50">
                {d.clientesRecientes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 sm:px-5 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                        {c.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.nombre} {c.apellido}</p>
                        <p className="text-xs text-gray-400 font-mono hidden sm:block">{formatCedula(c.cedula || "")}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.activo ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-gray-100 text-gray-400"}`}>
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{formatDate(c.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* ── Fila 3: atrasados + próximas cuotas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ animation: "fadeUp 0.4s ease 0.45s both" }}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-sm font-bold text-gray-700">Préstamos Atrasados</h2>
            </div>
            <button onClick={() => navigate("/prestamos")} className="text-xs text-blue-500 hover:underline font-medium">Ver todos →</button>
          </div>
          {(!d.atrasados || d.atrasados.length === 0)
            ? <div className="text-center py-8 text-gray-400 text-sm">Sin préstamos atrasados</div>
            : <div className="space-y-2">
                {d.atrasados.map((p) => {
                  const cuota = p.cuotas?.[0];
                  return (
                    <div key={p.id}
                      className="flex items-center justify-between px-4 sm:px-5 py-2.5 hover:bg-red-50/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/prestamos/${p.id}`)}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.cliente?.nombre} {p.cliente?.apellido}</p>
                        <p className="text-xs text-gray-400 font-mono hidden sm:block">{formatCedula(p.cliente?.cedula || "")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600">{formatCurrency(p.saldoPendiente)}</p>
                        {cuota && <p className="text-xs text-red-400">Vence: {formatDate(cuota.fechaVencimiento)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          style={{ animation: "fadeUp 0.4s ease 0.5s both" }}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <h2 className="text-sm font-bold text-gray-700">Próximas <span className="text-gray-400 font-normal">(7 días)</span></h2>
            </div>
            <button onClick={() => navigate("/pagos")} className="text-xs text-blue-500 hover:underline font-medium">Cobrar →</button>
          </div>
          {(!d.proximasCuotas || d.proximasCuotas.length === 0)
            ? <div className="text-center py-8 text-gray-400 text-sm">Sin cuotas próximas</div>
            : <div className="space-y-2">
                {d.proximasCuotas.map((c) => {
                  const dias = Math.ceil((new Date(c.fechaVencimiento) - new Date()) / 86400000);
                  return (
                    <div key={c.id}
                      className="flex items-center justify-between px-4 sm:px-5 py-2.5 hover:bg-amber-50/40 cursor-pointer transition-colors"
                      onClick={() => navigate("/pagos")}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.prestamo.cliente?.nombre} {c.prestamo.cliente?.apellido}</p>
                        <p className={`text-xs font-medium mt-0.5 ${dias <= 1 ? "text-red-500" : "text-amber-500"}`}>
                          {dias === 0 ? "Vence hoy" : `En ${dias} día${dias !== 1 ? "s" : ""}`} · #{c.numero}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-800">{formatCurrency(c.monto + (c.mora || 0))}</p>
                        <p className="text-xs text-gray-400 hidden sm:block">{formatDate(c.fechaVencimiento)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>
    </div>
  );
}