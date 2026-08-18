import { createClient } from "@/lib/supabase/server";
import { VariantesManager } from "@/components/catalogos/VariantesManager";

export default async function VariantesPage() {
  const supabase = await createClient();
  const [{ data: variantes }, { data: modelos }] = await Promise.all([
    supabase.from("variantes").select("*").order("created_at", { ascending: false }),
    supabase.from("modelos").select("*").order("nombre"),
  ]);

  return <VariantesManager variantes={variantes ?? []} modelos={modelos ?? []} />;
}
