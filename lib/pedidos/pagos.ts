import type { Database } from "@/types/database.types";

type PagoPedido = Database["public"]["Tables"]["pagos_pedido"]["Row"];

export function pagadoPorPedido(pagos: PagoPedido[]): Record<string, number> {
  const pagados: Record<string, number> = {};
  for (const pago of pagos) {
    pagados[pago.pedido_id] = (pagados[pago.pedido_id] ?? 0) + pago.monto;
  }
  return pagados;
}
