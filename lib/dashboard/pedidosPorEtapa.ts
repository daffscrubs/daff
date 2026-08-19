import type { Database } from "@/types/database.types";

export interface ConteoEtapaPedidos {
  etapa: string;
  cantidad: number;
}

type Pedido = { id: string; estatus: Database["public"]["Enums"]["estatus_pedido"] };
type Lote = { id: string; pedido_id: string | null };
type Item = { id: string; lote_id: string };
type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];

export function pedidosPorEtapa({
  pedidos,
  lotes,
  items,
  loteEtapas,
  etapasCatalogo,
}: {
  pedidos: Pedido[];
  lotes: Lote[];
  items: Item[];
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
}): ConteoEtapaPedidos[] {
  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";

  const sumas = new Map<string, { suma: number; n: number }>();
  for (const le of loteEtapas) {
    const cur = sumas.get(le.etapa_id) ?? { suma: 0, n: 0 };
    cur.suma += le.orden_secuencia;
    cur.n += 1;
    sumas.set(le.etapa_id, cur);
  }
  const ordenPromedio = new Map<string, number>();
  for (const [etapaId, { suma, n }] of sumas) ordenPromedio.set(etapaId, suma / n);

  const etapasOrdenadas = etapasCatalogo
    .filter((e) => e.activo)
    .slice()
    .sort((a, b) => (ordenPromedio.get(a.id) ?? 99) - (ordenPromedio.get(b.id) ?? 99));
  const primeraEtapaId = etapasOrdenadas[0]?.id;

  const conteos = new Map<string, number>();
  for (const e of etapasOrdenadas) conteos.set(e.nombre, 0);
  conteos.set("Entregado", 0);

  for (const pedido of pedidos) {
    if (pedido.estatus === "cancelado") continue;
    if (pedido.estatus === "entregado") {
      conteos.set("Entregado", (conteos.get("Entregado") ?? 0) + 1);
      continue;
    }

    const loteIds = lotes.filter((l) => l.pedido_id === pedido.id).map((l) => l.id);
    const itemIds = items.filter((i) => loteIds.includes(i.lote_id)).map((i) => i.id);
    const etapasDelPedido = loteEtapas.filter((le) => itemIds.includes(le.item_orden_id));
    const pendientes = etapasDelPedido
      .filter((le) => le.estatus !== "completa")
      .sort((a, b) => a.orden_secuencia - b.orden_secuencia);

    let etapaId = pendientes[0]?.etapa_id;
    if (!etapaId && etapasDelPedido.length) {
      etapaId = etapasDelPedido.slice().sort((a, b) => b.orden_secuencia - a.orden_secuencia)[0].etapa_id;
    }
    if (!etapaId) etapaId = primeraEtapaId;
    if (!etapaId) continue;

    const nombre = nombreEtapa(etapaId);
    conteos.set(nombre, (conteos.get(nombre) ?? 0) + 1);
  }

  return [...conteos.entries()].map(([etapa, cantidad]) => ({ etapa, cantidad }));
}
