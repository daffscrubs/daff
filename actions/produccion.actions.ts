"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  editarOrdenProduccionSchema,
  incidenciaSchema,
  ordenProduccionSchema,
  type EditarOrdenProduccionInput,
  type IncidenciaInput,
  type OrdenProduccionInput,
} from "@/lib/validaciones/produccion.schema";
import { tienePermiso } from "@/lib/permisos";
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
  const validado = ordenProduccionSchema.safeParse(input);
  if (!validado.success) return accionError(validado.error.issues[0]?.message ?? "Datos de la orden inválidos");
  const datos = validado.data;
  const supabase = await createClient();

  const { data: lote, error } = await supabase
    .from("lotes_produccion")
    .insert({
      folio: datos.folio,
      pedido_id: datos.pedidoId || null,
      fecha_inicio: fechaISOLocal(new Date()),
      fecha_fin_estimada: datos.fechaFinEstimada || null,
      ubicacion_destino_id: datos.ubicacionDestinoId,
      tipo_produccion: datos.tipoProduccion,
      maquilero_id: datos.tipoProduccion === "maquila" ? datos.maquileroId : null,
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

  // Los precios por pieza son montos: solo los guarda quien tiene el permiso de pagos de maquila.
  if (datos.tipoProduccion === "maquila" && tienePermiso(perfil, "produccion.pagos_maquila") && datos.precios?.length) {
    const modelosOrden = new Set(datos.items.map((i) => i.modeloId));
    const { error: errorPrecios } = await supabase.from("precios_maquila_orden").insert(
      datos.precios.filter((p) => modelosOrden.has(p.modeloId)).map((p) => ({ lote_id: lote.id, modelo_id: p.modeloId, precio_por_pieza: p.precioPorPieza }))
    );
    if (errorPrecios) return accionError(`La orden se creó, pero no se guardaron los precios: ${errorPrecios.message}`);
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
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = editarOrdenProduccionSchema.safeParse(input);
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos de la orden inválidos");
  const v = datos.data;
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

  // El tipo y el maquilero solo cambian mientras no haya entregas: la base de datos lo exige y avisa.
  const { error: errorFecha } = await supabase
    .from("lotes_produccion")
    .update({
      fecha_fin_estimada: v.fechaFinEstimada || null,
      ubicacion_destino_id: v.ubicacionDestinoId || null,
      tipo_produccion: v.tipoProduccion,
      maquilero_id: v.tipoProduccion === "maquila" ? v.maquileroId : null,
    })
    .eq("id", loteId);
  if (errorFecha) return accionError(errorFecha.message);

  // Los productos se ajustan renglón por renglón (no se borran y recrean): una orden con entregas conserva su
  // historial, la cantidad no puede bajar de lo ya entregado y no se quita un renglón que ya tiene entregas.
  const { data: existentes, error: errorExistentes } = await supabase
    .from("items_orden_produccion")
    .select("id, modelo_id, talla_id, cantidad_planeada")
    .eq("lote_id", loteId);
  if (errorExistentes) return accionError(errorExistentes.message);

  const clave = (modeloId: string, tallaId: string) => `${modeloId}|${tallaId}`;
  const porClave = new Map((existentes ?? []).map((i) => [clave(i.modelo_id, i.talla_id), i]));
  const nuevos = new Map<string, number>();
  for (const item of v.items) nuevos.set(clave(item.modeloId, item.tallaId), (nuevos.get(clave(item.modeloId, item.tallaId)) ?? 0) + item.cantidadPlaneada);

  for (const [k, cantidad] of nuevos) {
    const actual = porClave.get(k);
    if (actual) {
      if (actual.cantidad_planeada !== cantidad) {
        const { error } = await supabase.from("items_orden_produccion").update({ cantidad_planeada: cantidad }).eq("id", actual.id);
        if (error) return accionError(error.message);
      }
    } else {
      const [modeloId, tallaId] = k.split("|");
      const { error } = await supabase.from("items_orden_produccion").insert({ lote_id: loteId, modelo_id: modeloId, talla_id: tallaId, cantidad_planeada: cantidad });
      if (error) return accionError(error.message);
    }
  }
  for (const [k, item] of porClave) {
    if (nuevos.has(k)) continue;
    const { error } = await supabase.from("items_orden_produccion").delete().eq("id", item.id);
    if (error) return accionError(error.message);
  }

  // Precios por pieza (montos): solo quien tiene el permiso de pagos de maquila. Los pagos ya generados conservan su monto.
  if (tienePermiso(perfil, "produccion.pagos_maquila") && v.precios) {
    const modelosOrden = new Set(v.items.map((i) => i.modeloId));
    if (v.tipoProduccion === "maquila") {
      const filas = v.precios.filter((p) => modelosOrden.has(p.modeloId)).map((p) => ({ lote_id: loteId, modelo_id: p.modeloId, precio_por_pieza: p.precioPorPieza }));
      if (filas.length) {
        const { error } = await supabase.from("precios_maquila_orden").upsert(filas);
        if (error) return accionError(error.message);
      }
    }
    const { data: guardados } = await supabase.from("precios_maquila_orden").select("modelo_id").eq("lote_id", loteId);
    const sobran = (guardados ?? []).map((g) => g.modelo_id).filter((id) => !modelosOrden.has(id) || v.tipoProduccion !== "maquila");
    if (sobran.length) await supabase.from("precios_maquila_orden").delete().eq("lote_id", loteId).in("modelo_id", sobran);
  }

  // Cambiar cantidades puede completar o reabrir la orden.
  const { error: errorEstado } = await supabase.rpc("fn_recalcular_estado_orden", { p_lote_id: loteId });
  if (errorEstado) return accionError(errorEstado.message);

  revalidatePath("/produccion");
  revalidatePath(`/produccion/${loteId}`);
  revalidatePath("/pedidos");
  return accionOk(undefined);
}

// El pedido sigue a sus órdenes (listo cuando todas terminaron, en producción mientras alguna avanza); la regla
// vive en la base de datos y se vuelve a calcular al cancelar una orden.
async function reevaluarEstatusPedido(supabase: Awaited<ReturnType<typeof createClient>>, pedidoId: string) {
  await supabase.rpc("fn_reevaluar_pedido", { p_pedido_id: pedidoId });
}

// Cancelar una orden no borra su historial (items y entregas quedan
// como registro), pero el consumo REAL ya registrado sobre unidades
// específicas (rollos/bolsas) sí debe revertirse: esos materiales no se
// van a usar después de todo. El trigger fn_descontar_unidad_material solo
// resta al registrar consumo_real por primera vez, nunca revierte en un
// DELETE/UPDATE posterior -- así que sin esto, un rollo marcado "agotado"
// por una orden de prueba se queda agotado para siempre aunque la orden se
// cancele. Solo se toca cantidad_actual/estatus de la unidad (nunca se
// borra ni edita la fila de consumo_unidad_orden, que queda como el
// registro histórico de qué se llegó a registrar).
async function revertirConsumoUnidadesLote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loteId: string
): Promise<AccionResultado<string[]>> {
  const { data: consumos, error: errorConsumos } = await supabase
    .from("consumo_unidad_orden")
    .select("unidad_id, cantidad_real, unidades_material(material_id)")
    .eq("lote_id", loteId)
    .not("cantidad_real_registrada_en", "is", null);
  if (errorConsumos) return accionError(errorConsumos.message);

  const materialIds = new Set<string>();

  for (const consumo of consumos ?? []) {
    if (!consumo.cantidad_real) continue;
    if (consumo.unidades_material?.material_id) materialIds.add(consumo.unidades_material.material_id);

    const { data: unidad, error: errorUnidad } = await supabase
      .from("unidades_material")
      .select("cantidad_actual, estatus")
      .eq("id", consumo.unidad_id)
      .single();
    if (errorUnidad) return accionError(errorUnidad.message);

    const nuevaCantidad = unidad.cantidad_actual + consumo.cantidad_real;
    const { error: errorUpdate } = await supabase
      .from("unidades_material")
      .update({
        cantidad_actual: nuevaCantidad,
        // Solo revive una unidad que se agotó por esta orden; si alguien la
        // dio de baja por otro motivo, eso se queda como estaba.
        estatus: unidad.estatus === "agotado" && nuevaCantidad > 0 ? "disponible" : unidad.estatus,
      })
      .eq("id", consumo.unidad_id);
    if (errorUpdate) return accionError(errorUpdate.message);
  }

  return accionOk([...materialIds]);
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
  const { count: entregasVigentes } = await supabase
    .from("entregas_produccion")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .eq("estatus", "registrada");
  if (entregasVigentes) {
    return accionError("Esta orden ya tiene entregas registradas. Cancela primero sus entregas (se revierte el inventario) y luego la orden.");
  }

  const reversion = await revertirConsumoUnidadesLote(supabase, loteId);
  if (!reversion.ok) return reversion;

  const { error } = await supabase.from("lotes_produccion").update({ estatus: "cancelada" }).eq("id", loteId);
  if (error) return accionError(error.message);

  if (lote.pedido_id) {
    await reevaluarEstatusPedido(supabase, lote.pedido_id);
    revalidatePath(`/pedidos/${lote.pedido_id}`);
  }

  revalidatePath("/produccion");
  revalidatePath(`/produccion/${loteId}`);
  revalidatePath("/pedidos");
  revalidatePath("/materiales");
  for (const materialId of reversion.data) {
    revalidatePath(`/materiales/${materialId}`);
  }
  return accionOk(undefined);
}

export async function crearIncidencia(input: IncidenciaInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil();
  const datos = incidenciaSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("incidencias_produccion").insert({
    lote_id: datos.loteId,
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
