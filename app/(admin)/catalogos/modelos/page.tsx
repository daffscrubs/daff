import { createClient } from "@/lib/supabase/server";
import { ModelosManager } from "@/components/catalogos/ModelosManager";

export default async function ModelosPage() {
  const supabase = await createClient();
  const [{ data: modelos }, { data: tallas }] = await Promise.all([
    supabase.from("modelos").select("*").order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
  ]);

  return <ModelosManager modelos={modelos ?? []} tallas={tallas ?? []} />;
}
