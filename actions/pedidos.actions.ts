"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { pagoPedidoSchema, pedidoSchema, type PagoPedidoInput, type PedidoInput } from "@/lib/validaciones/pedidos.schema";
import type { EstatusPedido } from "@/types/database.types";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

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

export async function crearPedido(input: PedidoInput): Promise<AccionResultado<string>> {
  const perfil = await requerirPerfil(["admin", "ventas"]);
  const datos = pedidoSchema.parse(input);
  const supabase = await createClient();

  const folio = await generarFolioPedido(supabase);

  const { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: datos.clienteId,
      folio,
      fecha_compromiso: datos.fechaCompromiso || null,
      creado_por: perfil.id,
      notas: datos.notas || null,
      dias_credito: datos.diasCredito,
    })
    .select("id")
    .single();

  if (errorPedido) return accionError(errorPedido.message);

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
    return accionError(errorItems.message);
  }

  revalidatePath("/pedidos");
  return accionOk(pedido.id as string);
}

export async function actualizarEstatusPedido(id: string, estatus: EstatusPedido): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();
  const { error } = await supabase.from("pedidos").update({ estatus }).eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  return accionOk(undefined);
}

async function requerirPedidoEditable(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<AccionResultado> {
  const { data: pedido, error } = await supabase.from("pedidos").select("estatus").eq("id", id).single();
  if (error) return accionError(error.message);
  if (pedido.estatus === "cancelado") {
    return accionError("No se puede modificar un pedido cancelado.");
  }
  return accionOk(undefined);
}

export async function actualizarPedido(id: string, input: PedidoInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const datos = pedidoSchema.parse(input);
  const supabase = await createClient();

  const editable = await requerirPedidoEditable(supabase, id);
  if (!editable.ok) return editable;

  const { error: errorPedido } = await supabase
    .from("pedidos")
    .update({
      cliente_id: datos.clienteId,
      fecha_compromiso: datos.fechaCompromiso || null,
      notas: datos.notas || null,
      dias_credito: datos.diasCredito,
    })
    .eq("id", id);

  if (errorPedido) return accionError(errorPedido.message);

  const { error: errorEliminar } = await supabase.from("items_pedido").delete().eq("pedido_id", id);
  if (errorEliminar) return accionError(errorEliminar.message);

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

  if (errorItems) return accionError(errorItems.message);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  return accionOk(undefined);
}

export async function cancelarPedido(id: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();

  const editable = await requerirPedidoEditable(supabase, id);
  if (!editable.ok) return editable;

  // Cancelar el pedido debe cancelar también su producción activa: de lo
  // contrario se podrían seguir registrando entregas (y
  // consumiendo materiales) sobre un pedido que el cliente ya no quiere.
  const { data: lotes, error: errorLotes } = await supabase
    .from("lotes_produccion")
    .select("id, estatus")
    .eq("pedido_id", id);
  if (errorLotes) return accionError(errorLotes.message);

  const idsActivos = (lotes ?? [])
    .filter((lote) => lote.estatus !== "terminada" && lote.estatus !== "cancelada")
    .map((lote) => lote.id);

  if (idsActivos.length) {
    const { error: errorCancelarLotes } = await supabase
      .from("lotes_produccion")
      .update({ estatus: "cancelada" })
      .in("id", idsActivos);
    if (errorCancelarLotes) return accionError(errorCancelarLotes.message);
  }

  const { error } = await supabase.from("pedidos").update({ estatus: "cancelado" }).eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/produccion");
  return accionOk(undefined);
}

export async function registrarPagoPedido(input: PagoPedidoInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "ventas"]);
  const datos = pagoPedidoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("pagos_pedido").insert({
    pedido_id: datos.pedidoId,
    monto: datos.monto,
    fecha: datos.fecha,
    notas: datos.notas || null,
    registrado_por: perfil.id,
  });

  if (error) return accionError(error.message);
  revalidatePath(`/pedidos/${datos.pedidoId}`);
  revalidatePath("/pedidos");
  return accionOk(undefined);
}
