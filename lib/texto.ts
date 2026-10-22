/** Minúsculas y sin acentos, para que "filipina" encuentre "Filipína" al buscar. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
