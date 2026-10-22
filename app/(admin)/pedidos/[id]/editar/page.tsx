import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { FormPedido } from "@/components/pedidos/FormPedido";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: pedido },
    { data: items },
    { data: clientes },
    { data: modelos },
    { data: tallas },
    { data: modeloTallas },
  ] = await Promise.all([
    supabase.from("pedidos").select("*").eq("id", id).single(),
    supabase.from("items_pedido").select("*").eq("pedido_id", id),
    supabase.from("clientes").select("*").order("nombre_comercial"),
    supabase.from("modelos").select("*").eq("activo", true).order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    leerTodo((d, h) => supabase.from("modelo_tallas").select("*").order("id").range(d, h)),
  ]);

  if (!pedido) notFound();
  if (pedido.estatus === "cancelado") notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar {pedido.folio}</h1>
        <p className="text-muted-foreground">Modifica el cliente, los productos o la fecha compromiso.</p>
      </div>
      <FormPedido
        pedidoId={id}
        valoresIniciales={{
          clienteId: pedido.cliente_id,
          fechaCompromiso: pedido.fecha_compromiso ?? "",
          notas: pedido.notas ?? "",
          diasCredito: pedido.dias_credito,
          items: (items ?? []).map((item) => ({
            modeloId: item.modelo_id,
            tallaId: item.talla_id,
            cantidad: item.cantidad,
            precioUnitario: item.precio_unitario ?? 0,
            notas: item.notas ?? "",
          })),
        }}
        clientes={clientes ?? []}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
        plantillas={[]}
        plantillaItems={[]}
      />
    </div>
  );
}
