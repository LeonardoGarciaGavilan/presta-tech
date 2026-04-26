const formatMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
  }).format(value || 0);

export default function RutasResumen({ totales }) {
  return (
    <div className="grid grid-cols-4 gap-3 px-5 py-4">
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">Total Cobrado</p>
        <p className="text-base font-bold text-emerald-600">
          {formatMoney(totales.totalCobrado)}
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">Total Interés</p>
        <p className="text-base font-bold text-amber-600">
          {formatMoney(totales.totalInteres)}
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">En Calle</p>
        <p className="text-base font-bold text-orange-600">
          {formatMoney(totales.dineroEnCalle)}
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">Clientes</p>
        <p className="text-base font-bold text-blue-600">
          {totales.clientesActivos}
        </p>
      </div>
    </div>
  );
}