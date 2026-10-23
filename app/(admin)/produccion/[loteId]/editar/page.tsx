import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { entregadoPorItem as calcularEntregado, type EntregaConItems } from "@/lib/produccion/entregas";
import { EditarOrdenForm } from "@/components/produccion/EditarOrdenForm";

export default async function EditarOrdenPage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId } = await params;
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const [{ data: lote }, { data: items }, { data: entregas }, { data: precios }, { data: maquileros }, { data: modelos }, { data: tallas }, { data: modeloTallas }, { data: stockProductos }, { data: ubicaciones }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("*").eq("id", loteId).single(),
      supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
      supabase.from("entregas_produccion").select("*, entrega_produccion_items(item_orden_id, cantidad)").eq("lote_id", loteId),
      supabase.from("precios_maquila_orden").select("modelo_id, precio_por_pieza").eq("lote_id", loteId),
      supabase.from("maquileros").select("id, nombre, activo").order("nombre"),
      supabase.from("modelos").select("*").order("nombre"),
      supabase.from("tallas").select("*").order("orden"),
      leerTodo((d, h) => supabase.from("modelo_tallas").select("*").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("stock_productos").select("modelo_id, cantidad_actual").order("id").range(d, h)),
      supabase.from("ubicaciones").select("*").eq("activa", true).order("orden").order("nombre"),
    ]);

  if (!lote) notFound();
  if (lote.estatus === "cancelada") notFound();

  // Piezas en inventario por modelo (todas sus tallas juntas), para mostrarlas
  // junto a cada producto en el buscador.
  const existencias: Record<string, number> = {};
  for (const s of stockProductos ?? []) {
    existencias[s.modelo_id] = (existencias[s.modelo_id] ?? 0) + s.cantidad_actual;
  }

  const entregadoPorRenglon = calcularEntregado((entregas ?? []) as EntregaConItems[]);
  const entregadoPorModeloTalla: Record<string, number> = {};
  for (const item of items ?? []) {
    entregadoPorModeloTalla[`${item.modelo_id}|${item.talla_id}`] = entregadoPorRenglon.get(item.id) ?? 0;
  }
  const tieneEntregas = (entregas ?? []).some((e) => e.estatus === "registrada");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar {lote.folio}</h1>
        <p className="text-muted-foreground">Modifica los productos, quién la hace o la fecha estimada de fin.</p>
      </div>
      <EditarOrdenForm
        loteId={loteId}
        folio={lote.folio}
        fechaFinEstimadaInicial={lote.fecha_fin_estimada ?? ""}
        ubicacionDestinoInicial={lote.ubicacion_destino_id ?? ""}
        itemsIniciales={(items ?? []).map((item) => ({
          modeloId: item.modelo_id,
          tallaId: item.talla_id,
          cantidadPlaneada: item.cantidad_planeada,
        }))}
        tieneEntregas={tieneEntregas}
        entregadoPorItem={entregadoPorModeloTalla}
        tipoInicial={lote.tipo_produccion === "maquila" ? "maquila" : "interna"}
        maquileroInicial={lote.maquilero_id ?? ""}
        preciosIniciales={Object.fromEntries((precios ?? []).map((p) => [p.modelo_id, String(p.precio_por_pieza)]))}
        maquileros={maquileros ?? []}
        puedeVerPrecios={tienePermiso(perfil, "produccion.pagos_maquila")}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
        existencias={existencias}
        ubicaciones={ubicaciones ?? []}
      />
    </div>
  );
}
