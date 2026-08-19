import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { CompraDocumento, type ItemCompraPDF } from "@/lib/pdf/CompraDocumento";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil(["admin", "supervisor", "ventas"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: compra } = await supabase.from("compras").select("*").eq("id", id).single();
  if (!compra) return new Response("No encontrado", { status: 404 });

  const [{ data: items }, { data: materiales }] = await Promise.all([
    supabase.from("compra_items").select("*").eq("compra_id", id),
    supabase.from("materiales").select("id, nombre, unidad_medida"),
  ]);

  const itemsPDF: ItemCompraPDF[] = (items ?? []).map((item) => {
    const material = materiales?.find((m) => m.id === item.material_id);
    return {
      material: material?.nombre ?? "—",
      cantidad: item.cantidad,
      unidad: material?.unidad_medida ?? "",
      costoUnitario: item.costo_unitario,
      subtotal: item.subtotal ?? item.cantidad * item.costo_unitario,
    };
  });

  const buffer = await renderToBuffer(
    CompraDocumento({
      folio: compra.folio,
      proveedor: compra.proveedor,
      fecha: compra.fecha,
      notas: compra.notas,
      items: itemsPDF,
      total: compra.total,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${compra.folio}.pdf"`,
    },
  });
}
