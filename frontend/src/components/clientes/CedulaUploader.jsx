import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import compressImage from '../../utils/compressImage';

export default function CedulaUploader({ clienteId, tipo }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileRef = useRef(null);

  const label = tipo === 'cedula-frontal' ? 'Frontal' : 'Trasera';
  const labelLower = label.toLowerCase();

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

  const handleSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);
    setError(null);

    try {
      const blob = await compressImage(file);
      const form = new FormData();
      form.append('tipo', tipo);
      form.append('file', blob, 'cedula.jpg');
      await api.post(`/clientes/${clienteId}/cedula`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchSignedUrl();
    } catch {
      setError('Error al subir imagen');
    } finally {
      setUploading(false);
      if (localUrl) URL.revokeObjectURL(localUrl);
      setPreviewUrl(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || signedUrl;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        Cédula {label}
      </h3>

      {loading && !displayUrl && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && !displayUrl && !uploading && (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-8 px-4 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-sm font-medium">Subir cédula {labelLower}</span>
          <span className="text-xs">JPG, PNG o WebP</span>
        </button>
      )}

      {displayUrl && (
        <div className="space-y-2">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <img src={displayUrl} alt={`Cédula ${label}`}
              className="w-full rounded-lg border border-gray-200 object-cover max-h-48 cursor-pointer hover:opacity-90 transition-opacity" />
          </a>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Cambiar
            </button>
            <a href={signedUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Abrir
            </a>
          </div>
        </div>
      )}

      {uploading && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-blue-600 font-medium">
          <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          Subiendo…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}
            className="ml-auto text-xs font-semibold underline hover:no-underline shrink-0">
            Reintentar
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleSelect} hidden />
    </div>
  );
}
