"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { TODOS_LOS_PERMISOS } from "@/lib/permisos";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

const guardarPermisosSchema = z.object({
  perfilId: z.string().uuid(),
  // Solo permisos que existen en el catálogo: un id inventado no se guarda.
  permisos: z.array(z.string().refine((p) => TODOS_LOS_PERMISOS.includes(p), "Permiso desconocido")),
});

// Solo el administrador reparte permisos. La política de la tabla perfiles ya lo impone en la base
// ("admin_gestiona_perfiles"); aquí se valida además para dar un mensaje claro.
export async function guardarPermisosUsuario(perfilId: string, permisos: string[]): Promise<AccionResultado> {
  await requerirPerfil(["admin"]);
  const datos = guardarPermisosSchema.safeParse({ perfilId, permisos });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");

  const supabase = await createClient();
  const { data: objetivo, error: errorLectura } = await supabase.from("perfiles").select("rol").eq("id", perfilId).single();
  if (errorLectura || !objetivo) return accionError("No se encontró al usuario.");
  if (objetivo.rol === "admin") return accionError("Los administradores siempre tienen acceso completo.");

  const { error } = await supabase
    .from("perfiles")
    .update({ permisos: [...new Set(datos.data.permisos)] })
    .eq("id", perfilId);
  if (error) return accionError(error.message);

  revalidatePath("/ajustes");
  return accionOk(undefined);
}
