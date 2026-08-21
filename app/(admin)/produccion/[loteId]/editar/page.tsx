import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditarOrdenForm } from "@/components/produccion/EditarOrdenForm";

export default async function EditarOrdenPage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId } = await params;
  const supabase = await createClient();

  const [{ data: lote }, { data: items }, { data: loteEtapas }, { data: modelos }, { data: tallas }, { data: modeloTallas }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("*").eq("id", loteId).single(),
      supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
      supabase.from("lote_etapas").select("id").eq("lote_id", loteId),
      supabase.from("modelos").select("*").order("nombre"),
      supabase.from("tallas").select("*").order("orden"),
      supabase.from("modelo_tallas").select("*"),
    ]);

  if (!lote) notFound();
  if (lote.estatus === "cancelada") notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar {lote.folio}</h1>
        <p className="text-muted-foreground">Modifica los productos o la fecha estimada de fin.</p>
      </div>
      <EditarOrdenForm
        loteId={loteId}
        folio={lote.folio}
        fechaFinEstimadaInicial={lote.fecha_fin_estimada ?? ""}
        itemsIniciales={(items ?? []).map((item) => ({
          modeloId: item.modelo_id,
          tallaId: item.talla_id,
          cantidadPlaneada: item.cantidad_planeada,
        }))}
        bloqueado={!!loteEtapas?.length}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
      />
    </div>
  );
}
