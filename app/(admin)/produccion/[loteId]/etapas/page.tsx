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

  const [{ data: lote }, { data: loteEtapas }, { data: etapasCatalogo }] = await Promise.all([
    supabase.from("lotes_produccion").select("folio, cantidad_planeada").eq("id", loteId).single(),
    supabase.from("lote_etapas").select("*").eq("lote_id", loteId),
    supabase.from("etapas_proceso").select("*").order("nombre"),
  ]);

  if (!lote) notFound();

  return (
    <EtapasLoteManager
      loteId={loteId}
      lote={lote}
      loteEtapas={loteEtapas ?? []}
      etapasCatalogo={etapasCatalogo ?? []}
    />
  );
}
