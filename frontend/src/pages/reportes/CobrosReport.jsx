// CobrosReport.jsx — Tab de cobros por período
import { formatCurrency, formatDate, formatCedula } from "../../utils/prestamosUtils";
import { METODO_LABEL } from "./reporteConstants";
import { SumCard, Tabla } from "./reporteShared";

export default function CobrosReport({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Total cobrado" value={formatCurrency(data.totalCobrado)} color="text-emerald-600" bg="bg-emerald-50" />
        <SumCard label="Total capital" value={formatCurrency(data.totalCapital)} color="text-blue-600" />
        <SumCard label="Total intereses" value={formatCurrency(data.totalInteres)} color="text-amber-600" />
        <SumCard label="Total mora" value={formatCurrency(data.totalMora)} color="text-red-600" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <p className="text-xs text-gray-400 mb-3">{data.totalRegistros} pagos registrados</p>
        <div className="hidden sm:block">
          <Tabla
            headers={[
              { key: "fecha", label: "Fecha", render: (r) => formatDate(r.fecha) },
              { key: "cliente", label: "Cliente" },
              { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
              { key: "provincia", label: "Provincia", render: (r) => r.provincia || "—" },
              { key: "capital", label: "Capital", right: true, render: (r) => formatCurrency(r.capital) },
              { key: "interes", label: "Interés", right: true, render: (r) => formatCurrency(r.interes) },
              { key: "mora", label: "Mora", right: true, render: (r) => r.mora > 0 ? <span className="text-red-600">{formatCurrency(r.mora)}</span> : "—" },
              { key: "total", label: "Total", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.total)}</span> },
              { key: "metodo", label: "Método", render: (r) => METODO_LABEL[r.metodo] || r.metodo },
              { key: "cobrador", label: "Cobrador" },
            ]}
            rows={data.pagos}
            emptyMsg="Sin pagos en este período"
          />
        </div>
        <div className="sm:hidden space-y-2">
          {data.pagos.length === 0
            ? <p className="text-center py-8 text-gray-400">Sin pagos en este período</p>
            : data.pagos.map((r, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                    <p className="text-xs text-gray-400 font-mono">{formatCedula(r.cedula)} · {formatDate(r.fecha)}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 shrink-0">{formatCurrency(r.total)}</p>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Capital</p><p className="font-bold text-blue-700">{formatCurrency(r.capital)}</p></div>
                  <div className="bg-amber-50 rounded p-1.5 text-center"><p className="text-amber-400">Interés</p><p className="font-bold text-amber-700">{formatCurrency(r.interes)}</p></div>
                  <div className="bg-red-50 rounded p-1.5 text-center"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{r.mora > 0 ? formatCurrency(r.mora) : "—"}</p></div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
