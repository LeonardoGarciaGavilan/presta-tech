// src/hooks/useNotificaciones.js

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

const CACHE_KEY    = "notificaciones_cache";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

function leerCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function escribirCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* storage lleno — ignorar */ }
}

export function useNotificaciones() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef           = useRef(null);

  const fetchAlertas = useCallback(async (forzar = false) => {
    // Si no forzamos, intentar cache primero
    if (!forzar) {
      const cached = leerCache();
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await api.get("/notificaciones/alertas");
      setData(res.data);
      escribirCache(res.data);
    } catch {
      // Si falla, dejar los datos anteriores sin borrarlos
    } finally {
      setLoading(false);
    }
  }, []);

  // Al montar: cargar inmediatamente
  useEffect(() => {
    fetchAlertas();

    // Polling cada 15 minutos
    intervalRef.current = setInterval(() => {
      fetchAlertas(true); // forzar refresh ignorando cache
    }, CACHE_TTL_MS);

    return () => clearInterval(intervalRef.current);
  }, [fetchAlertas]);

  // Refresh manual (botón en la campana)
  const refrescar = useCallback(() => {
    sessionStorage.removeItem(CACHE_KEY);
    setLoading(true);
    fetchAlertas(true);
  }, [fetchAlertas]);

  return {
    alertas:  data?.alertas  ?? [],
    resumen:  data?.resumen  ?? { vencenHoy: 0, proximasAVencer: 0, vencidas: 0, atrasados: 0 },
    total:    data?.total    ?? 0,
    urgentes: data?.urgentes ?? 0,
    loading,
    refrescar,
  };
}