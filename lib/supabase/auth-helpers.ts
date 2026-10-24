import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types/database.types";
import { rutaInicial, tienePermiso } from "@/lib/permisos";

export async function getPerfilActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return perfil;
}

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
