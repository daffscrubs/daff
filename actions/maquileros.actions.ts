"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { maquileroSchema, type MaquileroInput } from "@/lib/validaciones/maquileros.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

function mensaje(error: { message: string }): string {
  return error.message.includes("maquileros_nombre_unico") ? "Ya existe un maquilero con ese nombre." : error.message;
}

// Banco y CLABE los puede escribir (y leer) solo quien tiene el permiso de pagos de maquila: la base lo exige también.
async function guardarDatosBancarios(maquileroId: string, datos: { banco?: string; clabe?: string }): Promise<string | null> {
  const supabase = await createClient();
  const banco = datos.banco || null;
  const clabe = datos.clabe || null;
  if (!banco && !clabe) {
    const { error } = await supabase.from("maquileros_datos_bancarios").delete().eq("maquilero_id", maquileroId);
    return error?.message ?? null;
  }
  const { error } = await supabase.from("maquileros_datos_bancarios").upsert({ maquilero_id: maquileroId, banco, clabe });
  return error?.message ?? null;
}

export async function crearMaquilero(input: MaquileroInput): Promise<AccionResultado<string>> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = maquileroSchema.safeParse(input);
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("maquileros")
    .insert({ nombre: datos.data.nombre, telefono: datos.data.telefono || null, notas: datos.data.notas || null })
    .select("id")
    .single();
  if (error) return accionError(mensaje(error));

  if (tienePermiso(perfil, "produccion.pagos_maquila")) {
    const errorBanco = await guardarDatosBancarios(data.id, datos.data);
    if (errorBanco) return accionError(`El maquilero se creó, pero no se guardaron los datos bancarios: ${errorBanco}`);
  }
  revalidatePath("/produccion/maquileros");
  return accionOk(data.id as string);
}

export async function actualizarMaquilero(id: string, input: MaquileroInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = maquileroSchema.safeParse(input);
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");
  const supabase = await createClient();

  const { error } = await supabase
    .from("maquileros")
    .update({ nombre: datos.data.nombre, telefono: datos.data.telefono || null, notas: datos.data.notas || null })
    .eq("id", id);
  if (error) return accionError(mensaje(error));

  if (tienePermiso(perfil, "produccion.pagos_maquila")) {
    const errorBanco = await guardarDatosBancarios(id, datos.data);
    if (errorBanco) return accionError(errorBanco);
  }
  revalidatePath("/produccion/maquileros");
  revalidatePath(`/produccion/maquileros/${id}`);
  return accionOk(undefined);
}

export async function alternarMaquileroActivo(id: string, activo: boolean): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("maquileros").update({ activo }).eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/produccion/maquileros");
  revalidatePath(`/produccion/maquileros/${id}`);
  return accionOk(undefined);
}
