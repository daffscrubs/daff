import type { Database } from "@/types/database.types";

type ItemPedido = Database["public"]["Tables"]["items_pedido"]["Row"];

export function totalesPorPedido(items: ItemPedido[]): Record<string, number> {
  const totales: Record<string, number> = {};
  for (const item of items) {
    totales[item.pedido_id] = (totales[item.pedido_id] ?? 0) + item.cantidad * (item.precio_unitario ?? 0);
  }
  return totales;
}
