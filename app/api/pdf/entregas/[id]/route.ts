import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { EntregaDocumento, type ItemEntregaPDF } from "@/lib/pdf/EntregaDocumento";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil(["admin", "supervisor", "ventas"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: entrega } = await supabase
    .from("entregas")
    .select("*, pedidos(folio, clientes(nombre_comercial))")
    .eq("id", id)
    .single();

  if (!entrega) return new Response("No encontrado", { status: 404 });
  if (entrega.estatus !== "entregada" || !entrega.fecha_real || !entrega.recibido_por) {
    return new Response("Esta entrega todavía no ha sido confirmada", { status: 400 });
  }

  const [{ data: items }, { data: modelos }, { data: tallas }] = await Promise.all([
    supabase.from("items_pedido").select("*").eq("pedido_id", entrega.pedido_id),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
  ]);

  const itemsPDF: ItemEntregaPDF[] = (items ?? []).map((item) => ({
    producto: modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "—",
    talla: tallas?.find((t) => t.id === item.talla_id)?.codigo ?? "—",
    cantidad: item.cantidad,
  }));

  const buffer = await renderToBuffer(
    EntregaDocumento({
      folio: entrega.pedidos?.folio ?? entrega.id.slice(0, 8).toUpperCase(),
      cliente: entrega.pedidos?.clientes?.nombre_comercial ?? null,
      fechaProgramada: entrega.fecha_programada,
      fechaReal: new Date(entrega.fecha_real).toLocaleDateString("es-MX"),
      recibidoPor: entrega.recibido_por,
      notas: entrega.notas,
      items: itemsPDF,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="entrega-${entrega.pedidos?.folio ?? entrega.id}.pdf"`,
    },
  });
}
