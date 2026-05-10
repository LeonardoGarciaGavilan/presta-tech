import { useRef, useEffect, useState, useCallback } from 'react';
import useLeaflet from '../hooks/useLeaflet';

export default function MiniMapa({
  lat,
  lng,
  readOnly = true,
  height,
  zoom = 15,
  defaultCenter = [18.74, -70.16],
  onCoordsChange,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onCoordsChangeRef = useRef(onCoordsChange);
  const { L, ready, error } = useLeaflet();
  const [mapInit, setMapInit] = useState(false);

  useEffect(() => { onCoordsChangeRef.current = onCoordsChange; }, [onCoordsChange]);

  useEffect(() => {
    if (!ready || !L || !containerRef.current) return;
    if (mapRef.current) return;

    const hasCoords = lat != null && lng != null;
    const center = hasCoords ? [lat, lng] : defaultCenter;
    const initialZoom = hasCoords ? zoom : 8;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (hasCoords) {
      const mk = L.marker([lat, lng], { draggable: !readOnly }).addTo(map);
      if (!readOnly) {
        mk.on('dragend', e => {
          const p = e.target.getLatLng();
          onCoordsChangeRef.current?.(p.lat, p.lng);
        });
      }
      markerRef.current = mk;
    }

    if (!readOnly) {
      map.on('click', e => {
        const clat = e.latlng.lat;
        const clng = e.latlng.lng;
        if (markerRef.current) {
          markerRef.current.setLatLng([clat, clng]);
        } else {
          const mk = L.marker([clat, clng], { draggable: true }).addTo(map);
          mk.on('dragend', ev => {
            const p = ev.target.getLatLng();
            onCoordsChangeRef.current?.(p.lat, p.lng);
          });
          markerRef.current = mk;
        }
        onCoordsChangeRef.current?.(clat, clng);
      });
    }

    mapRef.current = map;
    setMapInit(true);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setMapInit(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, L]);

  useEffect(() => {
    if (!mapInit || !L) return;
    const map = mapRef.current;
    if (!map) return;

    if (lat != null && lng != null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const mk = L.marker([lat, lng], { draggable: !readOnly }).addTo(map);
        if (!readOnly) {
          mk.on('dragend', e => {
            const p = e.target.getLatLng();
            onCoordsChangeRef.current?.(p.lat, p.lng);
          });
        }
        markerRef.current = mk;
      }
      map.setView([lat, lng], Math.max(map.getZoom(), zoom));
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [lat, lng, mapInit, L, readOnly, zoom]);

  const handleClear = useCallback(() => {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onCoordsChangeRef.current?.(null, null);
  }, []);

  const hasCoords = lat != null && lng != null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={containerRef}
          style={{ width: '100%', ...(height ? { height } : {}) }}
          className={height ? '' : 'h-[180px] sm:h-[240px]'} />

        {!L && !error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Cargando mapa…</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center">
            <span className="text-sm text-red-400">Error al cargar el mapa</span>
          </div>
        )}

        {ready && !readOnly && !hasCoords && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
            <span className="bg-black/65 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
              👆 Haz clic en el mapa para marcar la ubicación
            </span>
          </div>
        )}

        {ready && readOnly && !hasCoords && (
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
            <span className="text-sm text-gray-400">📍 Sin coordenadas</span>
          </div>
        )}
      </div>

      {!readOnly && hasCoords && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-emerald-500 shrink-0">📍</span>
            <div className="min-w-0">
              <p className="text-xs text-emerald-700 font-semibold">Ubicación guardada</p>
              <p className="text-[10px] text-emerald-500 font-mono truncate">
                {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
              </p>
            </div>
          </div>
          <button type="button" onClick={handleClear}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-red-500 hover:text-red-700 text-xs font-semibold border border-red-200 transition-all">
            ✕ Limpiar pin
          </button>
        </div>
      )}

      {!readOnly && ready && !hasCoords && (
        <p className="text-[10px] text-gray-400 text-center">También puedes arrastrar el pin para ajustar la posición exacta</p>
      )}
    </div>
  );
}
