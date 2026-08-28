import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  OrdenProduccionDocumento,
  type ItemOrdenPDF,
  type InsumoOrdenPDF,
  type RegistroAvancePDF,
} from "@/lib/pdf/OrdenProduccionDocumento";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";
import { construirHistorialOrden } from "@/lib/produccion/historial";
import { construirRegistrosReporte } from "@/lib/produccion/registro-reporte";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil(["admin", "supervisor", "ventas"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: lote } = await supabase.from("lotes_produccion").select("*, pedidos(clientes(nombre_comercial))").eq("id", id).single();
  if (!lote) return new Response("No encontrado", { status: 404 });

  const [
    { data: items },
    { data: loteEtapas },
    { data: etapasCatalogo },
    { data: modelos },
    { data: tallas },
    { data: consumos },
    { data: materiales },
    { data: registros },
  ] = await Promise.all([
    supabase.from("items_orden_produccion").select("*").eq("lote_id", id),
    supabase.from("lote_etapas").select("*").eq("lote_id", id),
    supabase.from("etapas_proceso").select("*"),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
    supabase.from("consumo_material_orden").select("*").eq("lote_id", id),
    supabase.from("materiales").select("id, nombre, unidad_medida"),
    supabase
      .from("registros_avance_colaborador")
      .select("*, perfiles!registros_avance_colaborador_colaborador_id_fkey(nombre_completo)")
      .eq("lote_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const entregas = lote.pedido_id
    ? (await supabase.from("entregas").select("*").eq("pedido_id", lote.pedido_id)).data ?? []
    : [];

  const itemsPDF: ItemOrdenPDF[] = (items ?? []).map((item) => ({
    producto: modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "—",
    talla: tallas?.find((t) => t.id === item.talla_id)?.codigo ?? "—",
    cantidad: item.cantidad_planeada,
  }));

  const procesos = [
    ...new Map(
      (loteEtapas ?? []).filter((le) => !le.parent_lote_etapa_id).map((le) => [le.orden_secuencia!, le.etapa_id!])
    ).entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([, etapaId]) => etapasCatalogo?.find((e) => e.id === etapaId)?.nombre ?? "—");

  const insumosPDF: InsumoOrdenPDF[] = (consumos ?? []).map((c) => {
    const material = materiales?.find((m) => m.id === c.material_id);
    return {
      material: material?.nombre ?? "—",
      cantidadEstimada: c.cantidad_estimada,
      cantidadReal: c.cantidad_real_registrada_en ? c.cantidad_real : null,
      unidad: material?.unidad_medida ?? "",
    };
  });

  const registrosReporte = construirRegistrosReporte({
    registros: registros ?? [],
    etapasCatalogo: etapasCatalogo ?? [],
    loteEtapas: loteEtapas ?? [],
    items: items ?? [],
    lotes: [{ id: lote.id, folio: lote.folio }],
    modelos: modelos ?? [],
    tallas: tallas ?? [],
  });

  const cronologia = construirHistorialOrden({
    lote,
    registrosReporte,
    consumos: consumos ?? [],
    materiales: materiales ?? [],
    entregas,
  });

  const registrosAvance: RegistroAvancePDF[] = registrosReporte.map((r) => ({
    fecha: r.created_at,
    colaborador: r.colaborador,
    proceso: r.etapa,
    producto: r.producto,
    cantidad: r.cantidad,
  }));

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
      cronologia,
      registrosAvance,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${lote.folio}.pdf"`,
    },
  });
}
