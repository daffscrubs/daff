import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { hoyMexico, sumarDias } from "@/lib/fechas";
import { esFechaReal, finDeMes, inicioDeAnio, inicioDeMes, mesesAntes } from "@/lib/reportes/ventas";
import { NavReportes } from "@/components/reportes/NavReportes";
import { ReporteEntregas, type LineaEntrega, type PresetEntregas } from "@/components/reportes/ReporteEntregas";

export default async function ReporteEntregasPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const hoy = hoyMexico();

  const mesPasado = mesesAntes(hoy, 1);
  const presets: PresetEntregas[] = [
    { id: "hoy", etiqueta: "Hoy", desde: hoy, hasta: hoy },
    { id: "7d", etiqueta: "Últimos 7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    { id: "mes", etiqueta: "Este mes", desde: inicioDeMes(hoy), hasta: hoy },
    { id: "mes-pasado", etiqueta: "Mes pasado", desde: mesPasado, hasta: finDeMes(mesPasado) },
    { id: "anio", etiqueta: "Este año", desde: inicioDeAnio(hoy), hasta: hoy },
  ];
  const base = presets.find((p) => p.id === "mes")!;
  let desde = params.desde && esFechaReal(params.desde) ? params.desde : base.desde;
  let hasta = params.hasta && esFechaReal(params.hasta) ? params.hasta : base.hasta;
  if (hasta < desde) [desde, hasta] = [hasta, desde];

  const [{ data: entregas }, { data: items }, { data: modelos }, { data: tallas }, { data: perfiles }, { data: maquileros }] = await Promise.all([
    leerTodo((d, h) =>
      supabase
        .from("entregas_produccion")
        .select("id, fecha, lote_id, tipo_produccion, entregado_por, maquilero_id, recibido_por, lotes_produccion(folio), entrega_produccion_items(item_orden_id, cantidad)")
        .eq("estatus", "registrada")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("id")
        .range(d, h)
    ),
    leerTodo((d, h) => supabase.from("items_orden_produccion").select("id, modelo_id, talla_id").order("id").range(d, h)),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
    supabase.from("perfiles").select("id, nombre_completo"),
    supabase.from("maquileros").select("id, nombre"),
  ]);

  const itemPorId = new Map(items.map((i) => [i.id, i]));
  const nombrePerfil = (id: string | null) => perfiles?.find((p) => p.id === id)?.nombre_completo ?? "—";
  const lineas: LineaEntrega[] = entregas.flatMap((e) =>
    e.entrega_produccion_items.map((i) => {
      const item = itemPorId.get(i.item_orden_id);
      const maquila = e.tipo_produccion === "maquila";
      return {
        entregaId: e.id,
        fecha: e.fecha,
        loteId: e.lote_id,
        folio: e.lotes_produccion?.folio ?? "—",
        tipo: maquila ? ("maquila" as const) : ("interna" as const),
        quienId: (maquila ? e.maquilero_id : e.entregado_por) ?? "",
        quien: maquila ? maquileros?.find((m) => m.id === e.maquilero_id)?.nombre ?? "—" : nombrePerfil(e.entregado_por),
        recibio: nombrePerfil(e.recibido_por),
        producto: modelos?.find((m) => m.id === item?.modelo_id)?.nombre ?? "—",
        talla: tallas?.find((t) => t.id === item?.talla_id)?.codigo ?? "—",
        cantidad: i.cantidad,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-muted-foreground">Ventas y piezas entregadas por tu taller y tus maquileros.</p>
      </div>
      <NavReportes />
      <ReporteEntregas desde={desde} hasta={hasta} presets={presets} lineas={lineas} />
    </div>
  );
}
