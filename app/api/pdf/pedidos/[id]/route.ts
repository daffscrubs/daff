import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { PedidoDocumento, type ItemPedidoPDF } from "@/lib/pdf/PedidoDocumento";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil(["admin", "ventas", "supervisor"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: pedido } = await supabase.from("pedidos").select("*, clientes(*)").eq("id", id).single();
  if (!pedido) return new Response("No encontrado", { status: 404 });

  const [{ data: items }, { data: modelos }, { data: tallas }] = await Promise.all([
    supabase.from("items_pedido").select("*").eq("pedido_id", id),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
  ]);

  const itemsPDF: ItemPedidoPDF[] = (items ?? []).map((item) => ({
    producto: modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "—",
    talla: tallas?.find((t) => t.id === item.talla_id)?.codigo ?? "—",
    cantidad: item.cantidad,
    precioUnitario: item.precio_unitario,
  }));

  const buffer = await renderToBuffer(
    PedidoDocumento({
      folio: pedido.folio,
      cliente: pedido.clientes?.nombre_comercial ?? "—",
      contacto: pedido.clientes?.contacto_nombre ?? "",
      telefono: pedido.clientes?.telefono ?? "",
      fechaPedido: pedido.fecha_pedido,
      fechaCompromiso: pedido.fecha_compromiso,
      estatus: ESTATUS_PEDIDO_LABEL[pedido.estatus],
      notas: pedido.notas,
      items: itemsPDF,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pedido.folio}.pdf"`,
    },
  });
}
