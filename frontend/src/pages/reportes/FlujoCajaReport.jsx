// FlujoCajaReport.jsx — Flujo de caja: entradas vs salidas por día
import { formatCurrency } from "../../utils/prestamosUtils";
import { fmtFechaCorta } from "./reporteHelpers";
import { SumCard, Tabla } from "./reporteShared";

export default function FlujoCajaReport({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Entradas" value={data.totalEntradas} color="emerald" />
        <SumCard label="Salidas" value={data.totalSalidas} color="red" />
        <SumCard label="Neto" value={data.neto} color={data.neto >= 0 ? "blue" : "red"} />
        <SumCard
          label="Días con movimiento"
          value={data.porDia.length}
          isCount
          color="gray"
        />
      </div>

      {/* Desglose */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Entradas</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pagos recibidos</span>
              <span className="font-semibold text-emerald-600">
                {formatCurrency(data.desgloseEntradas.pagos)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Inyecciones de capital</span>
              <span className="font-semibold text-emerald-600">
                {formatCurrency(data.desgloseEntradas.inyecciones)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Salidas</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Desembolsos (préstamos)</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(data.desgloseSalidas.desembolsos)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Gastos operativos</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(data.desgloseSalidas.gastos)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Retiros de ganancias</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(data.desgloseSalidas.retiros)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Gastos por categoría */}
      {Object.keys(data.gastosPorCategoria).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Gastos por categoría</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data.gastosPorCategoria)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, monto]) => (
                <div key={cat} className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500 block">{cat}</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {formatCurrency(monto)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabla por día */}
      <Tabla
        headers={["Fecha", "Entradas", "Salidas", "Neto"]}
        rows={data.porDia.map((d) => [
          fmtFechaCorta(d.fecha),
          <span className="text-emerald-600 font-medium">{formatCurrency(d.entradas)}</span>,
          <span className="text-red-600 font-medium">{formatCurrency(d.salidas)}</span>,
          <span className={`font-semibold ${d.neto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(d.neto)}
          </span>,
        ])}
        emptyMessage="Sin movimientos en el período"
      />
    </div>
  );
}
