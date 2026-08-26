// CarteraReport.jsx — Tab de cartera vencida
import { formatCurrency, formatCedula } from "../../utils/prestamosUtils";
import { SumCard, Tabla } from "./reporteShared";

export default function CarteraReport({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SumCard label="Préstamos atrasados" value={data.totalRegistros} color="text-red-600" bg="bg-red-50" />
        <SumCard label="Saldo total vencido" value={formatCurrency(data.totalSaldoVencido)} color="text-gray-800" />
        <SumCard label="Mora acumulada total" value={formatCurrency(data.totalMora)} color="text-amber-600" bg="bg-amber-50" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="hidden sm:block">
          <Tabla
            headers={[
              { key: "cliente", label: "Cliente" },
              { key: "cedula", label: "Cédula", render: (r) => <span className="font-mono text-xs">{formatCedula(r.cedula)}</span> },
              { key: "telefono", label: "Teléfono" },
              { key: "saldoPendiente", label: "Saldo", right: true, render: (r) => formatCurrency(r.saldoPendiente) },
              { key: "moraAcumulada", label: "Mora", right: true, render: (r) => <span className="text-red-600 font-semibold">{formatCurrency(r.moraAcumulada)}</span> },
              { key: "cuotasVencidas", label: "Cuotas venc.", right: true },
              { key: "diasMaxAtraso", label: "Días atraso", right: true, render: (r) => <span className={r.diasMaxAtraso > 30 ? "text-red-600 font-bold" : "text-amber-600"}>{r.diasMaxAtraso}</span> },
            ]}
            rows={data.prestamos}
            emptyMsg="No hay préstamos atrasados"
          />
        </div>
        <div className="sm:hidden space-y-2">
          {data.prestamos.map((r, i) => (
            <div key={i} className="border border-red-100 rounded-xl p-3 bg-red-50/30 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.cliente}</p>
                  <p className="text-xs text-gray-400 font-mono">{formatCedula(r.cedula)}</p>
                </div>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${r.diasMaxAtraso > 30 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{r.diasMaxAtraso}d</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div className="bg-white rounded p-1.5 text-center border border-gray-100"><p className="text-gray-400">Saldo</p><p className="font-bold">{formatCurrency(r.saldoPendiente)}</p></div>
                <div className="bg-red-50 rounded p-1.5 text-center border border-red-100"><p className="text-red-400">Mora</p><p className="font-bold text-red-600">{formatCurrency(r.moraAcumulada)}</p></div>
                <div className="bg-white rounded p-1.5 text-center border border-gray-100"><p className="text-gray-400">Cuotas</p><p className="font-bold">{r.cuotasVencidas}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
