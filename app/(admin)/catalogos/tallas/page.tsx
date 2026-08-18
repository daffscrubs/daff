import { createClient } from "@/lib/supabase/server";
import { TallasManager } from "@/components/catalogos/TallasManager";

export default async function TallasPage() {
  const supabase = await createClient();
  const { data: tallas } = await supabase.from("tallas").select("*").order("orden");

  return <TallasManager tallas={tallas ?? []} />;
}
