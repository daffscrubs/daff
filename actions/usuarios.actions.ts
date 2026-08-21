"use server";

import { revalidatePath } from "next/cache";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { dominioColaborador } from "@/lib/validaciones/auth.schema";
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  type CrearUsuarioInput,
  type EditarUsuarioInput,
} from "@/lib/validaciones/usuario.schema";

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

export async function eliminarUsuario(id: string) {
  const perfil = await requerirPerfil(["admin"]);
  if (perfil.id === id) throw new Error("No puedes eliminar tu propio usuario.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    throw new Error(
      "No se puede eliminar: este usuario tiene actividad registrada (pedidos, producción, avances, etc). Desactívalo en su lugar."
    );
  }

  revalidatePath("/usuarios");
}

export async function obtenerUsuarioParaEditar(id: string) {
  await requerirPerfil(["admin"]);
  const admin = createAdminClient();

  const { data: perfil, error: errorPerfil } = await admin.from("perfiles").select("*").eq("id", id).single();
  if (errorPerfil) throw new Error(errorPerfil.message);

  const { data: usuarioAuth, error: errorAuth } = await admin.auth.admin.getUserById(id);
  if (errorAuth) throw new Error(errorAuth.message);

  return {
    perfil,
    email: usuarioAuth.user?.email ?? "",
  };
}

export async function actualizarUsuario(id: string, input: EditarUsuarioInput) {
  await requerirPerfil(["admin"]);
  const datos = editarUsuarioSchema.parse(input);
  const admin = createAdminClient();

  const actualizacionAuth: { email?: string; password?: string } = {};

  if (datos.rol === "colaborador") {
    if (!datos.usuarioCorto || datos.usuarioCorto.length < 2) {
      throw new Error("El usuario debe tener al menos 2 caracteres.");
    }
    actualizacionAuth.email = `${datos.usuarioCorto}@${dominioColaborador}`;
  } else if (datos.email) {
    actualizacionAuth.email = datos.email;
  }

  if (datos.nuevaContrasena) {
    if (datos.rol === "colaborador" && !/^\d{6}$/.test(datos.nuevaContrasena)) {
      throw new Error("El PIN debe tener 6 dígitos.");
    }
    if (datos.rol !== "colaborador" && datos.nuevaContrasena.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }
    actualizacionAuth.password = datos.nuevaContrasena;
  }

  if (Object.keys(actualizacionAuth).length) {
    const { error: errorAuth } = await admin.auth.admin.updateUserById(id, actualizacionAuth);
    if (errorAuth) throw new Error(errorAuth.message);
  }

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({
      nombre_completo: datos.nombreCompleto,
      rol: datos.rol,
      usuario_corto: datos.rol === "colaborador" ? datos.usuarioCorto : null,
    })
    .eq("id", id);

  if (errorPerfil) throw new Error(errorPerfil.message);

  revalidatePath("/usuarios");
}
