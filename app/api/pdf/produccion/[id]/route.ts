import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  OrdenProduccionDocumento,
  type ItemOrdenPDF,
  type InsumoOrdenPDF,
  type EntregaPDF,
} from "@/lib/pdf/OrdenProduccionDocumento";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";
import { construirHistorialOrden } from "@/lib/produccion/historial";
import { entregadoPorItem, type EntregaConItems } from "@/lib/produccion/entregas";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil(["admin", "supervisor", "ventas"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: lote } = await supabase
    .from("lotes_produccion")
    .select("*, pedidos(clientes(nombre_comercial)), maquileros(nombre)")
    .eq("id", id)
    .single();
  if (!lote) return new Response("No encontrado", { status: 404 });

  const [{ data: items }, { data: modelos }, { data: tallas }, { data: consumos }, { data: materiales }, { data: entregasProd }, { data: perfiles }] = await Promise.all([
    supabase.from("items_orden_produccion").select("*").eq("lote_id", id),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
    supabase.from("consumo_material_orden").select("*").eq("lote_id", id),
    supabase.from("materiales").select("id, nombre, unidad_medida"),
    supabase.from("entregas_produccion").select("*, entrega_produccion_items(item_orden_id, cantidad)").eq("lote_id", id).order("fecha", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("perfiles").select("id, nombre_completo"),
  ]);

  const entregas = (entregasProd ?? []) as EntregaConItems[];
  const entregadoPorRenglon = entregadoPorItem(entregas);
  const pedidoAlCliente = lote.pedido_id
    ? (await supabase.from("entregas").select("*").eq("pedido_id", lote.pedido_id)).data ?? []
    : [];

  const nombreItem = (itemId: string) => {
    const item = items?.find((i) => i.id === itemId);
    if (!item) return "";
    return `${modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "—"} ${tallas?.find((t) => t.id === item.talla_id)?.codigo ?? ""}`.trim();
  };
  const nombrePerfil = (perfilId: string | null) => perfiles?.find((p) => p.id === perfilId)?.nombre_completo ?? "—";
  const quienEntrego = (e: EntregaConItems) => (e.maquilero_id ? lote.maquileros?.nombre ?? "Maquilero" : nombrePerfil(e.entregado_por));
  const piezas = (e: EntregaConItems) => e.entrega_produccion_items.map((i) => `${i.cantidad} ${nombreItem(i.item_orden_id)}`.trim()).join(", ");

  const itemsPDF: ItemOrdenPDF[] = (items ?? []).map((item) => ({
    producto: modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "—",
    talla: tallas?.find((t) => t.id === item.talla_id)?.codigo ?? "—",
    pedido: item.cantidad_planeada,
    entregado: entregadoPorRenglon.get(item.id) ?? 0,
  }));

  const insumosPDF: InsumoOrdenPDF[] = (consumos ?? []).map((c) => {
    const material = materiales?.find((m) => m.id === c.material_id);
    return {
      material: material?.nombre ?? "—",
      cantidadEstimada: c.cantidad_estimada,
      cantidadReal: c.cantidad_real_registrada_en ? c.cantidad_real : null,
      unidad: material?.unidad_medida ?? "",
    };
  });

  const cronologia = construirHistorialOrden({
    lote,
    entregasProduccion: entregas,
    descripcionEntrega: (e) => ({ piezas: piezas(e), quien: `Entregó ${quienEntrego(e)} · recibió ${nombrePerfil(e.recibido_por)}` }),
    consumos: consumos ?? [],
    materiales: materiales ?? [],
    entregas: pedidoAlCliente,
  });

  const entregasPDF: EntregaPDF[] = entregas.map((e) => ({
    fecha: e.fecha,
    entrego: quienEntrego(e),
    recibio: nombrePerfil(e.recibido_por),
    piezas: piezas(e),
    cancelada: e.estatus === "cancelada",
  }));

  const buffer = await renderToBuffer(
    OrdenProduccionDocumento({
      folio: lote.folio,
      cliente: lote.pedidos?.clientes?.nombre_comercial ?? null,
      estatus: `${ESTATUS_ORDEN_LABEL[lote.estatus]}${lote.cerrada_con_faltantes ? " (con faltantes)" : ""}`,
      fechaInicio: lote.fecha_inicio,
      fechaFinEstimada: lote.fecha_fin_estimada,
      notas: lote.notas,
      items: itemsPDF,
      quienLaHace: lote.tipo_produccion === "maquila" ? `Maquila · ${lote.maquileros?.nombre ?? "—"}` : lote.tipo_produccion === "interna" ? "Interna" : "Sin asignar",
      insumos: insumosPDF,
      cronologia,
      entregas: entregasPDF,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${lote.folio}.pdf"`,
    },
  });
}
