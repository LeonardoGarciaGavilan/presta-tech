// src/pages/Auditoria.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const fmtFecha = (d) =>
  new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(d));

const formatCurrency = (v = 0) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2
  }).format(v);

const TIPO_COLORS = {
  CAJA: "bg-blue-100 text-blue-700 border-blue-200",
  PAGO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PRESTAMO: "bg-orange-100 text-orange-700 border-orange-200",
  CONFIGURACION: "bg-gray-100 text-gray-700 border-gray-200",
  AUTH: "bg-purple-100 text-purple-700 border-purple-200"
};

const NIVEL_COLORS = {
  INFO: "bg-blue-100 text-blue-700",
  WARN: "bg-yellow-100 text-yellow-700",
  ERROR: "bg-red-100 text-red-700"
};

const ACCION_COLORS = {
  CIERRE: "bg-blue-100 text-blue-700 border-blue-200",
  APERTURA: "bg-cyan-100 text-cyan-700 border-cyan-200",
  PAGO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  DESEMBOLSO: "bg-orange-100 text-orange-700 border-orange-200",
  SALDADO: "bg-green-100 text-green-700 border-green-200",
  CREATE: "bg-gray-100 text-gray-700 border-gray-200",
  UPDATE: "bg-yellow-100 text-yellow-700 border-yellow-200",
  CANCELADO: "bg-red-100 text-red-700 border-red-200",
  LOGIN_SUCCESS: "bg-green-100 text-green-700 border-green-200",
  LOGIN_FAILED: "bg-red-100 text-red-700 border-red-200",
  LOGIN_BLOCKED: "bg-red-100 text-red-700 border-red-200",
  LOGOUT: "bg-gray-100 text-gray-700 border-gray-200"
};

const Spin = () => (
  <div className="flex justify-center items-center py-20">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
  </div>
);

const getTipoColor = (tipo) => TIPO_COLORS[tipo] || "bg-gray-100 text-gray-700 border-gray-200";
const getAccionColor = (accion) => ACCION_COLORS[accion] || "bg-gray-100 text-gray-700 border-gray-200";
const getNivelColor = (nivel) => NIVEL_COLORS[nivel] || "bg-gray-100 text-gray-700";

const getFiltroRango = (tipo) => {
  const hoy = new Date();
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const fmt = (d) => {
    const año = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  };

  switch (tipo) {
    case 'hoy':
      return { desde: fmt(hoy), hasta: fmt(hoy) };
    case 'ayer':
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      return { desde: fmt(ayer), hasta: fmt(ayer) };
    case '7dias':
      return { desde: fmt(hace7), hasta: fmt(hoy) };
    default:
      return null;
  }
};

