// Normalización de texto para búsquedas: quita acentos, pasa a minúsculas y
// recorta. "San Jose" == "san jose"; "Ñuñoa" == "nunoa".
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function incluyeNormalizado(busqueda: string, texto: string): boolean {
  const q = normalizarTexto(busqueda);
  if (!q) return true;
  return normalizarTexto(texto).includes(q);
}

export function igualNormalizado(a: string, b: string): boolean {
  return normalizarTexto(a) === normalizarTexto(b);
}