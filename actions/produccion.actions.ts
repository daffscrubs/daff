"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  agregarEtapaLoteSchema,
  editarOrdenProduccionSchema,
  incidenciaSchema,
  ordenProduccionSchema,
  type AgregarEtapaLoteInput,
  type EditarOrdenProduccionInput,
  type IncidenciaInput,
  type OrdenProduccionInput,
} from "@/lib/validaciones/produccion.schema";
import { fechaISOLocal } from "@/lib/fechas";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

async function sugerirFolioOrden(supabase: Awaited<ReturnType<typeof createClient>>) {
  const anio = new Date().getFullYear();
  const { count } = await supabase
    .from("lotes_produccion")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${anio}-01-01`)
    .lt("created_at", `${anio + 1}-01-01`);

  const consecutivo = String((count ?? 0) + 1).padStart(4, "0");
  return `OP-${anio}-${consecutivo}`;
}

export async function sugerirFolioOrdenAction(): Promise<AccionResultado<string>> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  return accionOk(await sugerirFolioOrden(supabase));
}

export async function crearOrdenProduccion(input: OrdenProduccionInput): Promise<AccionResultado<string>> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = ordenProduccionSchema.parse(input);
  const supabase = await createClient();

  const { data: lote, error } = await supabase
    .from("lotes_produccion")
    .insert({
      folio: datos.folio,
      pedido_id: datos.pedidoId || null,
      fecha_inicio: fechaISOLocal(new Date()),
      fecha_fin_estimada: datos.fechaFinEstimada || null,
      creado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("duplicate key")) {
      return accionError("Ya existe una orden con ese folio.");
    }
    return accionError(error.message);
  }

  const { error: errorItems } = await supabase.from("items_orden_produccion").insert(
    datos.items.map((item) => ({
      lote_id: lote.id,
      modelo_id: item.modeloId,
      talla_id: item.tallaId,
      cantidad_planeada: item.cantidadPlaneada,
    }))
  );

  if (errorItems) {
    await supabase.from("lotes_produccion").delete().eq("id", lote.id);
    return accionError(errorItems.message);
  }

  if (datos.insumos.length) {
    const { error: errorInsumos } = await supabase.from("consumo_material_orden").insert(
      datos.insumos.map((insumo) => ({
        lote_id: lote.id,
        material_id: insumo.materialId,
        cantidad_estimada: insumo.cantidadEstimada,
      }))
    );
    if (errorInsumos) return accionError(errorInsumos.message);
  }

  revalidatePath("/produccion");
  return accionOk(lote.id as string);
}

export async function actualizarOrdenProduccion(loteId: string, input: EditarOrdenProduccionInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = editarOrdenProduccionSchema.parse(input);
  const supabase = await createClient();

  const { data: lote, error: errorLote } = await supabase
    .from("lotes_produccion")
    .select("estatus")
    .eq("id", loteId)
    .single();
  if (errorLote) return accionError(errorLote.message);
  if (lote.estatus === "cancelada") {
    return accionError("No se puede modificar una orden cancelada.");
  }

  const { error: errorFecha } = await supabase
    .from("lotes_produccion")
    .update({ fecha_fin_estimada: datos.fechaFinEstimada || null })
    .eq("id", loteId);
  if (errorFecha) return accionError(errorFecha.message);

  // Los productos solo se pueden reemplazar mientras la orden no tenga
  // procesos configurados (lote_etapas): una vez configurados, el avance ya
  // depende de la cantidad planeada original de cada producto.
  const { count: etapasCount } = await supabase
    .from("lote_etapas")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId);

  if (!etapasCount) {
    const { error: errorEliminar } = await supabase.from("items_orden_produccion").delete().eq("lote_id", loteId);
    if (errorEliminar) return accionError(errorEliminar.message);

    const { error: errorItems } = await supabase.from("items_orden_produccion").insert(
      datos.items.map((item) => ({
        lote_id: loteId,
        modelo_id: item.modeloId,
        talla_id: item.tallaId,
        cantidad_planeada: item.cantidadPlaneada,
      }))
    );
    if (errorItems) return accionError(errorItems.message);
  }

  revalidatePath("/produccion");
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}

// El trigger de BD que sincroniza pedidos<->lotes_produccion solo se dispara
// al insertar un avance; cancelar un lote no dispara nada, así que el pedido
// se recalcula aquí manualmente para no dejarlo "atorado" (o marcado como
// listo sin haber producido nada).
async function reevaluarEstatusPedido(supabase: Awaited<ReturnType<typeof createClient>>, pedidoId: string) {
  const { data: lotes } = await supabase.from("lotes_produccion").select("estatus").eq("pedido_id", pedidoId);
  if (!lotes || !lotes.length) return;

  const { data: pedido } = await supabase.from("pedidos").select("estatus").eq("id", pedidoId).single();
  if (!pedido || pedido.estatus === "cancelado" || pedido.estatus === "entregado") return;

  const todosFinalizados = lotes.every((lote) => lote.estatus === "terminada" || lote.estatus === "cancelada");
  const hayTerminada = lotes.some((lote) => lote.estatus === "terminada");

  if (todosFinalizados && hayTerminada && pedido.estatus !== "listo") {
    await supabase.from("pedidos").update({ estatus: "listo" }).eq("id", pedidoId);
  } else if (todosFinalizados && !hayTerminada && pedido.estatus !== "confirmado") {
    // Todos los lotes del pedido se cancelaron y ninguno llegó a terminarse:
    // no hay producción activa, el pedido vuelve a "confirmado" para que
    // quede visible que necesita una nueva orden de producción.
    await supabase.from("pedidos").update({ estatus: "confirmado" }).eq("id", pedidoId);
  }
}

export async function cancelarOrdenProduccion(loteId: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: lote, error: errorLote } = await supabase
    .from("lotes_produccion")
    .select("estatus, pedido_id")
    .eq("id", loteId)
    .single();
  if (errorLote) return accionError(errorLote.message);
  if (lote.estatus === "cancelada") {
    return accionError("Esta orden ya está cancelada.");
  }

  const { error } = await supabase.from("lotes_produccion").update({ estatus: "cancelada" }).eq("id", loteId);
  if (error) return accionError(error.message);

  if (lote.pedido_id) {
    await reevaluarEstatusPedido(supabase, lote.pedido_id);
    revalidatePath(`/pedidos/${lote.pedido_id}`);
  }

  revalidatePath("/produccion");
  revalidatePath(`/produccion/${loteId}`);
  revalidatePath("/pedidos");
  return accionOk(undefined);
}

export async function agregarEtapaLote(input: AgregarEtapaLoteInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = agregarEtapaLoteSchema.parse(input);
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("items_orden_produccion")
    .select("id")
    .eq("lote_id", datos.loteId);

  if (!items?.length) return accionError("La orden no tiene productos configurados.");

  const { data: existentes } = await supabase
    .from("lote_etapas")
    .select("orden_secuencia")
    .eq("lote_id", datos.loteId)
    .order("orden_secuencia", { ascending: false })
    .limit(1);

  const siguienteOrden = (existentes?.[0]?.orden_secuencia ?? 0) + 1;

  const { error } = await supabase.from("lote_etapas").insert(
    items.map((item) => ({
      lote_id: datos.loteId,
      item_orden_id: item.id,
      etapa_id: datos.etapaId,
      orden_secuencia: siguienteOrden,
    }))
  );

  if (error) return accionError(error.message);
  revalidatePath(`/produccion/${datos.loteId}/etapas`);
  revalidatePath(`/produccion/${datos.loteId}`);
  return accionOk(undefined);
}

export async function quitarEtapaLote(loteId: string, ordenSecuencia: number): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: filas } = await supabase
    .from("lote_etapas")
    .select("cantidad_completada")
    .eq("lote_id", loteId)
    .eq("orden_secuencia", ordenSecuencia);

  if (filas?.some((f) => f.cantidad_completada > 0)) {
    return accionError("No se puede quitar una etapa que ya tiene avance registrado.");
  }

  const { error } = await supabase
    .from("lote_etapas")
    .delete()
    .eq("lote_id", loteId)
    .eq("orden_secuencia", ordenSecuencia);

  if (error) return accionError(error.message);
  revalidatePath(`/produccion/${loteId}/etapas`);
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}

export async function crearIncidencia(input: IncidenciaInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil();
  const datos = incidenciaSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("incidencias_produccion").insert({
    lote_id: datos.loteId,
    lote_etapa_id: datos.loteEtapaId || null,
    reportado_por: perfil.id,
    descripcion: datos.descripcion,
    gravedad: datos.gravedad,
    foto_url: datos.fotoUrl || null,
  });

  if (error) return accionError(error.message);
  revalidatePath(`/produccion/${datos.loteId}`);
  return accionOk(undefined);
}

export async function resolverIncidencia(id: string, loteId: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("incidencias_produccion").update({ resuelto: true }).eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}

export async function actualizarNotasOrden(loteId: string, notas: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("lotes_produccion").update({ notas: notas || null }).eq("id", loteId);
  if (error) return accionError(error.message);
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}
