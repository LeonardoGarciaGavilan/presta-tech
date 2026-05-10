import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatCurrency, formatDate, formatCedula, EstadoBadge } from "../utils/prestamosUtils";
import MiniMapa from "../components/MiniMapa";
import ClienteQuickActions from "../components/ClienteQuickActions";

const Spinner = () => (
  <div className="flex justify-center items-center py-20">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
    <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{value || "—"}</p>
  </div>
);

const KPI = ({ label, value, color = "blue" }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
    <p className={`text-2xl sm:text-3xl font-bold text-${color}-600`}>{value}</p>
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

const calcularSaldoReal = (prestamo) => {
  if (prestamo.saldoPendiente > 0) return prestamo.saldoPendiente;
  if (prestamo.cuotas?.length > 0) {
    return prestamo.cuotas.reduce((sum, c) => sum + (c.monto || 0) + (c.mora || 0), 0);
  }
  return prestamo.saldoPendiente ?? 0;
};

const formatearIngresos = (valor) => {
  if (valor == null) return null;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(valor);
};

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiarCoordenadas = () => {
    if (cliente?.latitud && cliente?.longitud) {
      navigator.clipboard.writeText(`${cliente.latitud},${cliente.longitud}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/clientes/${id}`)
      .then((res) => setCliente(res.data))
      .catch(() => setError("Cliente no encontrado"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleVolver = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/clientes");
    }
  };

  if (loading) return <Spinner />;

  if (error || !cliente) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="font-medium">{error || "Cliente no encontrado"}</p>
        <button onClick={() => navigate("/clientes")} className="mt-4 text-blue-600 text-sm hover:underline">
          Volver a clientes
        </button>
      </div>
    );
  }

  const prestamos = cliente.prestamos || [];
  const garantias = cliente.garantias || [];
  const rutaAsignada = cliente.rutaClientes?.[0]?.ruta?.nombre;
  const totalPrestamos = prestamos.length;
  const prestamosActivos = prestamos.filter((p) => p.estado === "ACTIVO" || p.estado === "ATRASADO");
  const prestamosPagados = prestamos.filter((p) => p.estado === "PAGADO");
  const saldoPendienteTotal = prestamosActivos.reduce((sum, p) => sum + calcularSaldoReal(p), 0);
  const ingresosFormateados = formatearIngresos(cliente.ingresos);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={handleVolver}
          className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5 shrink-0 p-0.5 -ml-0.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Detalle del Cliente</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
              cliente.activo
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                cliente.activo ? "bg-emerald-500" : "bg-gray-400"
              }`} />
              {cliente.activo ? "Activo" : "Inactivo"}
            </span>
            {rutaAsignada && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {rutaAsignada}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">Cliente desde {formatDate(cliente.createdAt)}</p>
        </div>
      </div>

      {/* KPIs financieros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Total préstamos" value={totalPrestamos} color="gray" />
        <KPI label="Préstamos activos" value={prestamosActivos.length} color="emerald" />
        <KPI label="Saldo pendiente" value={formatCurrency(saldoPendienteTotal)} color="blue" />
        <KPI label="Pagados" value={prestamosPagados.length} color="amber" />
      </div>

      {/* ⚡ Acciones rápidas */}
      <ClienteQuickActions cliente={cliente} prestamos={prestamos} />

      {/* Información del Cliente */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Información del Cliente</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <InfoItem label="Nombre completo" value={`${cliente.nombre} ${cliente.apellido || ""}`} />
          </div>
          <InfoItem label="Cédula" value={formatCedula(cliente.cedula || "")} />
          <InfoItem label="Teléfono" value={cliente.telefono} />
          <InfoItem label="Celular" value={cliente.celular} />
          <InfoItem label="Email" value={cliente.email} />
          <InfoItem label="Ocupación" value={cliente.ocupacion} />
          <InfoItem label="Empresa" value={cliente.empresaLaboral} />
          <InfoItem label="Provincia" value={cliente.provincia} />
          <InfoItem label="Municipio" value={cliente.municipio} />
          <InfoItem label="Sector" value={cliente.sector} />
          <div className="col-span-2">
            <InfoItem label="Dirección" value={cliente.direccion} />
          </div>
        </div>
      </div>

      {/* 🗺️ Ubicación */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">🗺️ Ubicación</h2>
          <div className="flex items-center gap-2">
            {cliente.latitud && cliente.longitud && (
              <>
                <button onClick={() => setMostrarMapa(m => !m)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    mostrarMapa
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  {mostrarMapa ? 'Ocultar mapa' : 'Mostrar mapa'}
                </button>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  cliente.coordsAproximadas
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cliente.coordsAproximadas ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  📍 Ubicación {cliente.coordsAproximadas ? 'aproximada' : 'exacta'}
                </span>
              </>
            )}
          </div>
        </div>

        {cliente.latitud && cliente.longitud ? (
          <>
            {mostrarMapa && (
              <MiniMapa
                lat={cliente.latitud}
                lng={cliente.longitud}
                readOnly
              />
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">📍 Coordenadas registradas</span>
                <button onClick={copiarCoordenadas}
                  className="text-xs font-semibold transition-colors text-blue-600 hover:text-blue-800">
                  {copiado ? '✓ Copiado' : 'Copiar coordenadas'}
                </button>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.latitud},${cliente.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Abrir en Google Maps
              </a>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-gray-400">📍 Este cliente no tiene ubicación registrada</p>
            <button disabled
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Actualizar ubicación
            </button>
          </div>
        )}
      </div>

      {/* Información Financiera */}
      {ingresosFormateados != null && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Información Financiera</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Ingresos declarados" value={`${ingresosFormateados}/mes`} />
          </div>
        </div>
      )}

      {/* Observaciones */}
      {cliente.observaciones && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Observaciones</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{cliente.observaciones}</p>
        </div>
      )}

      {/* Lista de préstamos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Préstamos ({totalPrestamos})
          </h2>
        </div>

        {totalPrestamos === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium">Este cliente no tiene préstamos</p>
          </div>
        ) : (
          <>
            {/* Tabla desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                    <th className="px-4 py-3 text-right font-semibold">Monto</th>
                    <th className="px-4 py-3 text-right font-semibold">Saldo pendiente</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold">Inicio</th>
                    <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                    <th className="px-4 py-3 text-right font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {prestamos.map((p) => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(p.monto)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{formatCurrency(calcularSaldoReal(p))}</td>
                      <td className="px-4 py-2.5"><EstadoBadge estado={p.estado} /></td>
                      <td className="px-4 py-2.5 text-gray-600">{formatDate(p.fechaInicio)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatDate(p.fechaVencimiento)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => navigate(`/prestamos/${p.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors">
                          Ver préstamo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards móvil */}
            <div className="sm:hidden divide-y divide-gray-50">
              {prestamos.map((p) => (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <EstadoBadge estado={p.estado} />
                    </div>
                    <button onClick={() => navigate(`/prestamos/${p.id}`)}
                      className="text-xs text-blue-600 hover:underline font-semibold">
                      Ver →
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="bg-blue-50 rounded p-1.5 text-center">
                      <p className="text-blue-400">Monto</p>
                      <p className="font-bold text-blue-700 mt-0.5">{formatCurrency(p.monto)}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-1.5 text-center">
                      <p className="text-gray-400">Saldo</p>
                      <p className="font-bold text-gray-700 mt-0.5">{formatCurrency(calcularSaldoReal(p))}</p>
                    </div>
                    <div className="bg-amber-50 rounded p-1.5 text-center">
                      <p className="text-amber-400">Vence</p>
                      <p className="font-bold text-amber-700 mt-0.5">{formatDate(p.fechaVencimiento)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Garantías */}
      {garantias.length > 0 && (
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">
            Garante en {garantias.length} préstamo(s)
          </h2>
          <div className="space-y-2">
            {garantias.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-500 font-mono truncate">{g.id.slice(0, 8)}…</span>
                  <span className="text-sm font-semibold text-gray-800">{formatCurrency(g.monto)}</span>
                  <EstadoBadge estado={g.estado} />
                </div>
                <button onClick={() => navigate(`/prestamos/${g.id}`)}
                  className="text-xs text-blue-600 hover:underline font-semibold shrink-0 ml-2">
                  Ver préstamo →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
