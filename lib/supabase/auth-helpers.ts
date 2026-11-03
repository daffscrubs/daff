import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types/database.types";
import { rutaInicial, tienePermiso } from "@/lib/permisos";

// `cache` hace que el layout, la página y las acciones de una misma petición compartan una sola
// lectura del perfil en vez de repetir la verificación del usuario y la consulta cada vez.
// getClaims valida el token en el servidor sin ir a la red cuando el proyecto usa llaves
// asimétricas (y cae a la consulta normal si no).
export const getPerfilActual = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", userId)
    .single();

  return perfil;
});

export async function requerirPerfil(rolesPermitidos?: RolUsuario[]) {
  const perfil = await getPerfilActual();

  if (!perfil) redirect("/login");
  if (rolesPermitidos && !rolesPermitidos.includes(perfil.rol)) {
    redirect(perfil.rol === "colaborador" ? "/bordado" : "/dashboard");
  }

  return perfil;
}

/** Exige un permiso concreto (el administrador siempre lo tiene); si no, manda a su pantalla de inicio. */
export async function requerirPermiso(permiso: string) {
  const perfil = await requerirPerfil();
  if (!tienePermiso(perfil, permiso)) redirect(rutaInicial(perfil));
  return perfil;
}
