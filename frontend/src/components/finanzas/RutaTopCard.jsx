const formatMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
  }).format(value || 0);

export default function RutaTopCard({ ruta }) {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
          🏆 Mejor Rendimiento
        </span>
        <span className="text-xs text-gray-500">{ruta.cobrador}</span>
      </div>
      <h4 className="text-lg font-bold text-gray-900 mb-2">{ruta.nombre}</h4>
      <div className="flex gap-4 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Interés</p>
          <p className="font-bold text-emerald-600">{formatMoney(ruta.totalInteres)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Eficiencia</p>
          <p className="font-bold text-emerald-600">
            {ruta.eficiencia !== null ? `${ruta.eficiencia}%` : "N/A"}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">En Calle</p>
          <p className="font-bold text-orange-600">{formatMoney(ruta.dineroEnCalle)}</p>
        </div>
      </div>
    </div>
  );
}