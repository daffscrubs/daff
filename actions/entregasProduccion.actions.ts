"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil, requerirPermiso } from "@/lib/supabase/auth-helpers";
import {
  cancelarEntregaSchema,
  cerrarOrdenSchema,
  marcarPagoSchema,
  registrarEntregaSchema,
  reprogramarPagoSchema,
  type RegistrarEntregaInput,
} from "@/lib/validaciones/entregasProduccion.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

// Las reglas de fondo (no entregar de más, inventario, pago del maquilero, estatus de la orden y del pedido) viven
// en funciones de la base de datos: ahí cada operación es una sola transacción. Aquí se revisa la forma de los
// datos y se pasa el mensaje de la base tal cual, que ya está escrito para el usuario.

function refrescar(loteId?: string) {
  revalidatePath("/produccion");
  if (loteId) revalidatePath(`/produccion/${loteId}`);
  revalidatePath("/produccion/maquileros", "layout");
  revalidatePath("/produccion/pagos");
  revalidatePath("/reportes/entregas");
  revalidatePath("/inventario");
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
}

export async function registrarEntregaProduccion(input: RegistrarEntregaInput): Promise<AccionResultado<string>> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = registrarEntregaSchema.safeParse(input);
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos de la entrega inválidos");
  const v = datos.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_registrar_entrega_produccion", {
    p_lote_id: v.loteId,
    p_fecha: v.fecha,
    p_entregado_por: v.entregadoPor ?? null,
    p_recibido_por: v.recibidoPor,
    p_fecha_pago: v.fechaPago ?? null,
    p_notas: v.notas ?? null,
    p_items: v.items.map((i) => ({ item_orden_id: i.itemOrdenId, cantidad: i.cantidad })),
  });
  if (error || !data) return accionError(error?.message ?? "No se pudo registrar la entrega");
  refrescar(v.loteId);
  return accionOk(data);
}

export async function cancelarEntregaProduccion(entregaId: string, motivo: string, loteId: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = cancelarEntregaSchema.safeParse({ entregaId, motivo });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cancelar_entrega_produccion", { p_entrega_id: datos.data.entregaId, p_motivo: datos.data.motivo });
  if (error) return accionError(error.message);
  refrescar(loteId);
  return accionOk(undefined);
}

export async function cerrarOrdenProduccion(loteId: string, motivo: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = cerrarOrdenSchema.safeParse({ loteId, motivo });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cerrar_orden_produccion", { p_lote_id: datos.data.loteId, p_motivo: datos.data.motivo });
  if (error) return accionError(error.message);
  refrescar(loteId);
  return accionOk(undefined);
}

export async function reabrirOrdenProduccion(loteId: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_reabrir_orden_produccion", { p_lote_id: loteId });
  if (error) return accionError(error.message);
  refrescar(loteId);
  return accionOk(undefined);
}

export async function marcarPagoMaquila(pagoId: string, pagado: boolean, fecha?: string | null): Promise<AccionResultado> {
  await requerirPermiso("produccion.pagos_maquila");
  const datos = marcarPagoSchema.safeParse({ pagoId, pagado, fecha });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_marcar_pago_maquila", {
    p_pago_id: datos.data.pagoId,
    p_pagado: datos.data.pagado,
    p_fecha: datos.data.fecha ?? undefined,
  });
  if (error) return accionError(error.message);
  refrescar();
  return accionOk(undefined);
}

export async function reprogramarPagoMaquila(pagoId: string, fecha: string): Promise<AccionResultado> {
  await requerirPermiso("produccion.pagos_maquila");
  const datos = reprogramarPagoSchema.safeParse({ pagoId, fecha });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_reprogramar_pago_maquila", { p_pago_id: datos.data.pagoId, p_fecha: datos.data.fecha });
  if (error) return accionError(error.message);
  refrescar();
  return accionOk(undefined);
}
