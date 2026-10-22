import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { FormPedido } from "@/components/pedidos/FormPedido";

export default async function NuevoPedidoPage() {
  const supabase = await createClient();

  const [
    { data: clientes },
    { data: modelos },
    { data: tallas },
    { data: modeloTallas },
    { data: plantillas },
    { data: plantillaItems },
  ] = await Promise.all([
    supabase.from("clientes").select("*").order("nombre_comercial"),
    supabase.from("modelos").select("*").eq("activo", true).order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    leerTodo((d, h) => supabase.from("modelo_tallas").select("*").order("id").range(d, h)),
    supabase.from("plantillas_pedido").select("*").order("nombre"),
    supabase.from("plantilla_items").select("*"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo pedido</h1>
        <p className="text-muted-foreground">Registra un pedido y sus productos.</p>
      </div>
      <FormPedido
        clientes={clientes ?? []}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
        plantillas={plantillas ?? []}
        plantillaItems={plantillaItems ?? []}
      />
    </div>
  );
}
