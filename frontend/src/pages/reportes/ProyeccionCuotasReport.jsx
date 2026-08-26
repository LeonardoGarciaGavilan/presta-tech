// ProyeccionCuotasReport.jsx — Proyección de cuotas futuras
import { formatCurrency } from "../../utils/prestamosUtils";
import { fmtFechaCorta } from "./reporteHelpers";
import { SumCard, Tabla } from "./reporteShared";

export default function ProyeccionCuotasReport({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Préstamos activos" value={data.totalPrestamos} isCount color="blue" />
        <SumCard label="Cuotas pendientes" value={data.totalCuotasPendientes} isCount color="violet" />
        <SumCard label="Monto pendiente" value={data.totalMontoPendiente} color="emerald" />
        <SumCard label="Cuotas vencidas" value={data.totalVencidas} isCount color="red" />
      </div>

      {/* Resumen por mes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Proyección por mes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-medium">Mes</th>
                <th className="text-right py-2 text-gray-500 font-medium">Cuotas</th>
                <th className="text-right py-2 text-gray-500 font-medium">Capital</th>
                <th className="text-right py-2 text-gray-500 font-medium">Interés</th>
                <th className="text-right py-2 text-gray-500 font-medium">Mora</th>
                <th className="text-right py-2 text-gray-500 font-medium">Total</th>
                <th className="text-right py-2 text-gray-500 font-medium">Vencidas</th>
              </tr>
            </thead>
            <tbody>
              {data.porMes.map((m) => {
                const [y, mo] = m.month.split("-");
                const mesLabel = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("es-DO", { month: "long", year: "numeric" });
                return (
                  <tr key={m.month} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium text-gray-700 capitalize">{mesLabel}</td>
                    <td className="text-right py-2 text-gray-600">{m.cantidadCuotas}</td>
                    <td className="text-right py-2 text-gray-600">{formatCurrency(m.montoCapital)}</td>
                    <td className="text-right py-2 text-gray-600">{formatCurrency(m.montoInteres)}</td>
                    <td className="text-right py-2 text-amber-600">{formatCurrency(m.montoMora)}</td>
                    <td className="text-right py-2 font-semibold text-gray-800">{formatCurrency(m.montoTotal)}</td>
                    <td className="text-right py-2">
                      {m.vencidas > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          {m.vencidas}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-semibold">
                <td className="py-2 text-gray-700">Total</td>
                <td className="text-right py-2 text-gray-700">{data.totalCuotasPendientes}</td>
                <td className="text-right py-2 text-gray-700">
                  {formatCurrency(data.porMes.reduce((s, m) => s + m.montoCapital, 0))}
                </td>
                <td className="text-right py-2 text-gray-700">
                  {formatCurrency(data.porMes.reduce((s, m) => s + m.montoInteres, 0))}
                </td>
                <td className="text-right py-2 text-amber-700">
                  {formatCurrency(data.porMes.reduce((s, m) => s + m.montoMora, 0))}
                </td>
                <td className="text-right py-2 text-blue-700">{formatCurrency(data.totalMontoPendiente)}</td>
                <td className="text-right py-2">
                  {data.totalVencidas > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      {data.totalVencidas}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detalle de cuotas vencidas */}
      {data.detalles.filter((d) => d.vencida).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-3">
            Cuotas vencidas ({data.detalles.filter((d) => d.vencida).length})
          </h3>
          <Tabla
            headers={["Cliente", "Cédula", "Préstamo", "Cuota #", "Monto", "Vencimiento"]}
            rows={data.detalles
              .filter((d) => d.vencida)
              .map((d) => [
                <span className="font-medium text-gray-800">{d.cliente}</span>,
                <span className="text-gray-500 font-mono text-xs">{d.cedula}</span>,
                <span className="text-gray-500 text-xs">{d.prestamoId.slice(0, 8)}</span>,
                <span className="text-gray-600">#{d.numeroCuota}</span>,
                <span className="font-semibold text-red-600">{formatCurrency(d.monto)}</span>,
                <span className="text-gray-500 text-xs">{fmtFechaCorta(d.fechaVencimiento)}</span>,
              ])}
            emptyMessage=""
          />
        </div>
      )}
    </div>
  );
}
