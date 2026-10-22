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

  const [{ data: lote }, { data: items }, { data: loteEtapas }, { data: modelos }, { data: tallas }, { data: modeloTallas }, { data: stockProductos }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("*").eq("id", loteId).single(),
      supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
      supabase.from("lote_etapas").select("id").eq("lote_id", loteId),
      supabase.from("modelos").select("*").order("nombre"),
      supabase.from("tallas").select("*").order("orden"),
      supabase.from("modelo_tallas").select("*"),
      supabase.from("stock_productos").select("modelo_id, cantidad_actual"),
    ]);

  if (!lote) notFound();
  if (lote.estatus === "cancelada") notFound();

  // Piezas en inventario por modelo (todas sus tallas juntas), para mostrarlas
  // junto a cada producto en el buscador.
  const existencias: Record<string, number> = {};
  for (const s of stockProductos ?? []) {
    existencias[s.modelo_id] = (existencias[s.modelo_id] ?? 0) + s.cantidad_actual;
  }

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
        existencias={existencias}
      />
    </div>
  );
}
