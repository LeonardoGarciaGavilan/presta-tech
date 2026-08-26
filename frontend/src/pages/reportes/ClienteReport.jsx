// ClienteReport.jsx — Tab de historial por cliente
import { formatCurrency, formatDate, formatCedula } from "../../utils/prestamosUtils";
import { ESTADO_COLOR, METODO_LABEL } from "./reporteConstants";
import { SumCard, Tabla } from "./reporteShared";

export default function ClienteReport({ data, onVerEstadoCuenta }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-lg font-bold text-blue-700 shrink-0">
            {data.cliente.nombre[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">{data.cliente.nombre}</p>
            <p className="text-xs text-gray-400 font-mono">{formatCedula(data.cliente.cedula)} · {data.cliente.telefono}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
          <button
            onClick={onVerEstadoCuenta}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            Ver Estado de Cuenta
          </button>
          <div className="grid grid-cols-2 gap-3 sm:ml-auto">
            <SumCard label="Préstamos" value={data.totalPrestamos} color="text-blue-600" />
            <SumCard label="Total pagado" value={formatCurrency(data.totalPagado)} color="text-emerald-600" bg="bg-emerald-50" />
          </div>
        </div>
      </div>
      {data.prestamos.map((pr, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800">Préstamo {i + 1}</span>
              <span className="text-sm text-gray-500">{formatCurrency(pr.monto)}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ESTADO_COLOR[pr.estado]}`}>{pr.estado}</span>
            </div>
            <p className="text-xs text-gray-400">{pr.cuotasPagadas} / {pr.totalCuotas} cuotas · Saldo: <strong>{formatCurrency(pr.saldo)}</strong></p>
          </div>
          <div className="hidden sm:block">
            <Tabla
              headers={[
                { key: "fecha", label: "Fecha", render: (r) => formatDate(r.fecha) },
                { key: "capital", label: "Capital", right: true, render: (r) => formatCurrency(r.capital) },
                { key: "interes", label: "Interés", right: true, render: (r) => formatCurrency(r.interes) },
                { key: "mora", label: "Mora", right: true, render: (r) => r.mora > 0 ? <span className="text-red-600">{formatCurrency(r.mora)}</span> : "—" },
                { key: "total", label: "Total", right: true, render: (r) => <span className="font-bold text-emerald-700">{formatCurrency(r.total)}</span> },
                { key: "metodo", label: "Método", render: (r) => METODO_LABEL[r.metodo] || r.metodo },
                { key: "cobrador", label: "Cobrador" },
              ]}
              rows={pr.pagos}
              emptyMsg="Sin pagos registrados"
            />
          </div>
          <div className="sm:hidden space-y-2">
            {pr.pagos.map((r, j) => (
              <div key={j} className="border border-gray-100 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">{formatDate(r.fecha)}</p>
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(r.total)}</p>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-blue-50 rounded p-1 text-center"><p className="text-blue-400">Capital</p><p className="font-bold text-blue-700">{formatCurrency(r.capital)}</p></div>
                  <div className="bg-amber-50 rounded p-1 text-center"><p className="text-amber-400">Interés</p><p className="font-bold text-amber-700">{formatCurrency(r.interes)}</p></div>
                  <div className="bg-red-50 rounded p-1 text-center"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{r.mora > 0 ? formatCurrency(r.mora) : "—"}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
