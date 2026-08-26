// DesempenoCobradorReport.jsx — Desempeño por cobrador
import { formatCurrency } from "../../utils/prestamosUtils";
import { SumCard, Tabla } from "./reporteShared";

export default function DesempenoCobradorReport({ data }) {
  if (!data) return null;

  const metodos = Object.keys(data.cobradores[0]?.pagosPorMetodo ?? {});

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Total cobrado" value={data.totalCobrado} color="blue" />
        <SumCard label="Capital cobrado" value={data.totalCapital} color="emerald" />
        <SumCard label="Mora cobrada" value={data.totalMora} color="amber" />
        <SumCard label="Cobradores" value={data.cobradores.length} isCount color="gray" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SumCard label="Total pagos" value={data.cantidadPagos} isCount color="violet" />
        <SumCard label="Interés cobrado" value={data.totalInteres} color="cyan" />
        <SumCard
          label="Promedio por cobrador"
          value={data.cobradores.length > 0 ? data.totalCobrado / data.cobradores.length : 0}
          color="indigo"
        />
      </div>

      {/* Tabla principal */}
      <Tabla
        headers={["Cobrador", "Pagos", "Días activos", "Total cobrado", "Promedio/pago", "Promedio/día"]}
        rows={data.cobradores.map((c) => [
          <div>
            <span className="font-semibold text-gray-800">{c.nombre}</span>
          </div>,
          <span className="text-gray-700">{c.cantidadPagos}</span>,
          <span className="text-gray-500">{c.diasActivos}</span>,
          <span className="font-semibold text-blue-600">{formatCurrency(c.totalCobrado)}</span>,
          <span className="text-gray-600">{formatCurrency(c.promedioPorPago)}</span>,
          <span className="text-gray-600">{formatCurrency(c.promedioPorDia)}</span>,
        ])}
        emptyMessage="Sin datos de cobradores"
      />

      {/* Desglose por método por cobrador */}
      {metodos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Desglose por método de pago</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Cobrador</th>
                  {metodos.map((m) => (
                    <th key={m} className="text-right py-2 text-gray-500 font-medium">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cobradores.map((c) => (
                  <tr key={c.usuarioId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium text-gray-700">{c.nombre}</td>
                    {metodos.map((m) => (
                      <td key={m} className="text-right py-2 text-gray-600">
                        {c.pagosPorMetodo[m]
                          ? `${c.pagosPorMetodo[m].cantidad} (${formatCurrency(c.pagosPorMetodo[m].monto)})`
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
