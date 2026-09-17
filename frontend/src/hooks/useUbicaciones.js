// src/hooks/useUbicaciones.js
// Catálogo de ubicaciones servido por el backend, cacheado en localStorage y
// validado por `version`. Si no hay red ni caché, cae a las listas estáticas
// de `src/utils` (usandoFallback = true).

import { useCallback, useEffect, useMemo, useState } from "react";
import { getUbicacionesVersion, getUbicacionesCatalogo } from "../api/ubicaciones";
import { PROVINCIAS, PROVINCIAS_MUNICIPIOS } from "../utils/provincias-municipios";
import { getSectores as getSectoresLegacy } from "../utils/sectores-municipios";
import { igualNormalizado } from "../utils/texto";

const STORAGE_KEY = "ubicaciones_catalogo_v1";

const ORDEN_SECTOR = { BARRIO: 0, SUB_BARRIO: 1, SECCION: 2 };

function leerCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { version, catalogo } = JSON.parse(raw);
    if (!version || !catalogo || !Array.isArray(catalogo.provincias)) return null;
    return { version, catalogo };
  } catch {
    return null;
  }
}

function escribirCache(version, catalogo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version, catalogo }));
  } catch { /* almacenamiento lleno — no bloquea */ }
}

// Promesa compartida: evita descargar el catálogo dos veces ante montajes
// simultáneos (StrictMode, hot-reload) sin bloquear otros montajes futuros.
let catalogoEnVuelo = null;

function cargarCatalogo() {
  if (!catalogoEnVuelo) {
    catalogoEnVuelo = (async () => {
      const serverVersion = await getUbicacionesVersion();
      const cache = leerCache();
      if (cache && cache.version === serverVersion) return cache;

      const catalogo = await getUbicacionesCatalogo();
      const version = catalogo?.version ?? serverVersion;
      escribirCache(version, catalogo);
      return { version, catalogo };
    })().finally(() => { catalogoEnVuelo = null; });
  }
  return catalogoEnVuelo;
}

export default function useUbicaciones() {
  const [estado, setEstado] = useState(() => {
    const cache = leerCache();
    return {
      catalogo: cache?.catalogo ?? null,
      version: cache?.version ?? null,
      cargando: !cache,
      usandoFallback: !cache,
    };
  });

  useEffect(() => {
    let activo = true;
    cargarCatalogo()
      .then(({ version, catalogo }) => {
        if (activo) setEstado({ catalogo, version, cargando: false, usandoFallback: false });
      })
      .catch(() => {
        // Offline o sin sesión: conservar la caché local si hay, sino modo estático
        if (activo) setEstado((s) => ({ ...s, cargando: false, usandoFallback: !s.catalogo }));
      });
    return () => { activo = false; };
  }, []);

  const catalogo = estado.catalogo;

  // Provincias: del catálogo (A-Z) o de las listas estáticas como fallback.
  // Cada ítem es { id, nombre } (id undefined en modo estático).
  const provincias = useMemo(() => {
    if (!catalogo) return PROVINCIAS.map((nombre) => ({ id: undefined, nombre }));
    return [...catalogo.provincias]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map(({ id, nombre }) => ({ id, nombre }));
  }, [catalogo]);

  // Unidades = municipios + distritos municipales de una provincia
  // (municipios primero, luego distritos, A-Z dentro de cada grupo).
  const obtenerUnidades = useCallback((provinciaId, provinciaNombre) => {
    if (!catalogo) {
      return (PROVINCIAS_MUNICIPIOS[provinciaNombre ?? ""] ?? []).map((nombre) => ({
        id: undefined, nombre, tipo: "MUNICIPIO",
      }));
    }

    let pid = provinciaId;
    if (!pid) {
      const prov = catalogo.provincias.find((p) => igualNormalizado(p.nombre, provinciaNombre ?? ""));
      pid = prov?.id;
    }

    return [...(catalogo.municipios ?? []), ...(catalogo.distritos ?? [])]
      .filter((u) => u.provinciaId === pid)
      .sort((a, b) =>
        (a.tipo === "DISTRITO_MUNICIPAL" ? 1 : 0) - (b.tipo === "DISTRITO_MUNICIPAL" ? 1 : 0) ||
        a.nombre.localeCompare(b.nombre, "es"))
      .map(({ id, nombre, tipo }) => ({ id, nombre, tipo }));
  }, [catalogo]);

  // Sectores de un municipio/distrito: barrios → sub-barrios → secciones.
  const obtenerSectores = useCallback((municipioId, municipioNombre) => {
    if (!catalogo) {
      return (getSectoresLegacy(municipioNombre ?? "") ?? []).map((nombre) => ({
        id: undefined, nombre, tipo: "BARRIO",
      }));
    }

    let uid = municipioId;
    if (!uid) {
      const unidad = [...(catalogo.municipios ?? []), ...(catalogo.distritos ?? [])]
        .find((u) => u.tipo === "MUNICIPIO" && igualNormalizado(u.nombre, municipioNombre ?? ""))
        ?? [...(catalogo.municipios ?? []), ...(catalogo.distritos ?? [])]
          .find((u) => u.tipo === "DISTRITO_MUNICIPAL" && igualNormalizado(u.nombre, municipioNombre ?? ""));
      uid = unidad?.id;
    }

    return [...(catalogo.secciones ?? []), ...(catalogo.barrios ?? []), ...(catalogo.subBarrios ?? [])]
      .filter((s) => s.unidadPadreId === uid)
      .sort((a, b) => (ORDEN_SECTOR[a.tipo] - ORDEN_SECTOR[b.tipo]) || a.nombre.localeCompare(b.nombre, "es"))
      .map(({ id, nombre, tipo }) => ({ id, nombre, tipo }));
  }, [catalogo]);

  // Etiqueta visual de una unidad (los distritos se marcan como "… (Distrito)").
  const municipioLabel = useCallback(
    (u) => (u?.tipo === "DISTRITO_MUNICIPAL" ? `${u.nombre} (Distrito)` : u?.nombre ?? ""),
    [],
  );

  // Resuelve una unidad por nombre sin acentos, prefiriendo municipio sobre distrito.
  const resolverPorNombre = useCallback(
    (lista, nombre) =>
      lista.find((x) => x.tipo === "MUNICIPIO" && igualNormalizado(x.nombre, nombre))
      ?? lista.find((x) => x.tipo === "DISTRITO_MUNICIPAL" && igualNormalizado(x.nombre, nombre))
      ?? null,
    [],
  );

  return {
    catalogo,
    version: estado.version,
    cargando: estado.cargando,
    usandoFallback: estado.usandoFallback,
    provincias,
    obtenerUnidades,
    obtenerSectores,
    municipioLabel,
    resolverPorNombre,
  };
}