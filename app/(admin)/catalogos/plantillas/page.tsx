import { createClient } from "@/lib/supabase/server";
import { PlantillasManager } from "@/components/catalogos/PlantillasManager";

export default async function PlantillasPage() {
  const supabase = await createClient();
  const [{ data: plantillas }, { data: clientes }] = await Promise.all([
    supabase.from("plantillas_pedido").select("*").order("nombre"),
    supabase.from("clientes").select("*").order("nombre_comercial"),
  ]);

  return <PlantillasManager plantillas={plantillas ?? []} clientes={clientes ?? []} />;
}
