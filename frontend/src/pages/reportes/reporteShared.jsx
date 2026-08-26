// reporteShared.jsx — Componentes UI compartidos para reportes
import { useEffect } from "react";

export const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium
      ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
    >
      {type === "success" ? "✅" : "❌"} {message}
      <button
        onClick={onClose}
        className="ml-1 opacity-50 hover:opacity-100 text-lg"
      >
        ×
      </button>
    </div>
  );
};

export const Skeleton = ({ className }) => (
  <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} />
);

export const SumCard = ({
  label,
  value,
  color = "text-gray-900",
  bg = "bg-white",
  sub,
}) => (
  <div
    className={`${bg} rounded-xl border border-gray-100 shadow-sm px-4 py-3`}
  >
    <p className={`text-xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    {sub && (
      <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>
    )}
  </div>
);

export const Tabla = ({ headers, rows, emptyMsg = "Sin datos", footer }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-100">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
          {headers.map((h) => (
            <th
              key={h.key}
              className={`px-4 py-3 font-semibold ${h.right ? "text-right" : "text-left"}`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={headers.length}
              className="text-center py-10 text-gray-400"
            >
              {emptyMsg}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr
              key={i}
              className="hover:bg-gray-50/60 transition-colors"
            >
              {headers.map((h) => (
                <td
                  key={h.key}
                  className={`px-4 py-3 ${h.right ? "text-right" : ""}`}
                >
                  {h.render ? h.render(row) : row[h.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {footer && (
        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
          <tr>
            {footer.map((f, i) => (
              <td
                key={i}
                className={`px-4 py-3 text-xs font-bold ${f.right ? "text-right" : ""} ${f.color ?? "text-gray-600"}`}
              >
                {f.value}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
