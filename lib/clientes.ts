/** "+525574421226" -> "+52 55 7442 1226". Lo que no tenga el formato de México se muestra como viene. */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return "";
  const digitos = telefono.replace(/\D/g, "");
  if (telefono.trim().startsWith("+52") && digitos.length === 12) return `+52 ${digitos.slice(2, 4)} ${digitos.slice(4, 8)} ${digitos.slice(8)}`;
  if (digitos.length === 10 && !telefono.trim().startsWith("+")) return `${digitos.slice(0, 2)} ${digitos.slice(2, 6)} ${digitos.slice(6)}`;
  return telefono;
}

/** Iniciales para el avatar: "ADRIANA JUDITH LEON" -> "AJ". */
export function inicialesCliente(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  return ((palabras[0]?.[0] ?? "?") + (palabras[1]?.[0] ?? "")).toUpperCase();
}

export const ESTATUS_COMPRA: Record<string, { etiqueta: string; clase: string }> = {
  pagada: { etiqueta: "Pagada", clase: "bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300" },
  completada: { etiqueta: "Pagada", clase: "bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300" },
  deuda_pendiente: { etiqueta: "Con deuda", clase: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300" },
  impaga: { etiqueta: "Impaga", clase: "bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300" },
  reembolsada: { etiqueta: "Reembolsada", clase: "bg-violet-100 text-violet-700 border-transparent dark:bg-violet-950 dark:text-violet-300" },
  cancelada: { etiqueta: "Cancelada", clase: "bg-muted text-muted-foreground border-transparent" },
};
