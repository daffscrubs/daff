import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { Button } from "@/components/ui/button";
import { NavProduccion } from "@/components/produccion/NavProduccion";
import { ProduccionTable } from "@/components/produccion/ProduccionTable";

export default async function ProduccionPage() {
  const perfil = await requerirPerfil(["admin", "supervisor", "ventas"]);
  const supabase = await createClient();
  const [{ data: lotes }, { data: items }, { data: modelos }, { data: tallas }, { data: maquileros }, { data: entregados }] = await Promise.all([
    supabase.from("lotes_produccion").select("*").order("created_at", { ascending: false }),
    leerTodo((d, h) => supabase.from("items_orden_produccion").select("*").order("id").range(d, h)),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
    supabase.from("maquileros").select("id, nombre"),
    leerTodo((d, h) =>
      supabase
        .from("entrega_produccion_items")
        .select("id, item_orden_id, cantidad, entregas_produccion!inner(estatus)")
        .eq("entregas_produccion.estatus", "registrada")
        .order("id")
        .range(d, h)
    ),
  ]);

  const entregadoPorItem: Record<string, number> = {};
  for (const e of entregados) entregadoPorItem[e.item_orden_id] = (entregadoPorItem[e.item_orden_id] ?? 0) + e.cantidad;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="text-muted-foreground">Órdenes de producción, lo que se ha entregado y lo que falta.</p>
        </div>
        {perfil.rol !== "ventas" && <Button render={<Link href="/produccion/nuevo" />} nativeButton={false}>Nueva orden de producción</Button>}
      </div>
      <NavProduccion puedeVerPagos={tienePermiso(perfil, "produccion.pagos_maquila")} />

      <ProduccionTable
        lotes={lotes ?? []}
        items={items}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        maquileros={maquileros ?? []}
        entregadoPorItem={entregadoPorItem}
      />
    </div>
  );
}
