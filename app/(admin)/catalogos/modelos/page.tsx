import { createClient } from "@/lib/supabase/server";
import { ModelosManager } from "@/components/catalogos/ModelosManager";

export default async function ModelosPage() {
  const supabase = await createClient();
  const { data: modelos } = await supabase.from("modelos").select("*").order("nombre");

  return <ModelosManager modelos={modelos ?? []} />;
}
