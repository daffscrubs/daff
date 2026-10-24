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
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";
import type { Database } from "@/types/database.types";

export async function crearUsuario(input: CrearUsuarioInput): Promise<AccionResultado> {
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
    return accionError(errorAuth?.message ?? "No se pudo crear el usuario");
  }

  const { error: errorPerfil } = await admin.from("perfiles").insert({
    id: usuarioCreado.user.id,
    nombre_completo: datos.nombreCompleto,
    rol: datos.rol,
    usuario_corto: datos.rol === "colaborador" ? datos.usuarioCorto : null,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(usuarioCreado.user.id);
    return accionError(errorPerfil.message);
  }

  revalidatePath("/usuarios");
  return accionOk(undefined);
}

export async function eliminarUsuario(id: string): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin"]);
  if (perfil.id === id) return accionError("No puedes eliminar tu propio usuario.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return accionError(
      "No se puede eliminar: este usuario tiene actividad registrada (pedidos, producción, entregas, etc). Desactívalo en su lugar."
    );
  }

  revalidatePath("/usuarios");
  return accionOk(undefined);
}

export interface UsuarioParaEditar {
  perfil: Database["public"]["Tables"]["perfiles"]["Row"];
  email: string;
}

export async function obtenerUsuarioParaEditar(id: string): Promise<AccionResultado<UsuarioParaEditar>> {
  await requerirPerfil(["admin"]);
  const admin = createAdminClient();

  const { data: perfil, error: errorPerfil } = await admin.from("perfiles").select("*").eq("id", id).single();
  if (errorPerfil) return accionError(errorPerfil.message);

  const { data: usuarioAuth, error: errorAuth } = await admin.auth.admin.getUserById(id);
  if (errorAuth) return accionError(errorAuth.message);

  return accionOk({
    perfil,
    email: usuarioAuth.user?.email ?? "",
  });
}

export async function actualizarUsuario(id: string, input: EditarUsuarioInput): Promise<AccionResultado> {
  await requerirPerfil(["admin"]);
  const datos = editarUsuarioSchema.parse(input);
  const admin = createAdminClient();

  const actualizacionAuth: { email?: string; password?: string } = {};

  if (datos.rol === "colaborador") {
    if (!datos.usuarioCorto || datos.usuarioCorto.length < 2) {
      return accionError("El usuario debe tener al menos 2 caracteres.");
    }
    actualizacionAuth.email = `${datos.usuarioCorto}@${dominioColaborador}`;
  } else if (datos.email) {
    actualizacionAuth.email = datos.email;
  }

  if (datos.nuevaContrasena) {
    if (datos.rol === "colaborador" && !/^\d{6}$/.test(datos.nuevaContrasena)) {
      return accionError("El PIN debe tener 6 dígitos.");
    }
    if (datos.rol !== "colaborador" && datos.nuevaContrasena.length < 6) {
      return accionError("La contraseña debe tener al menos 6 caracteres.");
    }
    actualizacionAuth.password = datos.nuevaContrasena;
  }

  if (Object.keys(actualizacionAuth).length) {
    const { error: errorAuth } = await admin.auth.admin.updateUserById(id, actualizacionAuth);
    if (errorAuth) return accionError(errorAuth.message);
  }

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({
      nombre_completo: datos.nombreCompleto,
      rol: datos.rol,
      usuario_corto: datos.rol === "colaborador" ? datos.usuarioCorto : null,
    })
    .eq("id", id);

  if (errorPerfil) return accionError(errorPerfil.message);

  revalidatePath("/usuarios");
  return accionOk(undefined);
}
