import { createClient } from "@/lib/supabase/server";
import { FormLote } from "@/components/produccion/FormLote";

export default async function NuevoLotePage() {
  const supabase = await createClient();

  const [{ data: pedidos }, { data: items }, { data: modelos }, { data: tallas }, { data: variantes }] =
    await Promise.all([
      supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
      supabase.from("items_pedido").select("*"),
      supabase.from("modelos").select("*").eq("activo", true).order("nombre"),
      supabase.from("tallas").select("*").order("orden"),
      supabase.from("variantes").select("*"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo lote de producción</h1>
        <p className="text-muted-foreground">
          Puedes crearlo a partir de un pedido existente o de forma manual.
        </p>
      </div>
      <FormLote
        pedidos={pedidos ?? []}
        items={items ?? []}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        variantes={variantes ?? []}
      />
    </div>
  );
}
