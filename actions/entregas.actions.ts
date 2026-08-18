"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  entregaSchema,
  registrarEntregaRealSchema,
  type EntregaInput,
  type RegistrarEntregaRealInput,
} from "@/lib/validaciones/entregas.schema";

export async function crearEntrega(input: EntregaInput) {
  const perfil = await requerirPerfil(["admin", "ventas"]);
  const datos = entregaSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entregas")
    .insert({
      pedido_id: datos.pedidoId,
      fecha_programada: datos.fechaProgramada,
      notas: datos.notas || null,
      registrado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/entregas");
  return data.id as string;
}

export async function registrarEntregaReal(id: string, pedidoId: string, input: RegistrarEntregaRealInput) {
  await requerirPerfil(["admin", "ventas"]);
  const datos = registrarEntregaRealSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("entregas")
    .update({
      estatus: "entregada",
      fecha_real: new Date().toISOString(),
      recibido_por: datos.recibidoPor,
      firma_url: datos.firmaUrl || null,
      notas: datos.notas || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  const { error: errorPedido } = await supabase
    .from("pedidos")
    .update({ estatus: "entregado" })
    .eq("id", pedidoId);

  if (errorPedido) throw new Error(errorPedido.message);

  revalidatePath("/entregas");
  revalidatePath(`/entregas/${id}`);
  revalidatePath(`/pedidos/${pedidoId}`);
}
