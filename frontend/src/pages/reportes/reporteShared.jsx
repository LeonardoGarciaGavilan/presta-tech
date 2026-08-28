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

const SUM_COLOR_MAP = {
  blue: "text-blue-600",
  emerald: "text-emerald-600",
  red: "text-red-600",
  amber: "text-amber-600",
  cyan: "text-cyan-600",
  indigo: "text-indigo-600",
  violet: "text-violet-600",
  gray: "text-gray-900",
  green: "text-green-600",
};

export const SumCard = ({
  label,
  value,
  color = "text-gray-900",
  bg = "bg-white",
  sub,
  isCount,
}) => {
  const textColor = SUM_COLOR_MAP[color] ?? color;
  return (
    <div
      className={`${bg} rounded-xl border border-gray-100 shadow-sm px-4 py-3`}
    >
      <p className={`text-xl font-bold ${textColor}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sub && (
        <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>
      )}
    </div>
  );
};

export const Tabla = ({
  headers,
  rows,
  emptyMsg = "Sin datos",
  emptyMessage,
  footer,
}) => {
  const isObjectHeaders = headers.length > 0 && typeof headers[0] === "object";
  const isObjectRows = rows.length > 0 && typeof rows[0] === "object";
  const empty = emptyMessage !== undefined ? emptyMessage : emptyMsg;
  const colspan = headers.length;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
            {headers.map((h, i) =>
              isObjectHeaders ? (
                <th
                  key={h.key ?? i}
                  className={`px-4 py-3 font-semibold ${h.right ? "text-right" : "text-left"}`}
                >
                  {h.label}
                </th>
              ) : (
                <th
                  key={i}
                  className="px-4 py-3 font-semibold text-left"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colspan}
                className="text-center py-10 text-gray-400"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50/60 transition-colors"
              >
                {headers.map((h, j) => {
                  if (isObjectHeaders) {
                    return (
                      <td
                        key={h.key ?? j}
                        className={`px-4 py-3 ${h.right ? "text-right" : ""}`}
                      >
                        {h.render ? h.render(row) : row[h.key] ?? "—"}
                      </td>
                    );
                  }
                  return (
                    <td key={j} className="px-4 py-3">
                      {Array.isArray(row) ? row[j] : row[h]}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
        {footer && footer.length > 0 && (
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              {footer.map((f, i) => {
                if (typeof f === "object" && f !== null && "value" in f) {
                  return (
                    <td
                      key={i}
                      className={`px-4 py-3 text-xs font-bold ${f.right ? "text-right" : ""} ${f.color ?? "text-gray-600"}`}
                    >
                      {f.value}
                    </td>
                  );
                }
                return (
                  <td key={i} className="px-4 py-3 text-xs font-bold text-gray-600">
                    {f}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};
