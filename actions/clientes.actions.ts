"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { clienteSchema, type ClienteInput } from "@/lib/validaciones/clientes.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

export async function crearCliente(input: ClienteInput): Promise<AccionResultado<string>> {
  await requerirPerfil(["admin", "ventas"]);
  const datos = clienteSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre_comercial: datos.nombreComercial,
      razon_social: datos.razonSocial || null,
      rfc: datos.rfc || null,
      contacto_nombre: datos.contactoNombre || null,
      telefono: datos.telefono || null,
      email: datos.email || null,
      direccion: datos.direccion || null,
      notas: datos.notas || null,
    })
    .select("id")
    .single();

  if (error) return accionError(error.message);
  revalidatePath("/clientes");
  return accionOk(data.id as string);
}

export async function actualizarCliente(id: string, input: ClienteInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const datos = clienteSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("clientes")
    .update({
      nombre_comercial: datos.nombreComercial,
      razon_social: datos.razonSocial || null,
      rfc: datos.rfc || null,
      contacto_nombre: datos.contactoNombre || null,
      telefono: datos.telefono || null,
      email: datos.email || null,
      direccion: datos.direccion || null,
      notas: datos.notas || null,
    })
    .eq("id", id);

  if (error) return accionError(error.message);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return accionOk(undefined);
}