const DetalleModal = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Detalle de Auditoría</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Fecha</p>
              <p className="text-sm text-gray-900">{fmtFecha(item.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Nivel</p>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${getNivelColor(item.nivel)}`}>
                {item.nivel || "INFO"}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Tipo</p>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${getTipoColor(item.tipo)}`}>
                {item.tipo || "—"}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Acción</p>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${getAccionColor(item.accion)}`}>
                {item.accion || "—"}
              </span>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Usuario</p>
              <p className="text-sm text-gray-900">{item.usuario?.nombre || '—'}</p>
            </div>
            {item.empresa && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Empresa</p>
                <p className="text-sm text-gray-900">{item.empresa.nombre || '—'}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">IP</p>
              <p className="text-sm text-gray-600 font-mono text-xs">{item.ip || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Referencia ID</p>
              <p className="text-sm text-gray-600 font-mono text-xs">{item.referenciaId || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Descripción</p>
              <p className="text-sm text-gray-700">{item.descripcion || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Monto</p>
              <p className="text-sm font-bold text-gray-900">{item.monto != null ? formatCurrency(item.monto) : '—'}</p>
            </div>
          </div>

          {item.userAgent && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">User Agent</p>
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg break-all">{item.userAgent}</p>
            </div>
          )}

          {(item.datosAnteriores || item.datosNuevos) && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Datos Adicionales</p>
              {item.datosAnteriores && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500">Antes:</p>
                  <pre className="text-xs bg-red-50 text-red-700 p-2 rounded-lg overflow-x-auto">
                    {JSON.stringify(item.datosAnteriores, null, 2)}
                  </pre>
                </div>
              )}
              {item.datosNuevos && (
                <div>
                  <p className="text-xs text-gray-500">Después:</p>
                  <pre className="text-xs bg-green-50 text-green-700 p-2 rounded-lg overflow-x-auto">
                    {JSON.stringify(item.datosNuevos, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Auditoria() {
  const { user } = useAuth();
  const isSuperAdmin = user?.rol === "SUPERADMIN";
  
  const [data, setData] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filtros, setFiltros] = useState({
    empresaId: "",
    tipo: "",
    desde: "",
    hasta: ""
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const cargarEmpresas = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get("/superadmin/empresas");
      setEmpresas(res.data || []);
    } catch (e) {
      console.error("Error cargando empresas:", e);
    }
  }, [isSuperAdmin]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      
      if (isSuperAdmin && filtros.empresaId) {
        params.append("empresaId", filtros.empresaId);
      }
      if (filtros.tipo) params.append("tipo", filtros.tipo);
      if (filtros.desde) params.append("desde", filtros.desde);
      if (filtros.hasta) params.append("hasta", filtros.hasta);

      // Usar el mismo endpoint para todos los roles (el backend maneja la lógica)
      const res = await api.get(`/auditoria?${params}`);
      setData(res.data);
      setPage(1);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 401) {
        setError("No autorizado: tu sesión expiró o no tienes permisos");
      } else {
        setError("Error al cargar auditoría");
      }
    } finally {
      setLoading(false);
    }
  }, [filtros, isSuperAdmin]);

  useEffect(() => {
    cargar();
    cargarEmpresas();
  }, [cargar, cargarEmpresas]);

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const handleFiltroRapido = (tipo) => {
    const rango = getFiltroRango(tipo);
    if (rango) {
      setFiltros(prev => ({ ...prev, desde: rango.desde, hasta: rango.hasta }));
    }
  };

  const dataFiltrada = useMemo(() => {
    if (!search.trim()) return data;
    const lower = search.toLowerCase();
    return data.filter(item =>
      item.descripcion?.toLowerCase().includes(lower) ||
      item.tipo?.toLowerCase().includes(lower) ||
      item.accion?.toLowerCase().includes(lower) ||
      item.usuario?.nombre?.toLowerCase().includes(lower) ||
      item.empresa?.nombre?.toLowerCase().includes(lower)
    );
  }, [data, search]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return dataFiltrada.slice(start, start + pageSize);
  }, [dataFiltrada, page]);

  const totalPages = Math.ceil(dataFiltrada.length / pageSize);

  const kpis = useMemo(() => ({
    total: data.length,
    pagos: data.filter(d => d.tipo === "PAGO").length,
    auth: data.filter(d => d.tipo === "AUTH").length,
   prestamos: data.filter(d => d.tipo === "PRESTAMO").length,
    cajas: data.filter(d => d.tipo === "CAJA").length
  }), [data]);

  const exportarExcel = () => {
    const excelData = dataFiltrada.map(item => ({
      Fecha: fmtFecha(item.createdAt),
      Tipo: item.tipo || "",
      Acción: item.accion || "",
      Descripción: item.descripcion || "",
      Usuario: item.usuario?.nombre || "",
      Empresa: item.empresa?.nombre || "",
      IP: item.ip || "",
      Nivel: item.nivel || "INFO",
      Monto: item.monto || ""
    }));

    const headers = Object.keys(excelData[0] || {}).join('\t');
    const rows = excelData.map(row => Object.values(row).join('\t')).join('\n');
    const tsv = headers + '\n' + rows;

    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_${new Date().toISOString().slice(0,10)}.xlsx`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isSuperAdmin ? "Logs globales del sistema" : "Logs del sistema"}
          </p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={dataFiltrada.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className={`grid grid-cols-2 sm:grid-cols-${isSuperAdmin ? '6' : '5'} gap-3`}>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.total}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Pagos</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{kpis.pagos}</p>
        </div>
        <div className="bg-purple-50 rounded-xl border border-purple-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Auth</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{kpis.auth}</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Préstamos</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{kpis.prestamos}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Cajas</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{kpis.cajas}</p>
        </div>
        {isSuperAdmin && (
          <div className="bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Empresas</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{empresas.length}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFiltroRapido('hoy')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => handleFiltroRapido('ayer')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Ayer
          </button>
          <button
            onClick={() => handleFiltroRapido('7dias')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Últimos 7 días
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Filtro Empresa - Solo SUPERADMIN */}
          {isSuperAdmin && (
            <div className="min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Empresa</label>
              <select
                value={filtros.empresaId}
                onChange={(e) => handleFiltroChange("empresaId", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              >
                <option value="">Todas las empresas</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-[130px] flex-1 sm:flex-none">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Descripción, usuario..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          <div className="min-w-[120px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
            <select
              value={filtros.tipo}
              onChange={(e) => handleFiltroChange("tipo", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">Todos</option>
              <option value="AUTH">Auth</option>
              <option value="CAJA">Caja</option>
              <option value="PAGO">Pago</option>
              <option value="PRESTAMO">Préstamo</option>
              <option value="CONFIGURACION">Configuración</option>
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => handleFiltroChange("desde", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => handleFiltroChange("hasta", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          <button
            onClick={cargar}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <Spin />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={cargar}
              className="mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : dataFiltrada.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="font-medium">No hay registros de auditoría</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                    {isSuperAdmin && <th className="px-3 py-3 text-left font-semibold">Empresa</th>}
                    <th className="px-3 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-3 text-left font-semibold">Acción</th>
                    <th className="px-3 py-3 text-left font-semibold">Usuario</th>
                    <th className="px-3 py-3 text-left font-semibold">Nivel</th>
                    <th className="px-3 py-3 text-left font-semibold">IP</th>
                    <th className="px-3 py-3 text-left font-semibold">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedData.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                        {fmtFecha(item.createdAt)}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-3 py-2.5 text-gray-700 text-xs">
                          {item.empresa?.nombre || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${getTipoColor(item.tipo)}`}>
                          {item.tipo || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${getAccionColor(item.accion)}`}>
                          {item.accion || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 text-xs">
                        {item.usuario?.nombre || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${getNivelColor(item.nivel)}`}>
                          {item.nivel || "INFO"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs font-mono">
                        {item.ip || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-xs truncate text-xs">
                        {item.descripcion || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, dataFiltrada.length)} de {dataFiltrada.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DetalleModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}