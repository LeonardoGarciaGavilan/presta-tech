// src/utils/texto.js
// Utilidades de normalización de texto (búsqueda sin acentos)

export const normalizarTexto = (s = "") =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const incluyeNormalizado = (texto, patron) =>
  normalizarTexto(texto).includes(normalizarTexto(patron));

export const igualNormalizado = (a, b) => normalizarTexto(a) === normalizarTexto(b);