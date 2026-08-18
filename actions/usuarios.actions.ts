"use server";

import { revalidatePath } from "next/cache";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { dominioColaborador } from "@/lib/validaciones/auth.schema";
import { crearUsuarioSchema, type CrearUsuarioInput } from "@/lib/validaciones/usuario.schema";

export async function crearUsuario(input: CrearUsuarioInput) {
  await requerirPerfil(["admin"]);

  const datos = crearUsuarioSchema.parse(input);
  const admin = createAdminClient();

  const email = datos.rol === "colaborador" ? `${datos.usuarioCorto}@${dominioColaborador}` : datos.email;
  const password = datos.rol === "colaborador" ? datos.pin : datos.password;

  const { data: usuarioCreado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorAuth || !usuarioCreado.user) {
    throw new Error(errorAuth?.message ?? "No se pudo crear el usuario");
  }

  const { error: errorPerfil } = await admin.from("perfiles").insert({
    id: usuarioCreado.user.id,
    nombre_completo: datos.nombreCompleto,
    rol: datos.rol,
    usuario_corto: datos.rol === "colaborador" ? datos.usuarioCorto : null,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(usuarioCreado.user.id);
    throw new Error(errorPerfil.message);
  }

  revalidatePath("/usuarios");
}

export async function cambiarEstadoUsuario(id: string, activo: boolean) {
  await requerirPerfil(["admin"]);
  const admin = createAdminClient();

  const { error } = await admin.from("perfiles").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/usuarios");
}
