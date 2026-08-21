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

  const { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .select("estatus")
    .eq("id", datos.pedidoId)
    .single();

  if (errorPedido) throw new Error(errorPedido.message);
  if (pedido.estatus !== "listo") {
    throw new Error(
      "No se puede programar la entrega: el pedido todavía tiene procesos de producción sin terminar."
    );
  }

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

  // La fecha real de entrega es libre: puede ser antes, en, o después de la
  // fecha programada — lo único que importa es que el pedido ya esté listo.
  const { data: pedido, error: errorConsultaPedido } = await supabase
    .from("pedidos")
    .select("estatus")
    .eq("id", pedidoId)
    .single();

  if (errorConsultaPedido) throw new Error(errorConsultaPedido.message);
  if (pedido.estatus !== "listo") {
    throw new Error(
      "No se puede confirmar la entrega: el pedido todavía tiene procesos de producción sin terminar."
    );
  }

  const ahora = new Date();
  const [anio, mes, dia] = datos.fechaReal.split("-").map(Number);
  const fechaRealConHora = new Date(anio, mes - 1, dia, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());

  const { error } = await supabase
    .from("entregas")
    .update({
      estatus: "entregada",
      fecha_real: fechaRealConHora.toISOString(),
      recibido_por: datos.recibidoPor,
      firma_url: datos.firmaUrl || null,
      notas: datos.notas || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  const { error: errorActualizarPedido } = await supabase
    .from("pedidos")
    .update({ estatus: "entregado" })
    .eq("id", pedidoId);

  if (errorActualizarPedido) throw new Error(errorActualizarPedido.message);

  revalidatePath("/entregas");
  revalidatePath(`/entregas/${id}`);
  revalidatePath(`/pedidos/${pedidoId}`);
}
