// recibopago.jsx  ── versión con generación de PDF de 58 mm para impresoras térmicas
//
// Cambios respecto al original:
//   1. Se importa `generarReciboPDF` de ./generarReciboPDF
//   2. El botón "Imprimir" ahora llama a generarReciboPDF() → descarga el PDF
//   3. Se eliminó el portal de impresión (createPortal + receipt-print-target)
//      porque ya no se usa window.print()
//   4. Los estilos @media print en index.css siguen siendo opcionales;
//      si quieres eliminarlos, son los bloques de .receipt-print-target.

import { useRef } from "react";
import { formatCurrency, formatCedula, FRECUENCIA_LABEL } from "../utils/prestamosUtils";
import { generarReciboPDF } from "./generarReciboPDF"; // ← nuevo import

const formatDateLong = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
};

const formatDateShort = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(date));
};

const METODO_LABEL = {
  EFECTIVO:      "Efectivo",
  TRANSFERENCIA: "Transferencia Bancaria",
  TARJETA:       "Tarjeta",
  CHEQUE:        "Cheque",
};

export default function ReciboPago({ data, empresa, onClose }) {
  const reciboRef = useRef(null);

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-gray-500">Cargando recibo...</p>
        </div>
      </div>
    );
  }

  const pago     = data?.pago;
  const prestamo = data?.prestamo;
  const cliente  = data?.cliente;
  const cuota    = data?.cuota;
  const usuario  = data?.usuario;

  const numeroRecibo  = pago?.id?.slice(-8)?.toUpperCase() ?? "—";
  const saldoRestante = prestamo?.saldoPendiente ?? 0;
  const estaSaldado   = saldoRestante <= 0.01;

  const pagoCompleto   = pago?.pagoCompleto ?? cuota?.pagoCompleto ?? true;
  const capitalPagado  = pago?.capital      ?? 0;
  const interesPagado  = pago?.interes      ?? 0;
  const moraPagada     = pago?.mora         ?? 0;
  const abonoCapital   = pago?.abonoCapital ?? 0;
  const tieneAbono     = abonoCapital > 0 && pagoCompleto;
  const capitalDeCuota = tieneAbono
    ? Math.max(0, Math.round((capitalPagado - abonoCapital) * 100) / 100)
    : capitalPagado;

  // ── Reemplaza window.print() ───────────────────────────────────────────────
const handleDescargarPDF = async () => {
  await generarReciboPDF(data, empresa, `recibo-${numeroRecibo}`);
};

  // ── Estilos inline (sin cambios) ───────────────────────────────────────────
  const reciboStyle = {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    background: "#ffffff",
    color: "#1e293b",
    width: "100%",
    maxWidth: "320px",
    margin: "0 auto",
    padding: "16px 14px",
    fontSize: "12px",
  };
  const dividerDashed = { borderTop: "1px dashed #cbd5e1", margin: "10px 0" };
  const dividerSolid  = { borderTop: "1px solid #e2e8f0",  margin: "10px 0" };
  const rowStyle      = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" };
  const labelStyle    = { color: "#64748b", fontSize: "11px" };
  const valueStyle    = { fontWeight: "600", color: "#0f172a", fontSize: "11px", textAlign: "right" };

  const nombreEmpresa = typeof empresa?.nombre === "string"
    ? empresa.nombre
    : empresa?.nombre?.nombre ?? empresa?.nombreEmpresa ?? "Sistema de Préstamos";

  const renderReceiptContent = () => (
    <div style={reciboStyle}>

      {/* ── Encabezado empresa ── */}
      <div style={{ textAlign: "center", marginBottom: "12px" }}>
        <div style={{
          width: "40px", height: "40px",
          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
          borderRadius: "10px", display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: "800", fontSize: "16px",
          marginBottom: "6px",
        }}>
          {(nombreEmpresa ?? "SP").slice(0, 2).toUpperCase()}
        </div>
        <p style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", margin: "0 0 1px" }}>
          {nombreEmpresa}
        </p>
        <p style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Recibo de Pago
        </p>
      </div>

      <div style={dividerDashed} />

      {/* ── Nº recibo y fecha ── */}
      <div style={rowStyle}>
        <div>
          <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recibo Nº</p>
          <p style={{ fontSize: "15px", fontWeight: "800", color: "#2563eb" }}>#{numeroRecibo}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "10px", color: "#94a3b8" }}>{formatDateLong(pago?.createdAt || pago?.fecha)}</p>
        </div>
      </div>

      <div style={dividerDashed} />

      {/* ── Cliente ── */}
      <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "5px" }}>Cliente</p>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginBottom: "2px" }}>
        {cliente?.nombre} {cliente?.apellido}
      </p>
      <p style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
        {formatCedula(cliente?.cedula || "")}
      </p>

      <div style={dividerDashed} />

      {/* ── Datos del préstamo ── */}
      <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Préstamo</p>
      <div style={rowStyle}>
        <span style={labelStyle}>Monto original</span>
        <span style={valueStyle}>{formatCurrency(prestamo?.monto)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Frecuencia</span>
        <span style={valueStyle}>{FRECUENCIA_LABEL[prestamo?.frecuenciaPago] || "—"}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Total cuotas</span>
        <span style={valueStyle}>{prestamo?.numeroCuotas} cuotas</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Tasa de interés</span>
        <span style={valueStyle}>{prestamo?.tasaInteres}%</span>
      </div>

      <div style={dividerDashed} />

      {cuota && pagoCompleto && (
        <>
          <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
            Cuota Pagada
          </p>
          <div style={rowStyle}>
            <span style={labelStyle}>Número de cuota</span>
            <span style={{ ...valueStyle, color: "#2563eb" }}>#{cuota.numero} de {prestamo?.numeroCuotas}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Fecha vencimiento</span>
            <span style={valueStyle}>{formatDateShort(cuota.fechaVencimiento)}</span>
          </div>
          <div style={dividerDashed} />
        </>
      )}

      {cuota && !pagoCompleto && (
        <>
          <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
            Cuota en Abono
          </p>
          <div style={rowStyle}>
            <span style={labelStyle}>Número de cuota</span>
            <span style={{ ...valueStyle, color: "#d97706" }}>#{cuota.numero} de {prestamo?.numeroCuotas}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Fecha vencimiento</span>
            <span style={valueStyle}>{formatDateShort(cuota.fechaVencimiento)}</span>
          </div>
          <div style={{
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: "6px", padding: "6px 8px", margin: "6px 0",
          }}>
            <p style={{ fontSize: "10px", color: "#92400e", margin: 0 }}>
              ⚠️ Abono parcial — la cuota aún tiene saldo pendiente.
            </p>
          </div>
          <div style={dividerDashed} />
        </>
      )}

      {/* ── Detalle del Pago ── */}
      <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
        Detalle del Pago
      </p>

      {capitalDeCuota > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Capital</span>
          <span style={valueStyle}>{formatCurrency(capitalDeCuota)}</span>
        </div>
      )}

      {interesPagado > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Interés</span>
          <span style={{ ...valueStyle, color: "#b45309" }}>{formatCurrency(interesPagado)}</span>
        </div>
      )}

      {moraPagada > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Mora</span>
          <span style={{ ...valueStyle, color: "#dc2626" }}>{formatCurrency(moraPagada)}</span>
        </div>
      )}

      {capitalDeCuota === 0 && interesPagado === 0 && moraPagada === 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Aplicado</span>
          <span style={valueStyle}>{formatCurrency(pago?.montoTotal ?? 0)}</span>
        </div>
      )}

      {tieneAbono && (
        <>
          <div style={{ ...rowStyle, marginTop: "4px" }}>
            <span style={{ ...labelStyle, color: "#0369a1" }}>Abono a capital</span>
            <span style={{ ...valueStyle, color: "#0369a1" }}>+ {formatCurrency(abonoCapital)}</span>
          </div>
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: "6px", padding: "6px 8px", margin: "6px 0",
          }}>
            <p style={{ fontSize: "10px", color: "#1d4ed8", margin: 0 }}>
              💡 Se aplicó un abono de {formatCurrency(abonoCapital)} al capital de las próximas cuotas.
            </p>
          </div>
        </>
      )}

      <div style={rowStyle}>
        <span style={labelStyle}>Método</span>
        <span style={valueStyle}>{METODO_LABEL[pago?.metodo] || pago?.metodo || "—"}</span>
      </div>

      {pago?.referencia && (
        <div style={rowStyle}>
          <span style={labelStyle}>Referencia</span>
          <span style={valueStyle}>{pago.referencia}</span>
        </div>
      )}

      <div style={dividerSolid} />

      {/* ── Total pagado ── */}
      <div style={{
        background: "linear-gradient(135deg, #059669, #047857)",
        borderRadius: "8px", padding: "12px",
        textAlign: "center", margin: "10px 0",
      }}>
        <p style={{ fontSize: "10px", color: "#a7f3d0", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>
          Total Pagado
        </p>
        <p style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", margin: 0 }}>
          {formatCurrency(pago?.montoTotal ?? 0)}
        </p>
      </div>

      {/* ── Saldo restante ── */}
      <div style={rowStyle}>
        <span style={labelStyle}>Saldo restante</span>
        <span style={{ ...valueStyle, color: estaSaldado ? "#059669" : "#0f172a" }}>
          {formatCurrency(saldoRestante)}
        </span>
      </div>

      {pago?.observacion && (
        <>
          <div style={dividerDashed} />
          <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Observación</p>
          <p style={{ fontSize: "11px", color: "#64748b" }}>{pago.observacion}</p>
        </>
      )}

      <div style={dividerDashed} />

      {/* ── Footer ── */}
      <div style={{ textAlign: "center" }}>
        {estaSaldado && (
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#059669", marginBottom: "4px" }}>
            🎉 ¡Préstamo completamente pagado!
          </p>
        )}
        <p style={{ fontSize: "10px", color: "#94a3b8" }}>
          Registrado por: {usuario?.nombre ?? "—"}
        </p>
        <p style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "3px" }}>
          {nombreEmpresa} · {formatDateShort(new Date())}
        </p>
      </div>

    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-start justify-center p-4"
        style={{ paddingTop: "40px" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto"
          style={{ animation: "fadeUp 0.2s ease" }}
        >
          {/* Header de confirmación */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">✓</div>
              <div>
                <h2 className="font-bold text-base">Pago registrado correctamente</h2>
                <p className="text-xs text-emerald-100">Recibo #{numeroRecibo}</p>
              </div>
            </div>
          </div>

          {/* Toolbar — botón cambiado a "Descargar PDF" */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Recibo de Pago</h2>
            <div className="flex items-center gap-2">

              {/* ── NUEVO: Descargar PDF de 58 mm ── */}
              <button
                onClick={handleDescargarPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-95"
                title="Descarga el recibo como PDF de 58 mm listo para imprimir"
              >
                {/* Icono de descarga */}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                </svg>
                Descargar PDF
              </button>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg p-1.5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Vista previa del recibo (sin cambios) */}
          <div className="p-4 bg-gray-50">
            <div ref={reciboRef}>
              {renderReceiptContent()}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}