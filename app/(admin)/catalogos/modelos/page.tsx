import { createClient } from "@/lib/supabase/server";
import { ModelosManager } from "@/components/catalogos/ModelosManager";

export default async function ModelosPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: tallas }, { data: modeloTallas }] = await Promise.all([
    supabase.from("modelos").select("*").order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
    supabase.from("modelo_tallas").select("modelo_id, precio_venta"),
  ]);

  return <ModelosManager modelos={modelos ?? []} tallas={tallas ?? []} modeloTallas={modeloTallas ?? []} />;
}
