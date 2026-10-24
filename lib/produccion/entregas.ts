import type { Database } from "@/types/database.types";

type Entrega = Database["public"]["Tables"]["entregas_produccion"]["Row"];
type EntregaItem = Database["public"]["Tables"]["entrega_produccion_items"]["Row"];
type ItemOrden = Database["public"]["Tables"]["items_orden_produccion"]["Row"];

export type EntregaConItems = Entrega & { entrega_produccion_items: Pick<EntregaItem, "item_orden_id" | "cantidad">[] };

export interface ResumenItem {
  itemId: string;
  modeloId: string;
  tallaId: string;
  modelo: string;
  talla: string;
  pedido: number;
  entregado: number;
  pendiente: number;
}

/** Piezas entregadas por renglón de la orden: solo cuentan las entregas vigentes (las canceladas no). */
export function entregadoPorItem(entregas: EntregaConItems[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const e of entregas) {
    if (e.estatus !== "registrada") continue;
    for (const i of e.entrega_produccion_items) total.set(i.item_orden_id, (total.get(i.item_orden_id) ?? 0) + i.cantidad);
  }
  return total;
}

/** Pedido / entregado / pendiente por producto y talla. */
export function resumenPorItem(
  items: ItemOrden[],
  entregas: EntregaConItems[],
  nombreModelo: (id: string) => string,
  codigoTalla: (id: string) => string,
  ordenTalla: (id: string) => number
): ResumenItem[] {
  const entregado = entregadoPorItem(entregas);
  return items
    .map((i) => {
      const hecho = entregado.get(i.id) ?? 0;
      return {
        itemId: i.id,
        modeloId: i.modelo_id,
        tallaId: i.talla_id,
        modelo: nombreModelo(i.modelo_id),
        talla: codigoTalla(i.talla_id),
        pedido: i.cantidad_planeada,
        entregado: hecho,
        pendiente: Math.max(0, i.cantidad_planeada - hecho),
      };
    })
    .sort((a, b) => a.modelo.localeCompare(b.modelo, "es") || ordenTalla(a.tallaId) - ordenTalla(b.tallaId));
}

export function totalesResumen(resumen: ResumenItem[]) {
  return resumen.reduce(
    (acc, r) => ({ pedido: acc.pedido + r.pedido, entregado: acc.entregado + r.entregado, pendiente: acc.pendiente + r.pendiente }),
    { pedido: 0, entregado: 0, pendiente: 0 }
  );
}
