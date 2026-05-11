import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/prestamosUtils';

function normalizarCelular(num) {
  if (!num) return null;
  const d = String(num).replace(/[^\d+]/g, '');
  const digits = d.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return d;
}

function formatearNumero(num) {
  if (!num) return '';
  const d = String(num).replace(/[^\d+]/g, '');
  const digits = d.replace(/\D/g, '');
  if (digits.length === 10 && ["809","829","849"].includes(digits.slice(0, 3))) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return d;
}

function obtenerPrestamoPrioritario(prestamos) {
  if (!prestamos?.length) return null;
  const activos = prestamos.filter(p => p.estado === 'ACTIVO' || p.estado === 'ATRASADO');
  if (!activos.length) return null;
  const atrasados = activos.filter(p => p.estado === 'ATRASADO');
  if (atrasados.length) {
    return atrasados.sort((a, b) => (b.saldoPendiente || 0) - (a.saldoPendiente || 0))[0];
  }
  return activos.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))[0];
}

export default function ClienteQuickActions({ cliente, prestamos }) {
  const navigate = useNavigate();
  const celular = normalizarCelular(cliente?.celular);
  const prestamo = obtenerPrestamoPrioritario(prestamos || []);
  const hayPrestamo = !!prestamo;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">⚡ Acciones rápidas</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <button onClick={() => hayPrestamo && navigate(`/pagos?prestamoId=${prestamo.id}`)}
          disabled={!hayPrestamo}
          className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all ${
            hayPrestamo
              ? 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 active:scale-[0.98] cursor-pointer'
              : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-50'
          }`}>
          <span className="text-lg leading-none">💰</span>
          <span className="text-sm font-semibold text-gray-800">Registrar pago</span>
          {hayPrestamo ? (
            <span className="text-[10px] text-gray-400 font-medium leading-tight">
              {prestamo.estado === 'ATRASADO' ? '🔴 Atrasado' : '🟢 Activo'} · {formatCurrency(prestamo.cuotaMensual)}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 leading-tight">Sin préstamo activo</span>
          )}
        </button>

        {celular && (
          <a href={`https://wa.me/${(() => { const d = celular.replace(/\D/g, ''); return !celular.startsWith('+') && d.length === 10 ? '1' + d : d; })()}`} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 active:scale-[0.98] transition-all cursor-pointer">
            <span className="text-lg leading-none">💬</span>
            <span className="text-sm font-semibold text-gray-800">WhatsApp</span>
            <span className="text-[10px] text-gray-400 font-mono leading-tight">{formatearNumero(cliente.celular)}</span>
          </a>
        )}

        {celular && (
          <a href={`tel:${celular}`}
            className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-gray-200 bg-white hover:bg-sky-50 hover:border-sky-200 active:scale-[0.98] transition-all cursor-pointer">
            <span className="text-lg leading-none">📞</span>
            <span className="text-sm font-semibold text-gray-800">Llamar</span>
            <span className="text-[10px] text-gray-400 font-mono leading-tight">{formatearNumero(cliente.celular)}</span>
          </a>
        )}

        <button onClick={() => hayPrestamo && navigate(`/prestamos/${prestamo.id}`)}
          disabled={!hayPrestamo}
          className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all ${
            hayPrestamo
              ? 'bg-white border-gray-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] cursor-pointer'
              : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-50'
          }`}>
          <span className="text-lg leading-none">👁</span>
          <span className="text-sm font-semibold text-gray-800">Ver préstamo</span>
          {hayPrestamo ? (
            <span className="text-[10px] text-gray-400 font-mono leading-tight">{prestamo.id.slice(0, 8)}… · {formatCurrency(prestamo.monto)}</span>
          ) : (
            <span className="text-[10px] text-gray-400 leading-tight">Sin préstamo activo</span>
          )}
        </button>

      </div>
    </div>
  );
}
