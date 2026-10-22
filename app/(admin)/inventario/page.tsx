import { createClient } from "@/lib/supabase/server";
import { InventarioManager } from "@/components/inventario/InventarioManager";

// Importar un catálogo grande de Excel (cientos de productos) puede tardar más
// que el límite por defecto de las Server Actions de esta página.
export const maxDuration = 60;

export default async function InventarioPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: tallas }, { data: modeloTallas }, { data: stock }, { data: ubicaciones }] = await Promise.all([
    supabase.from("modelos").select("*").order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    supabase.from("modelo_tallas").select("modelo_id, precio_venta"),
    supabase.from("stock_productos").select("modelo_id, ubicacion_id, cantidad_actual"),
    supabase.from("ubicaciones").select("*").eq("activa", true).order("orden").order("nombre"),
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
        ubicaciones={ubicaciones ?? []}
      />
    </div>
  );
}
