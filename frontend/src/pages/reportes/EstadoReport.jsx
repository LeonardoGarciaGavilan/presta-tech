// EstadoReport.jsx — Tab de estado general de préstamos
import { formatCurrency, formatCedula } from "../../utils/prestamosUtils";
import { ESTADO_COLOR, FRECUENCIA_LABEL } from "./reporteConstants";
import { SumCard, Tabla } from "./reporteShared";

export default function EstadoReport({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SumCard label="Activos" value={data.resumen.activos} color="text-emerald-600" bg="bg-emerald-50" />
        <SumCard label="Atrasados" value={data.resumen.atrasados} color="text-red-600" bg="bg-red-50" />
        <SumCard label="Pagados" value={data.resumen.pagados} color="text-blue-600" />
        <SumCard label="Cartera activa" value={formatCurrency(data.resumen.totalCartera)} color="text-gray-800" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <p className="text-xs text-gray-400 mb-3">
          Total desembolsado: <strong>{formatCurrency(data.resumen.totalDesembolsado)}</strong>
        </p>
        <div className="hidden sm:block">
          <Tabla
            headers={[
              { key: "cliente", label: "Cliente" },
              { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
              { key: "montoOriginal", label: "Monto", right: true, render: (r) => formatCurrency(r.montoOriginal) },
              { key: "saldoPendiente", label: "Saldo", right: true, render: (r) => formatCurrency(r.saldoPendiente) },
              { key: "tasaInteres", label: "Tasa", right: true, render: (r) => `${r.tasaInteres}%` },
              { key: "frecuencia", label: "Frecuencia", render: (r) => FRECUENCIA_LABEL[r.frecuencia] || r.frecuencia },
              { key: "estado", label: "Estado", render: (r) => <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[r.estado]}`}>{r.estado}</span> },
              { key: "cuotasPendientes", label: "Cuotas pend.", right: true },
            ]}
            rows={data.prestamos}
            emptyMsg="Sin préstamos registrados"
          />
        </div>
        <div className="sm:hidden space-y-2">
          {data.prestamos.map((r, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                  <p className="text-xs text-gray-400 font-mono">{formatCedula(r.cedula)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[r.estado]}`}>{r.estado}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Monto</p><p className="font-bold">{formatCurrency(r.montoOriginal)}</p></div>
                <div className="bg-blue-50 rounded p-1.5 text-center"><p className="text-blue-400">Saldo</p><p className="font-bold text-blue-700">{formatCurrency(r.saldoPendiente)}</p></div>
                <div className="bg-gray-50 rounded p-1.5 text-center"><p className="text-gray-400">Cuotas</p><p className="font-bold">{r.cuotasPendientes}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
