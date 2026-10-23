import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { NavProduccion } from "@/components/produccion/NavProduccion";
import { MaquilerosManager, type MaquileroFila } from "@/components/produccion/MaquilerosManager";

export default async function MaquilerosPage() {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const puedeVerPagos = tienePermiso(perfil, "produccion.pagos_maquila");
  const supabase = await createClient();

  const [{ data: maquileros }, { data: lotes }, { data: items }, { data: entregados }, { data: bancarios }, { data: pagos }] = await Promise.all([
    supabase.from("maquileros").select("*").order("nombre"),
    supabase.from("lotes_produccion").select("id, maquilero_id, estatus").eq("tipo_produccion", "maquila").in("estatus", ["planeada", "en_proceso"]),
    leerTodo((d, h) => supabase.from("items_orden_produccion").select("id, lote_id, cantidad_planeada").order("id").range(d, h)),
    leerTodo((d, h) =>
      supabase.from("entrega_produccion_items").select("id, item_orden_id, cantidad, entregas_produccion!inner(estatus)").eq("entregas_produccion.estatus", "registrada").order("id").range(d, h)
    ),
    puedeVerPagos ? supabase.from("maquileros_datos_bancarios").select("*") : Promise.resolve({ data: [] }),
    puedeVerPagos ? supabase.from("pagos_maquila").select("maquilero_id, monto").eq("estatus", "pendiente") : Promise.resolve({ data: [] }),
  ]);

  const entregadoPorItem = new Map<string, number>();
  for (const e of entregados) entregadoPorItem.set(e.item_orden_id, (entregadoPorItem.get(e.item_orden_id) ?? 0) + e.cantidad);
  const itemsPorLote = new Map<string, typeof items>();
  for (const i of items) itemsPorLote.set(i.lote_id, [...(itemsPorLote.get(i.lote_id) ?? []), i]);

  const filas: MaquileroFila[] = (maquileros ?? []).map((m) => {
    const suyas = (lotes ?? []).filter((l) => l.maquilero_id === m.id);
    const pendientes = suyas.reduce(
      (acc, l) => acc + (itemsPorLote.get(l.id) ?? []).reduce((a, i) => a + Math.max(0, i.cantidad_planeada - (entregadoPorItem.get(i.id) ?? 0)), 0),
      0
    );
    const banco = (bancarios ?? []).find((b) => b.maquilero_id === m.id);
    return {
      id: m.id,
      nombre: m.nombre,
      telefono: m.telefono,
      notas: m.notas,
      activo: m.activo,
      ordenesAbiertas: suyas.length,
      piezasPendientes: pendientes,
      porPagar: puedeVerPagos ? (pagos ?? []).filter((p) => p.maquilero_id === m.id).reduce((acc, p) => acc + Number(p.monto), 0) : null,
      banco: banco?.banco ?? "",
      clabe: banco?.clabe ?? "",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Producción</h1>
        <p className="text-muted-foreground">Quienes te maquilan: sus órdenes, lo que han entregado y lo que les debes.</p>
      </div>
      <NavProduccion puedeVerPagos={puedeVerPagos} />
      <MaquilerosManager maquileros={filas} puedeVerDatosBancarios={puedeVerPagos} />
    </div>
  );
}
