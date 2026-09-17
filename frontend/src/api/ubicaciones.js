// src/api/ubicaciones.js
// Cliente del catálogo de ubicaciones (Fase 3)

import api from "../services/api";

export async function getUbicacionesVersion() {
  const { data } = await api.get("/ubicaciones/version");
  return data?.version ?? "0";
}

export async function getUbicacionesCatalogo() {
  const { data } = await api.get("/ubicaciones/catalogo");
  return data;
}