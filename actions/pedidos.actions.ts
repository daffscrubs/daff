"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { pedidoSchema, type PedidoInput } from "@/lib/validaciones/pedidos.schema";
import type { EstatusPedido } from "@/types/database.types";

async function generarFolioPedido(supabase: Awaited<ReturnType<typeof createClient>>) {
  const anio = new Date().getFullYear();
  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${anio}-01-01`)
    .lt("created_at", `${anio + 1}-01-01`);

  const consecutivo = String((count ?? 0) + 1).padStart(4, "0");
  return `PED-${anio}-${consecutivo}`;
}

export async function crearPedido(input: PedidoInput) {
  const perfil = await requerirPerfil(["admin", "ventas"]);
  const datos = pedidoSchema.parse(input);
  const supabase = await createClient();

  const folio = await generarFolioPedido(supabase);

  const { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: datos.clienteId,
      folio,
      fecha_compromiso: datos.fechaCompromiso,
      creado_por: perfil.id,
      notas: datos.notas || null,
    })
    .select("id")
    .single();

  if (errorPedido) throw new Error(errorPedido.message);

  const { error: errorItems } = await supabase.from("items_pedido").insert(
    datos.items.map((item) => ({
      pedido_id: pedido.id,
      modelo_id: item.modeloId,
      talla_id: item.tallaId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario ?? null,
      notas: item.notas || null,
    }))
  );

  if (errorItems) {
    await supabase.from("pedidos").delete().eq("id", pedido.id);
    throw new Error(errorItems.message);
  }

  revalidatePath("/pedidos");
  return pedido.id as string;
}

export async function actualizarEstatusPedido(id: string, estatus: EstatusPedido) {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();
  const { error } = await supabase.from("pedidos").update({ estatus }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}

async function requerirPedidoEditable(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: pedido, error } = await supabase.from("pedidos").select("estatus").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (pedido.estatus === "cancelado") {
    throw new Error("No se puede modificar un pedido cancelado.");
  }
}

export async function actualizarPedido(id: string, input: PedidoInput) {
  await requerirPerfil(["admin", "ventas"]);
  const datos = pedidoSchema.parse(input);
  const supabase = await createClient();

  await requerirPedidoEditable(supabase, id);

  const { error: errorPedido } = await supabase
    .from("pedidos")
    .update({
      cliente_id: datos.clienteId,
      fecha_compromiso: datos.fechaCompromiso,
      notas: datos.notas || null,
    })
    .eq("id", id);

  if (errorPedido) throw new Error(errorPedido.message);

  const { error: errorEliminar } = await supabase.from("items_pedido").delete().eq("pedido_id", id);
  if (errorEliminar) throw new Error(errorEliminar.message);

  const { error: errorItems } = await supabase.from("items_pedido").insert(
    datos.items.map((item) => ({
      pedido_id: id,
      modelo_id: item.modeloId,
      talla_id: item.tallaId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario ?? null,
      notas: item.notas || null,
    }))
  );

  if (errorItems) throw new Error(errorItems.message);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
}

export async function cancelarPedido(id: string) {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();

  await requerirPedidoEditable(supabase, id);

  // Cancelar el pedido debe cancelar también su producción activa: de lo
  // contrario un colaborador podría seguir registrando avance (y
  // consumiendo materiales) sobre un pedido que el cliente ya no quiere.
  const { data: lotes, error: errorLotes } = await supabase
    .from("lotes_produccion")
    .select("id, estatus")
    .eq("pedido_id", id);
  if (errorLotes) throw new Error(errorLotes.message);

  const idsActivos = (lotes ?? [])
    .filter((lote) => lote.estatus !== "terminada" && lote.estatus !== "cancelada")
    .map((lote) => lote.id);

  if (idsActivos.length) {
    const { error: errorCancelarLotes } = await supabase
      .from("lotes_produccion")
      .update({ estatus: "cancelada" })
      .in("id", idsActivos);
    if (errorCancelarLotes) throw new Error(errorCancelarLotes.message);
  }

  const { error } = await supabase.from("pedidos").update({ estatus: "cancelado" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/produccion");
}
