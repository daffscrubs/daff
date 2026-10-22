import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
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
    { data: stockProductos },
    { data: ubicaciones },
  ] = await Promise.all([
    sugerirFolioOrdenAction(),
    supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
    supabase.from("items_pedido").select("*"),
    supabase.from("modelos").select("*").eq("activo", true).order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    leerTodo((d, h) => supabase.from("modelo_tallas").select("*").order("id").range(d, h)),
    supabase.from("materiales").select("*").order("nombre"),
    leerTodo((d, h) => supabase.from("stock_productos").select("modelo_id, cantidad_actual").order("id").range(d, h)),
    supabase.from("ubicaciones").select("*").eq("activa", true).order("orden").order("nombre"),
  ]);

  const folioSugerido = resultadoFolio.ok ? resultadoFolio.data : "";

  // Piezas en inventario por modelo (todas sus tallas juntas), para mostrarlas
  // junto a cada producto en el buscador.
  const existencias: Record<string, number> = {};
  for (const s of stockProductos ?? []) {
    existencias[s.modelo_id] = (existencias[s.modelo_id] ?? 0) + s.cantidad_actual;
  }

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
        existencias={existencias}
        ubicaciones={ubicaciones ?? []}
      />
    </div>
  );
}
