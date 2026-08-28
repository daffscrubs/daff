import type { Database } from "@/types/database.types";
import type { RegistroReporte } from "@/components/produccion/ReporteProductividadTable";
import { etapaIdEfectivoDe } from "@/lib/produccion/avance";

// Pick con solo los campos que esta función lee, en vez del Row completo de
// cada tabla: así una pantalla puede pedirle a Supabase nada más esas
// columnas (menos bytes) sin dejar de poder llamar esta función — un Row
// completo sigue cumpliendo estos tipos sin problema.
type RegistroConPerfil = Pick<
  Database["public"]["Tables"]["registros_avance_colaborador"]["Row"],
  "id" | "fecha" | "created_at" | "cantidad" | "origen" | "observaciones" | "foto_url" | "colaborador_id" | "lote_id" | "lote_etapa_id"
> & {
  perfiles: { nombre_completo: string } | null;
};
type LoteEtapaParaReporte = Pick<
  Database["public"]["Tables"]["lote_etapas"]["Row"],
  "id" | "item_orden_id" | "etapa_id" | "parent_lote_etapa_id" | "nombre_subproceso"
>;
type ItemOrdenParaReporte = Pick<Database["public"]["Tables"]["items_orden_produccion"]["Row"], "id" | "modelo_id" | "talla_id">;

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
  loteEtapas: LoteEtapaParaReporte[];
  items: ItemOrdenParaReporte[];
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
    const nombreEtapaBase = nombreEtapa(le ? etapaIdEfectivoDe(le, loteEtapas) : undefined);
    const etapaVisible = le?.nombre_subproceso ? `${nombreEtapaBase} — ${le.nombre_subproceso}` : nombreEtapaBase;

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
      etapa: etapaVisible,
      producto: nombreModelo ? `${nombreModelo} ${codigoTalla ?? ""}`.trim() : "—",
      folioOrden,
    };
  });
}
