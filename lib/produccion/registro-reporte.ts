import type { Database } from "@/types/database.types";
import type { RegistroReporte } from "@/components/produccion/ReporteProductividadTable";

type RegistroConPerfil = Database["public"]["Tables"]["registros_avance_colaborador"]["Row"] & {
  perfiles: { nombre_completo: string } | null;
};

export function construirRegistrosReporte({
  registros,
  etapasCatalogo,
  loteEtapas,
  items,
  lotes,
  modelos,
  tallas,
}: {
  registros: RegistroConPerfil[];
  etapasCatalogo: Database["public"]["Tables"]["etapas_proceso"]["Row"][];
  loteEtapas: Database["public"]["Tables"]["lote_etapas"]["Row"][];
  items: Database["public"]["Tables"]["items_orden_produccion"]["Row"][];
  lotes: { id: string; folio: string }[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
}): RegistroReporte[] {
  const nombreEtapa = (id?: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";

  return registros.map((r) => {
    const le = loteEtapas.find((le) => le.id === r.lote_etapa_id);
    const item = items.find((i) => i.id === le?.item_orden_id);
    const nombreModelo = item ? modelos.find((m) => m.id === item.modelo_id)?.nombre : undefined;
    const codigoTalla = item ? tallas.find((t) => t.id === item.talla_id)?.codigo : undefined;
    const folioOrden = lotes.find((l) => l.id === r.lote_id)?.folio ?? "—";

    return {
      id: r.id,
      fecha: r.fecha,
      created_at: r.created_at,
      cantidad: r.cantidad,
      origen: r.origen,
      observaciones: r.observaciones,
      foto_url: r.foto_url,
      colaboradorId: r.colaborador_id,
      colaborador: r.perfiles?.nombre_completo ?? "—",
      etapa: nombreEtapa(le?.etapa_id),
      producto: nombreModelo ? `${nombreModelo} ${codigoTalla ?? ""}`.trim() : "—",
      folioOrden,
    };
  });
}
