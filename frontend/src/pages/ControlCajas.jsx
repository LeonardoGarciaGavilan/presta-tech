import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

function ControlCajas() {
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalCerrar, setModalCerrar] = useState(null);
  const [montoCierre, setMontoCierre] = useState('');
  const [cerrando, setCerrando] = useState(false);

  // ─── HELPERS DE RIESGO ────────────────────────────────────────────────
  const calcularRiesgo = (caja) => {
    let score = 0;
    if (caja.diferencia < 0) score += 50;
    if (Math.abs(caja.diferencia) > 1000) score += 30;
    if (caja.totalIngresos === 0) score += 10;
    if (caja.totalEgresos > caja.montoInicial) score += 10;
    return score;
  };

  const getNivelRiesgo = (score) => {
    if (score >= 70) return { label: 'CRÍTICO', color: 'text-red-600' };
    if (score >= 40) return { label: 'MEDIO', color: 'text-amber-500' };
    return { label: 'NORMAL', color: 'text-emerald-600' };
  };

  const getAccion = (caja) => {
    if (caja.diferencia < -1000) return 'Revisar inmediatamente';
    if (caja.diferencia < 0) return 'Verificar faltante';
    if (caja.diferencia > 2000) return 'Validar sobrante';
    return 'Operando normal';
  };

  const getHorasAbierta = (fecha) => {
    return (Date.now() - new Date(fecha)) / (1000 * 60 * 60);
  };

  const getEstadoTiempo = (horas) => {
    if (horas > 12) return { label: 'CRÍTICO', color: 'text-red-600' };
    if (horas > 8) return { label: 'ALERTA', color: 'text-amber-500' };
    return null;
  };

  const fetchCajas = async () => {
    try {
      setLoading(true);
      const fecha = new Date().toISOString().split('T')[0];
      const res = await api.get(`/caja/resumen?fecha=${fecha}`);
      setCajas(res.data.cajas || []);
    } catch (err) {
      console.error('Error fetching cajas:', err);
      setError('Error al cargar cajas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCajas();
  }, []);

  const cajasCalcular = useMemo(() => {
    return cajas.map((caja) => {
      const esperado = caja.montoInicial + caja.totalIngresos - caja.totalEgresos;
      const diferencia = esperado - (caja.montoCierre || esperado);
      let estado = 'CUADRADA';
      if (diferencia < -0.01) estado = 'FALTANTE';
      else if (diferencia > 0.01) estado = 'SOBRANTE';

      const horasAbierta = getHorasAbierta(caja.createdAt);
      const scoreRiesgo = calcularRiesgo({ ...caja, diferencia });

      return {
        ...caja,
        esperado,
        diferencia,
        estado,
        horasAbierta,
        scoreRiesgo,
      };
    });
  }, [cajas]);

  const kpis = useMemo(() => {
    const activas = cajasCalcular.filter((c) => c.estado === 'ABIERTA');
    const totalInicial = activas.reduce((sum, c) => sum + c.montoInicial, 0);
    const totalIngresos = activas.reduce((sum, c) => sum + c.totalIngresos, 0);
    const totalEgresos = activas.reduce((sum, c) => sum + c.totalEgresos, 0);
    const totalEsperado = totalInicial + totalIngresos - totalEgresos;
    const faltantes = activas.filter((c) => c.estado === 'FALTANTE');
    const sobrantes = activas.filter((c) => c.estado === 'SOBRANTE');
    const diferenciaGlobal = faltantes.reduce((sum, c) => sum + c.diferencia, 0) + sobrantes.reduce((sum, c) => sum + c.diferencia, 0);

    // KPIs de riesgo
    const cajasCriticas = activas.filter((c) => c.scoreRiesgo >= 70);
    const cajasTiempoAlto = activas.filter((c) => c.horasAbierta > 10);

    return {
      totalCajas: activas.length,
      totalInicial,
      totalIngresos,
      totalEgresos,
      totalEsperado,
      faltantes: faltantes.length,
      sobrantes: sobrantes.length,
      diferenciaGlobal,
      cajasCriticas: cajasCriticas.length,
      cajasTiempoAlto: cajasTiempoAlto.length,
    };
  }, [cajasCalcular]);

  const alertasCriticas = useMemo(() => {
    const alerts = [];
    const activas = cajasCalcular.filter((c) => c.estado === 'ABIERTA');

    // Cajas críticas por riesgo
    const criticas = activas.filter((c) => c.scoreRiesgo >= 70);
    criticas.forEach((caja) => {
      alerts.push({
        tipo: 'CRITICAL',
        mensaje: `Caja de ${caja.usuario?.nombre || 'Usuario'} en estado CRÍTICO (score: ${caja.scoreRiesgo})`,
        cajaId: caja.id,
      });
    });

    // sobrantes grandes
    activas.forEach((caja) => {
      if (caja.estado === 'FALTANTE') {
        alerts.push({
          tipo: 'CRITICAL',
          mensaje: `Caja de ${caja.usuario?.nombre || 'Usuario'} tiene faltante de RD$${Math.abs(caja.diferencia).toLocaleString()}`,
          cajaId: caja.id,
        });
      } else if (caja.estado === 'SOBRANTE' && caja.diferencia > 1000) {
        alerts.push({
          tipo: 'WARNING',
          mensaje: `Caja de ${caja.usuario?.nombre || 'Usuario'} tiene sobrante de RD$${caja.diferencia.toLocaleString()}`,
          cajaId: caja.id,
        });
      }
    });

    // Tiempo excesivo
    const tiempoAlto = activas.filter((c) => c.horasAbierta > 12);
    tiempoAlto.forEach((caja) => {
      alerts.push({
        tipo: 'CRITICAL',
        mensaje: `Caja de ${caja.usuario?.nombre || 'Usuario'} abierta por ${caja.horasAbierta.toFixed(1)}h`,
        cajaId: caja.id,
      });
    });

    if (activas.length > 3) {
      alerts.push({
        tipo: 'WARNING',
        mensaje: `${activas.length} cajas abiertas simultáneamente`,
      });
    }

    return alerts;
  }, [cajasCalcular]);

  const CajaCard = ({ caja }) => {
    const getEstadoColor = (estado) => {
      switch (estado) {
        case 'CUADRADA': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        case 'FALTANTE': return 'text-red-600 bg-red-50 border-red-200';
        case 'SOBRANTE': return 'text-amber-600 bg-amber-50 border-amber-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
      }
    };

    const getEstadoIcon = (estado) => {
      switch (estado) {
        case 'CUADRADA': return '🟢';
        case 'FALTANTE': return '🔴';
        case 'SOBRANTE': return '🟡';
        default: return '⚪';
      }
    };

    const riesgo = calcularRiesgo(caja);
    const nivel = getNivelRiesgo(riesgo);
    const accion = getAccion(caja);
    const horas = getHorasAbierta(caja.createdAt);
    const estadoTiempo = getEstadoTiempo(horas);

    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 relative">
        {/* Badge Score */}
        <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full bg-gray-100 font-medium">
          Score: {riesgo}
        </div>

        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">👤 {caja.usuario?.nombre || 'Usuario'}</h3>
            <p className="text-xs text-gray-500">
              🕒 Abierta: {new Date(caja.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(caja.estado)}`}>
            {getEstadoIcon(caja.estado)} {caja.estado}
          </span>
        </div>

        {/* Tiempo abierta */}
        <p className="text-xs mb-3">
          🕒 {horas.toFixed(1)}h abierta
          {estadoTiempo && (
            <span className={`ml-2 ${estadoTiempo.color}`}>
              ({estadoTiempo.label})
            </span>
          )}
        </p>

        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <p className="text-gray-500 text-xs">Inicial</p>
            <p className="font-medium">RD${caja.montoInicial.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Ingresos</p>
            <p className="font-medium text-emerald-600">+RD${caja.totalIngresos.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Egresos</p>
            <p className="font-medium text-red-600">-RD${caja.totalEgresos.toLocaleString()}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-xs">Esperado</p>
              <p className="text-lg font-bold">RD${caja.esperado.toLocaleString()}</p>
            </div>
            {caja.estado !== 'CUADRADA' && (
              <div className={`text-sm font-medium ${caja.estado === 'FALTANTE' ? 'text-red-600' : 'text-amber-600'}`}>
                {caja.estado === 'FALTANTE' ? '-' : '+'}RD${Math.abs(caja.diferencia).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Nivel de riesgo */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className={`text-sm font-semibold ${nivel.color}`}>
            Riesgo: {nivel.label}
          </span>
          <p className="text-xs text-gray-500 mt-1">
            Acción: <span className="font-medium">{accion}</span>
          </p>
        </div>

        {caja.estado === 'ABIERTA' && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => setModalCerrar(caja)}
              className="flex-1 bg-gray-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Cerrar caja
            </button>
          </div>
        )}
      </div>
    );
  };

  const formatMoney = (num) => {
    if (num == null) return 'RD$0';
    return `RD$${num.toLocaleString()}`;
  };

  const handleCerrarCaja = async () => {
    if (!modalCerrar || !montoCierre) return;

    try {
      setCerrando(true);
      await api.post('/caja/cerrar', {
        montoCierre: parseFloat(montoCierre),
      });
      setModalCerrar(null);
      setMontoCierre('');
      fetchCajas();
    } catch (err) {
      console.error('Error closing caja:', err);
      alert('Error al cerrar caja');
    } finally {
      setCerrando(false);
    }
  };

  // Ordenar por riesgo (mayor score primero)
  const sortedCajas = useMemo(() => {
    return [...cajasCalcular].sort((a, b) => calcularRiesgo(b) - calcularRiesgo(a));
  }, [cajasCalcular]);

  const cajasCriticas = cajasCalcular.filter((c) => calcularRiesgo(c) >= 70);
  const cajasConTiempoAlto = cajasCalcular.filter((c) => getHorasAbierta(c.createdAt) > 10);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Control de Cajas</h1>
          <p className="text-sm text-gray-500">Supervisión multiusuario en tiempo real</p>
        </div>
        <button
          onClick={fetchCajas}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin text-2xl">⏳</div>
          <p className="text-gray-500 mt-2">Cargando cajas...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-500 text-2xl">❌</div>
          <p className="text-red-600 mt-2">{error}</p>
          <button onClick={fetchCajas} className="mt-4 text-blue-600 hover:underline">
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-gray-500 text-xs">Cajas Activas</p>
              <p className="text-2xl font-bold text-gray-800">{kpis.totalCajas}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-gray-500 text-xs">Total Inicial</p>
              <p className="text-2xl font-bold text-gray-800">{formatMoney(kpis.totalInicial)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-gray-500 text-xs">Total Esperado</p>
              <p className="text-2xl font-bold text-gray-800">{formatMoney(kpis.totalEsperado)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-gray-500 text-xs">Diferencia Global</p>
              <p className={`text-2xl font-bold ${kpis.diferenciaGlobal !== 0 ? (kpis.diferenciaGlobal < 0 ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                {kpis.diferenciaGlobal !== 0 ? (kpis.diferenciaGlobal < 0 ? '-' : '+') : ''}{formatMoney(Math.abs(kpis.diferenciaGlobal))}
              </p>
            </div>
          </div>

          {/* Alertas Críticas */}
          {cajasCriticas.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl mb-4">
              🚨 {cajasCriticas.length} cajas en estado crítico
            </div>
          )}

          {cajasConTiempoAlto.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-4">
              ⚠️ {cajasConTiempoAlto.length} cajas abiertas por mucho tiempo
            </div>
          )}

          {alertasCriticas.length > 0 && (
            <div className="mb-6">
              {alertasCriticas.map((alerta, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border mb-2 ${
                    alerta.tipo === 'CRITICAL'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  {alerta.tipo === 'CRITICAL' ? '🚨' : '⚠️'} {alerta.mensaje}
                </div>
              ))}
            </div>
          )}

          {/* Listado de Cajas */}
          {kpis.totalCajas === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-gray-600">No hay cajas abiertas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCajas
                .filter((c) => c.estado === 'ABIERTA')
                .map((caja) => (
                  <CajaCard key={caja.id} caja={caja} />
                ))}
            </div>
          )}
        </>
      )}

      {/* Modal Cerrar Caja */}
      {modalCerrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Cerrar caja de {modalCerrar.usuario?.nombre}</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Inicial</p>
                  <p className="font-medium">RD${modalCerrar.montoInicial.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Esperado</p>
                  <p className="font-medium">RD${modalCerrar.esperado.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto de cierre (declare el efectivo físico)
                </label>
                <input
                  type="number"
                  value={montoCierre}
                  onChange={(e) => setMontoCierre(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {montoCierre && (
                <div className={`p-3 rounded-lg text-center font-medium ${
                  parseFloat(montoCierre) === modalCerrar.esperado
                    ? 'bg-emerald-50 text-emerald-700'
                    : parseFloat(montoCierre) < modalCerrar.esperado
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  Diferencia: {parseFloat(montoCierre) < modalCerrar.esperado ? '-' : '+'}RD$
                  {Math.abs(parseFloat(montoCierre) - modalCerrar.esperado).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setModalCerrar(null);
                  setMontoCierre('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCerrarCaja}
                disabled={cerrando || !montoCierre}
                className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlCajas;