// recibopago.jsx

import { useRef } from "react";
import { formatCurrency, formatCedula, FRECUENCIA_LABEL } from "../utils/prestamosUtils";
import { generarReciboPDF } from "./generarReciboPDF";

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

  const handleDescargarPDF = async () => {
    await generarReciboPDF(data, empresa, `recibo-${numeroRecibo}`);
  };

  const reciboStyle = {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    background: "#ffffff",
    color: "#000000",
    width: "100%",
    maxWidth: "219px",
    margin: "0 auto",
    padding: "12px 10px",
    fontSize: "14px",
  };
  const dividerDashed = { borderTop: "1px dashed #000000", margin: "6px 0" };
  const dividerSolid  = { borderTop: "1.5px solid #000000", margin: "6px 0" };
  const rowStyle      = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" };
  const labelStyle    = { color: "#000000", fontSize: "13px" };
  const valueStyle    = { fontWeight: "700", color: "#000000", fontSize: "14px", textAlign: "right" };

  const nombreEmpresa = typeof empresa?.nombre === "string"
    ? empresa.nombre
    : empresa?.nombre?.nombre ?? empresa?.nombreEmpresa ?? "Sistema de Préstamos";

  const renderReceiptContent = () => (
    <div style={reciboStyle}>

      {/* Encabezado */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <p style={{ fontSize: "16px", fontWeight: "800", color: "#000000", margin: "0 0 2px" }}>
          {nombreEmpresa}
        </p>
        <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", margin: 0 }}>
          Recibo de Pago
        </p>
      </div>

      <div style={dividerDashed} />

      {/* Nº recibo en línea propia, fecha abajo */}
      <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "2px" }}>Recibo Nº</p>
      <p style={{ fontSize: "15px", fontWeight: "800", color: "#000000", margin: "0 0 3px" }}>
        #{numeroRecibo}
      </p>
      <p style={{ fontSize: "14px", color: "#000000", marginBottom: "4px" }}>
        {formatDateLong(pago?.createdAt || pago?.fecha)}
      </p>

      <div style={dividerDashed} />

      {/* Cliente */}
      <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "4px" }}>Cliente</p>
      <p style={{ fontSize: "16px", fontWeight: "700", color: "#000000", marginBottom: "2px" }}>
        {cliente?.nombre} {cliente?.apellido}
      </p>
      <p style={{ fontSize: "14px", color: "#000000" }}>
        {formatCedula(cliente?.cedula || "")}
      </p>

      <div style={dividerDashed} />

      {/* Préstamo */}
      <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "6px" }}>Préstamo</p>
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
      {/* Tasa de interés: COMENTADA — no aparece en recibo ni en PDF
      <div style={rowStyle}>
        <span style={labelStyle}>Tasa de interés</span>
        <span style={valueStyle}>{prestamo?.tasaInteres}%</span>
      </div>
      */}

      <div style={dividerDashed} />

      {/* Cuota pagada */}
      {cuota && pagoCompleto && (
        <>
          <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "6px" }}>
            Cuota Pagada
          </p>
          <div style={rowStyle}>
            <span style={labelStyle}>Número de cuota</span>
            <span style={valueStyle}>#{cuota.numero} de {prestamo?.numeroCuotas}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Fecha vencimiento</span>
            <span style={valueStyle}>{formatDateShort(cuota.fechaVencimiento)}</span>
          </div>
          <div style={dividerDashed} />
        </>
      )}

      {/* Cuota en abono parcial */}
      {cuota && !pagoCompleto && (
        <>
          <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "6px" }}>
            Cuota en Abono
          </p>
          <div style={rowStyle}>
            <span style={labelStyle}>Número de cuota</span>
            <span style={valueStyle}>#{cuota.numero} de {prestamo?.numeroCuotas}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Fecha vencimiento</span>
            <span style={valueStyle}>{formatDateShort(cuota.fechaVencimiento)}</span>
          </div>
          <div style={{ border: "1px solid #000000", borderRadius: "3px", padding: "4px 6px", margin: "4px 0" }}>
            <p style={{ fontSize: "13px", color: "#000000", margin: 0 }}>
              {'>>'} Abono parcial — la cuota aún tiene saldo pendiente.
            </p>
          </div>
          <div style={dividerDashed} />
        </>
      )}

      {/* Detalle del pago */}
      <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "6px" }}>
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
          <span style={valueStyle}>{formatCurrency(interesPagado)}</span>
        </div>
      )}
      {moraPagada > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}>Mora</span>
          <span style={valueStyle}>{formatCurrency(moraPagada)}</span>
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
          <div style={rowStyle}>
            <span style={labelStyle}>Abono a capital</span>
            <span style={valueStyle}>+ {formatCurrency(abonoCapital)}</span>
          </div>
          <div style={{ border: "1px solid #000000", borderRadius: "3px", padding: "4px 6px", margin: "4px 0" }}>
            <p style={{ fontSize: "13px", color: "#000000", margin: 0 }}>
              {'>>'} Abono de {formatCurrency(abonoCapital)} al capital de próximas cuotas.
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

      {/* Total pagado */}
      <div style={{ textAlign: "center", margin: "8px 0 6px" }}>
        <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", margin: "0 0 3px" }}>
          Total Pagado
        </p>
        <p style={{ fontSize: "20px", fontWeight: "800", color: "#000000", margin: 0 }}>
          {formatCurrency(pago?.montoTotal ?? 0)}
        </p>
      </div>

      {/* Saldo restante: COMENTADO — no aparece en recibo ni en PDF
      <div style={rowStyle}>
        <span style={labelStyle}>Saldo restante</span>
        <span style={{ ...valueStyle, color: estaSaldado ? "#059669" : "#111111" }}>
          {formatCurrency(saldoRestante)}
        </span>
      </div>
      */}

      {pago?.observacion && (
        <>
          <div style={dividerDashed} />
          <p style={{ fontSize: "13px", color: "#000000", textTransform: "uppercase", marginBottom: "4px" }}>Observación</p>
          <p style={{ fontSize: "14px", color: "#000000" }}>{pago.observacion}</p>
        </>
      )}

      <div style={dividerDashed} />

      {/* Footer */}
      <div style={{ textAlign: "center" }}>
        {estaSaldado && (
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#000000", marginBottom: "4px" }}>
            ¡Préstamo completamente pagado!
          </p>
        )}
        <p style={{ fontSize: "14px", color: "#000000" }}>
          Registrado por: {usuario?.nombre ?? "—"}
        </p>
        <p style={{ fontSize: "14px", color: "#000000", marginTop: "2px" }}>
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

          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700">Recibo de Pago</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDescargarPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-95"
                title="Descarga el recibo como PDF de 58 mm"
              >
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

          {/* Vista previa */}
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