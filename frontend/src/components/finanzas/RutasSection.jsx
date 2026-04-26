import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import RutasResumen from "./RutasResumen";
import RutaTopCard from "./RutaTopCard";
import RutaItem from "./RutaItem";
import RutasSkeleton from "./RutasSkeleton";

export default function RutasSection() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const sectionRef = useRef(null);
  const hasFetched = useRef(false);

  const fetchRutas = async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/finanzas/rutas");
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Error al cargar rutas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchRutas();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const rentabilidadRuta = (interes, capitalRecuperado) =>
    capitalRecuperado > 0
      ? Math.round((interes / capitalRecuperado) * 10000) / 100
      : null;

  const eficienciaRuta = (capitalRecuperado, dineroEnCalle) =>
    dineroEnCalle > 0
      ? Math.round((capitalRecuperado / dineroEnCalle) * 10000) / 100
      : null;

  if (loading) {
    return <RutasSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!data?.rutas || data.rutas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
        <p className="text-gray-400 text-sm">No hay rutas registradas aún</p>
      </div>
    );
  }

const rutasConMetricas = data.rutas.map((ruta) => ({
    ...ruta,
    rentabilidad: rentabilidadRuta(ruta.totalInteres, ruta.capitalRecuperado),
    eficiencia: eficienciaRuta(ruta.capitalRecuperado, ruta.dineroEnCalle),
  }));

  const rutasOrdenadas = [...rutasConMetricas].sort((a, b) => {
    const efA = a.eficiencia || 0;
    const efB = b.eficiencia || 0;
    return efB - efA;
  });

  const mejorRuta = rutasOrdenadas[0];

  return (
    <div
      ref={sectionRef}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ animation: "fadeUp 0.4s ease 500ms both" }}
    >
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700">📍 Rutas Financieras</h3>
      </div>

      <RutasResumen totales={data.totales} />

      {mejorRuta && (
        <div className="px-5 pb-4">
          <RutaTopCard ruta={mejorRuta} />
        </div>
      )}

      <div className="border-t border-gray-100">
        <div className="grid grid-cols-7 gap-2 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Ruta</div>
          <div className="col-span-2 text-right">Cobrado</div>
          <div className="col-span-1 text-right">En Calle</div>
          <div className="col-span-1 text-right">Clientes</div>
        </div>
        
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {rutasOrdenadas.map((ruta, index) => (
            <RutaItem
              key={ruta.rutaId}
              ruta={ruta}
              index={index + 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}