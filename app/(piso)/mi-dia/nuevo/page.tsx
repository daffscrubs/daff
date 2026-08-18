import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { FormAvanceColaborador } from "@/components/produccion/FormAvanceColaborador";

export default async function NuevoAvancePage({
  searchParams,
}: {
  searchParams: Promise<{ loteEtapaId?: string }>;
}) {
  const { loteEtapaId } = await searchParams;
  if (!loteEtapaId) notFound();

  const supabase = await createClient();

  const { data: loteEtapa } = await supabase
    .from("lote_etapas")
    .select("*, etapas_proceso(nombre)")
    .eq("id", loteEtapaId)
    .single();

  if (!loteEtapa) notFound();

  const [{ data: lote }, { data: item }, { data: hermanas }] = await Promise.all([
    supabase.from("lotes_produccion").select("folio").eq("id", loteEtapa.lote_id).single(),
    supabase
      .from("items_orden_produccion")
      .select("cantidad_planeada, modelos(nombre), tallas(codigo)")
      .eq("id", loteEtapa.item_orden_id)
      .single(),
    supabase.from("lote_etapas").select("*").eq("item_orden_id", loteEtapa.item_orden_id),
  ]);

  if (!lote || !item) notFound();

  const ordenadas = (hermanas ?? []).slice().sort((a, b) => a.orden_secuencia - b.orden_secuencia);
  const conDisponible = calcularDisponiblePorEtapa(ordenadas, item.cantidad_planeada);
  const actual = conDisponible.find((e) => e.id === loteEtapaId);

  return (
    <FormAvanceColaborador
      loteId={loteEtapa.lote_id}
      loteEtapaId={loteEtapaId}
      nombreEtapa={loteEtapa.etapas_proceso?.nombre ?? "Etapa"}
      folioLote={`${lote.folio} · ${item.modelos?.nombre ?? ""} · Talla ${item.tallas?.codigo ?? ""}`}
      disponible={actual?.disponible ?? 0}
    />
  );
}
