const formatMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
  }).format(value || 0);

const getColor = (ef) => {
  if (ef === null || ef === undefined) return "text-gray-400";
  if (ef >= 80) return "text-emerald-600";
  if (ef >= 60) return "text-amber-500";
  return "text-red-600";
};

const getMensaje = (ef) => {
  if (ef === null || ef === undefined) return null;
  if (ef >= 80) return "Excelente";
  if (ef >= 60) return "Estable";
  return "Bajo desempeño";
};

export default function RutaItem({ ruta, index }) {
  const ef = ruta.eficiencia;
  const colorClass = getColor(ef);
  const mensaje = getMensaje(ef);

  return (
    <div className="grid grid-cols-7 gap-2 px-5 py-3 hover:bg-gray-50 transition-colors items-center">
      <div className="col-span-1">
        <span className={`text-sm font-bold ${
          index === 1 ? "text-yellow-500" :
          index === 2 ? "text-gray-400" :
          index === 3 ? "text-amber-600" :
          "text-gray-400"
        }`}>
          #{index}
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
        <p className="text-sm font-bold">{ruta.clientesActivos}</p>
        {ef !== null && ef !== undefined && (
          <p className={`text-xs ${colorClass} font-medium`}>
            {ef >= 80 ? "✓" : ef >= 60 ? "◐" : "✗"} {ef}%
            {mensaje && <span className="hidden sm:inline"> · {mensaje}</span>}
          </p>
        )}
      </div>
    </div>
  );
}