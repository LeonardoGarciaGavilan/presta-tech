import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

export default function CedulaViewer({ clienteId, tipo }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const label = tipo === 'cedula-frontal' ? 'Frontal' : 'Trasera';

  const fetchSignedUrl = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/clientes/${clienteId}/cedula/signed-url`, {
        params: { tipo },
      });
      setSignedUrl(res.data.signedUrl);
    } catch (err) {
      if (err.response?.status === 404) {
        setSignedUrl(null);
      } else {
        setError('Error al cargar imagen');
      }
    } finally {
      setLoading(false);
    }
  }, [clienteId, tipo]);

  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Cédula {label}
      </h3>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && !signedUrl && (
        <div className="flex items-center justify-center py-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            ❌ No cargada
          </span>
        </div>
      )}

      {!loading && signedUrl && (
        <div className="space-y-2">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <img src={signedUrl} alt={`Cédula ${label}`}
              className="w-full rounded-lg border border-gray-200 object-cover max-h-48 cursor-pointer hover:opacity-90 transition-opacity" />
          </a>
          <a href={signedUrl} target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Abrir
          </a>
        </div>
      )}
    </div>
  );
}
