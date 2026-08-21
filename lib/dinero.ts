/** Formatea un monto como moneda mexicana: "$1,234.56" (con separador de miles). */
export function formatearMoneda(valor: number): string {
  return valor.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}
