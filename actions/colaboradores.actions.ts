"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";

export async function guardarFuncionesColaborador(perfilId: string, etapaIds: string[]) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error: errorEliminar } = await supabase.from("colaborador_etapas").delete().eq("perfil_id", perfilId);
  if (errorEliminar) throw new Error(errorEliminar.message);

  if (etapaIds.length) {
    const { error: errorInsertar } = await supabase
      .from("colaborador_etapas")
      .insert(etapaIds.map((etapaId) => ({ perfil_id: perfilId, etapa_id: etapaId })));
    if (errorInsertar) throw new Error(errorInsertar.message);
  }

  revalidatePath("/usuarios");
}
