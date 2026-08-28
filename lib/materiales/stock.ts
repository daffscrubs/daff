import type { Database } from "@/types/database.types";

type UnidadParaStock = Pick<
  Database["public"]["Tables"]["unidades_material"]["Row"],
  "material_id" | "cantidad_actual" | "estatus"
>;

/**
 * Suma cantidad_actual de las unidades no dadas de baja, agrupado por
 * material. Un material con seguimiento_por_unidad nunca recibe
 * movimientos_inventario (esa es la vía vieja, por bulto), así que su
 * materiales.stock_actual se queda congelado en 0 desde que se activa el
 * seguimiento por unidad — no es un dato desactualizado que haya que
 * "refrescar", simplemente no aplica y hay que calcular el stock real desde
 * sus unidades cada vez que se muestra.
 */
export function stockPorUnidadesPorMaterial(unidades: UnidadParaStock[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const u of unidades) {
    if (u.estatus === "de_baja") continue;
    mapa.set(u.material_id, (mapa.get(u.material_id) ?? 0) + u.cantidad_actual);
  }
  return mapa;
}

/**
 * El stock real de un material: si se controla por unidad, la suma de sus
 * unidades disponibles/agotadas parcialmente (no las dadas de baja); si no,
 * el materiales.stock_actual de siempre (mantenido por movimientos_inventario).
 */
export function stockEfectivo(
  material: { id: string; seguimiento_por_unidad: boolean; stock_actual: number },
  stockPorUnidades: Map<string, number>
): number {
  return material.seguimiento_por_unidad ? stockPorUnidades.get(material.id) ?? 0 : material.stock_actual;
}
