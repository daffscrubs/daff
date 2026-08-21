import { createClient } from "@/lib/supabase/server";
import { InventarioManager } from "@/components/inventario/InventarioManager";

export default async function InventarioPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: tallas }, { data: modeloTallas }, { data: stock }] = await Promise.all([
    supabase.from("modelos").select("*").order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    supabase.from("modelo_tallas").select("modelo_id, precio_venta"),
    supabase.from("stock_productos").select("modelo_id, cantidad_actual"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <p className="text-muted-foreground">Productos, sus existencias y precios.</p>
      </div>
      <InventarioManager
        modelos={modelos ?? []}
        tallas={tallas ?? []}
        modeloTallas={modeloTallas ?? []}
        stock={stock ?? []}
      />
    </div>
  );
}
