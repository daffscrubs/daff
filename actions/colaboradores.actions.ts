"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

export async function guardarFuncionesColaborador(perfilId: string, etapaIds: string[]): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error: errorEliminar } = await supabase.from("colaborador_etapas").delete().eq("perfil_id", perfilId);
  if (errorEliminar) return accionError(errorEliminar.message);

  if (etapaIds.length) {
    const { error: errorInsertar } = await supabase
      .from("colaborador_etapas")
      .insert(etapaIds.map((etapaId) => ({ perfil_id: perfilId, etapa_id: etapaId })));
    if (errorInsertar) return accionError(errorInsertar.message);
  }

  revalidatePath("/usuarios");
  return accionOk(undefined);
}
