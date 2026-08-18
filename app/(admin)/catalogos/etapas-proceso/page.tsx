import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { EtapasManager } from "@/components/catalogos/EtapasManager";

export default async function EtapasProcesoPage() {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data: etapas } = await supabase.from("etapas_proceso").select("*").order("nombre");

  return <EtapasManager etapas={etapas ?? []} esAdmin={perfil.rol === "admin"} />;
}
