import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { PlantillaItemsManager } from "@/components/catalogos/PlantillaItemsManager";

export default async function PlantillaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: plantilla }, { data: items }, { data: modelos }, { data: tallas }, { data: modeloTallas }] =
    await Promise.all([
      supabase.from("plantillas_pedido").select("*").eq("id", id).single(),
      supabase.from("plantilla_items").select("*").eq("plantilla_id", id),
      supabase.from("modelos").select("*").order("nombre"),
      supabase.from("tallas").select("*").order("orden"),
      leerTodo((d, h) => supabase.from("modelo_tallas").select("*").order("id").range(d, h)),
    ]);

  if (!plantilla) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{plantilla.nombre}</h1>
        <p className="text-muted-foreground">Ítems sugeridos de esta plantilla.</p>
      </div>
      <PlantillaItemsManager
        plantillaId={id}
        items={items ?? []}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
      />
    </div>
  );
}
