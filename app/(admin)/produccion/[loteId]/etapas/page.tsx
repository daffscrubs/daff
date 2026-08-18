import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EtapasLoteManager } from "@/components/produccion/EtapasLoteManager";

export default async function EtapasLotePage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId } = await params;
  const supabase = await createClient();

  const [{ data: lote }, { data: items }, { data: loteEtapas }, { data: etapasCatalogo }, { data: modelos }, { data: tallas }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("folio").eq("id", loteId).single(),
      supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
      supabase.from("lote_etapas").select("*").eq("lote_id", loteId),
      supabase.from("etapas_proceso").select("*").order("nombre"),
      supabase.from("modelos").select("id, nombre"),
      supabase.from("tallas").select("id, codigo"),
    ]);

  if (!lote) notFound();

  return (
    <EtapasLoteManager
      loteId={loteId}
      lote={lote}
      loteEtapas={loteEtapas ?? []}
      etapasCatalogo={etapasCatalogo ?? []}
      items={items ?? []}
      modelos={modelos ?? []}
      tallas={tallas ?? []}
    />
  );
}
