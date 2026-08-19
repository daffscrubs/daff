import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { OrdenProduccionDocumento, type ItemOrdenPDF, type InsumoOrdenPDF } from "@/lib/pdf/OrdenProduccionDocumento";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil(["admin", "supervisor", "ventas"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: lote } = await supabase.from("lotes_produccion").select("*, pedidos(clientes(nombre_comercial))").eq("id", id).single();
  if (!lote) return new Response("No encontrado", { status: 404 });

  const [{ data: items }, { data: loteEtapas }, { data: etapasCatalogo }, { data: modelos }, { data: tallas }, { data: consumos }, { data: materiales }] =
    await Promise.all([
      supabase.from("items_orden_produccion").select("*").eq("lote_id", id),
      supabase.from("lote_etapas").select("*").eq("lote_id", id),
      supabase.from("etapas_proceso").select("*"),
      supabase.from("modelos").select("id, nombre"),
      supabase.from("tallas").select("id, codigo"),
      supabase.from("consumo_material_orden").select("*").eq("lote_id", id),
      supabase.from("materiales").select("id, nombre, unidad_medida"),
    ]);

  const itemsPDF: ItemOrdenPDF[] = (items ?? []).map((item) => ({
    producto: modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "—",
    talla: tallas?.find((t) => t.id === item.talla_id)?.codigo ?? "—",
    cantidad: item.cantidad_planeada,
  }));

  const procesos = [...new Map((loteEtapas ?? []).map((le) => [le.orden_secuencia, le.etapa_id])).entries()]
    .sort(([a], [b]) => a - b)
    .map(([, etapaId]) => etapasCatalogo?.find((e) => e.id === etapaId)?.nombre ?? "—");

  const insumosPDF: InsumoOrdenPDF[] = (consumos ?? []).map((c) => {
    const material = materiales?.find((m) => m.id === c.material_id);
    return {
      material: material?.nombre ?? "—",
      cantidadEstimada: c.cantidad_estimada,
      unidad: material?.unidad_medida ?? "",
    };
  });

  const buffer = await renderToBuffer(
    OrdenProduccionDocumento({
      folio: lote.folio,
      cliente: lote.pedidos?.clientes?.nombre_comercial ?? null,
      estatus: ESTATUS_ORDEN_LABEL[lote.estatus],
      fechaInicio: lote.fecha_inicio,
      fechaFinEstimada: lote.fecha_fin_estimada,
      notas: lote.notas,
      items: itemsPDF,
      procesos,
      insumos: insumosPDF,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${lote.folio}.pdf"`,
    },
  });
}
