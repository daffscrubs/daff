"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { fechaISOLocal } from "@/lib/fechas";
import { entregarPedidoSchema, type EntregarPedidoInput } from "@/lib/validaciones/entregas.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

export async function entregarPedido(input: EntregarPedidoInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "ventas"]);
  const datos = entregarPedidoSchema.parse(input);
  const supabase = await createClient();

  const { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .select("estatus")
    .eq("id", datos.pedidoId)
    .single();

  if (errorPedido) return accionError(errorPedido.message);
  if (pedido.estatus !== "listo") {
    return accionError("No se puede entregar: el pedido todavía tiene procesos de producción sin terminar.");
  }

  const { error: errorEntrega } = await supabase.from("entregas").insert({
    pedido_id: datos.pedidoId,
    fecha_programada: fechaISOLocal(new Date()),
    fecha_real: new Date().toISOString(),
    estatus: "entregada",
    recibido_por: datos.recibidoPor || null,
    registrado_por: perfil.id,
  });

  if (errorEntrega) return accionError(errorEntrega.message);

  const { error: errorPedidoUpdate } = await supabase
    .from("pedidos")
    .update({ estatus: "entregado" })
    .eq("id", datos.pedidoId);

  if (errorPedidoUpdate) return accionError(errorPedidoUpdate.message);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${datos.pedidoId}`);
  return accionOk(undefined);
}
