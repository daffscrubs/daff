import { createClient } from "@/lib/supabase/server";
import { sugerirFolioOrdenAction } from "@/actions/produccion.actions";
import { FormLote } from "@/components/produccion/FormLote";

export default async function NuevoLotePage() {
  const supabase = await createClient();

  const [
    resultadoFolio,
    { data: pedidos },
    { data: itemsPedido },
    { data: modelos },
    { data: tallas },
    { data: modeloTallas },
    { data: materiales },
  ] = await Promise.all([
    sugerirFolioOrdenAction(),
    supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
    supabase.from("items_pedido").select("*"),
    supabase.from("modelos").select("*").eq("activo", true).order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    supabase.from("modelo_tallas").select("*"),
    supabase.from("materiales").select("*").order("nombre"),
  ]);

  const folioSugerido = resultadoFolio.ok ? resultadoFolio.data : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nueva orden de producción</h1>
        <p className="text-muted-foreground">
          Puedes agregar varios productos (modelos y tallas distintas) en una misma orden.
        </p>
      </div>
      <FormLote
        folioSugerido={folioSugerido}
        pedidos={pedidos ?? []}
        itemsPedido={itemsPedido ?? []}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
        materiales={materiales ?? []}
      />
    </div>
  );
}
