import type { Database } from "@/types/database.types";

// Pick en vez del Row completo: totalesPorPedido solo lee estos tres campos,
// así una pantalla puede pedirle a Supabase nada más esas columnas (menos
// bytes) sin dejar de poder llamar esta función — un Row completo sigue
// cumpliendo este tipo sin problema.
type ItemPedido = Pick<Database["public"]["Tables"]["items_pedido"]["Row"], "pedido_id" | "cantidad" | "precio_unitario">;

export function totalesPorPedido(items: ItemPedido[]): Record<string, number> {
  const totales: Record<string, number> = {};
  for (const item of items) {
    totales[item.pedido_id] = (totales[item.pedido_id] ?? 0) + item.cantidad * (item.precio_unitario ?? 0);
  }
  return totales;
}
