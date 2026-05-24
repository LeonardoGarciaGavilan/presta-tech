import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatCurrency } from "../utils/prestamosUtils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Users, HandCoins, AlertTriangle, CreditCard, Banknote, TrendingUp } from "lucide-react";

const saludar = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
};

const Skeleton = ({ className }) => (
  <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />
);

const KpiCard = ({ label, value, sub, icon, accent }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${accent}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
    </div>
    <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-all">{value}</p>
    {sub !== "0" && sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
  </div>
);

const QuickActionCard = ({ icon, title, description, label, action, onClick, color }) => {
  const colors = {
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", hover: "hover:bg-blue-100" },
    green: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200", hover: "hover:bg-green-100" },
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", hover: "hover:bg-red-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", hover: "hover:bg-emerald-100" },
  };
  const c = colors[color] || colors.blue;

  return (
    <div
      className={`${c.bg} rounded-xl border ${c.border} p-4 hover:shadow-md transition-all cursor-pointer ${c.hover}`}
      onClick={onClick}
    >
      <div className={`${c.text} mb-2`}>{icon}</div>
      <h3 className="text-base font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200/60">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className={`text-sm font-medium ${c.text}`}>{action} →</span>
      </div>
    </div>
  );
};

const colors = {
  blue: { bg: "bg-blue-100", text: "text-blue-600" },
  green: { bg: "bg-green-100", text: "text-green-600" },
  red: { bg: "bg-red-100", text: "text-red-600" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-600" },
};

const IconWrapper = ({ icon: Icon, color }) => {
  const c = colors[color] || colors.blue;
  return (
    <div className={`p-2 rounded-lg ${c.bg}`}>
      <Icon className={`w-5 h-5 ${c.text}`} />
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const ResumenEjecutivo = ({ resumen, cobradoHoy, navigate }) => {
  const monto = resumen?.cobroEsperadoHoy?.monto || 0;
  const cuotas = resumen?.cobroEsperadoHoy?.cuotas || 0;
  const moraCritica = resumen?.moraCritica?.clientes || 0;
  const faltante = monto - (cobradoHoy || 0);

  if (monto === 0 && moraCritica === 0) return null;
 
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Hoy debes cobrar <span className="text-base">{formatCurrency(monto)}</span>
          </p>
          {cuotas > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{cuotas} cuota{cuotas !== 1 ? 's' : ''} por cobrar hoy {cuotas !== 1 ? 's' : ''}</p>
          )}
          {faltante > 0 && (
            <p className="text-xs text-orange-600 mt-1">
              Te faltan {formatCurrency(faltante)} para completar el día
            </p>
          )}
          {moraCritica > 0 && (
            <p className="text-xs text-red-600 mt-1">
              ⚠️ {moraCritica} cliente{moraCritica !== 1 ? 's' : ''} en mora crítica (+30 días)
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/pagos")}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Cobrar ahora
          </button>
          {moraCritica > 0 && (
            <button
              onClick={() => navigate("/prestamos?estado=atrasado")}
              className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 transition-colors"
            >
              Ver atrasados
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setRefreshing(true);
    setError(null);

    try {
      const response = await api.get("/dashboard");
      const { kpis, pagos, graficos, resumen } = response.data;

      setData({
        cantidades: kpis?.cantidades || {},
        saldoPendienteTotal: kpis?.saldoPendienteTotal || 0,
        cuotasVencidasHoy: kpis?.cuotasVencidasHoy || 0,
        pagosResumen: {
          cobradoHoy: pagos?.cobradoHoy || 0,
          cobradoMes: pagos?.cobradoMes || 0,
          pagosHoy: pagos?.pagosHoy || 0,
          pagosMes: pagos?.pagosMes || 0,
        },
        cobrosPorMes: graficos?.cobrosPorMes || [],
        totalClientes: kpis?.clientesActivos || 0,
        resumen,
      });
    } catch (err) {
      console.error("[Dashboard] Error:", err);
      setError("Error al cargar el dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (user?.empresaId) {
      fetchDashboard();
    }
  }, [user?.empresaId, fetchDashboard]);

  if (loading || !data) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );

  const d = data;
  const pagosHoy = d.pagosResumen?.pagosHoy || 0;
  const pagosMes = d.pagosResumen?.pagosMes || 0;

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {saludar()}, <span className="text-blue-600">{user?.nombre || user?.email?.split("@")[0]}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5 hidden sm:block">
            {new Intl.DateTimeFormat("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchDashboard}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 text-xs font-medium shadow-sm transition-all disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <ResumenEjecutivo resumen={d.resumen} cobradoHoy={d.pagosResumen?.cobradoHoy} navigate={navigate} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Cartera activa" value={formatCurrency(d.saldoPendienteTotal)} sub={null} icon="💼" accent="bg-blue-50" />
        <KpiCard label="Cobrado hoy" value={formatCurrency(d.pagosResumen?.cobradoHoy)} sub={pagosHoy > 0 ? `${pagosHoy} pagos` : null} icon="💰" accent="bg-emerald-50" />
        <KpiCard label="Atrasados" value={d.cantidades?.atrasados || 0} sub={d.cuotasVencidasHoy > 0 ? `${d.cuotasVencidasHoy} cuotas vencidas` : null} icon="⚠️" accent="bg-red-50" />
        <KpiCard label="Cobrado mes" value={formatCurrency(d.pagosResumen?.cobradoMes)} sub={pagosMes > 0 ? `${pagosMes} pagos` : null} icon="📅" accent="bg-amber-50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
        <QuickActionCard
          icon={<IconWrapper icon={Users} color="blue" />}
          title="Clientes"
          description="Gestiona tu cartera de clientes"
          label={`${d.totalClientes} clientes`}
          action="Abrir"
          onClick={() => navigate("/clientes")}
          color="blue"
        />

        <QuickActionCard
          icon={<IconWrapper icon={HandCoins} color="green" />}
          title="Nuevo préstamo"
          description="Registrar nuevo préstamo"
          label="Crear préstamo"
          action="Abrir"
          onClick={() => navigate("/prestamos/nuevo")}
          color="green"
        />

        <QuickActionCard
          icon={<IconWrapper icon={AlertTriangle} color="red" />}
          title="Atrasados"
          description="Clientes con cuotas vencidas"
          label={`${d.cantidades?.atrasados || 0} préstamos`}
          action="Abrir"
          onClick={() => navigate("/prestamos?estado=atrasado")}
          color="red"
        />

        <QuickActionCard
          icon={<IconWrapper icon={CreditCard} color="emerald" />}
          title="Cobros"
          description="Registrar pagos recibidos"
          label={pagosHoy > 0 ? `${pagosHoy} hoy` : "Sin cobros hoy"}
          action="Abrir"
          onClick={() => navigate("/pagos")}
          color="emerald"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Ingresos (RD$)</h2>
        {(!d.cobrosPorMes || d.cobrosPorMes.length === 0 || d.cobrosPorMes.every(m => m.monto === 0))
          ? <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Banknote className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm font-medium">Aún no hay datos</p>
              <p className="text-xs">Los ingresos aparecerán aquí</p>
            </div>
          : <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={d.cobrosPorMes} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCobros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="monto" name="Ingresos" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradCobros)" dot={{ fill: "#3b82f6", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
        }
      </div>

    </div>
  );
}