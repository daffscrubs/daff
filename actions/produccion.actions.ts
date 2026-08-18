"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  agregarEtapaLoteSchema,
  incidenciaSchema,
  ordenProduccionSchema,
  type AgregarEtapaLoteInput,
  type IncidenciaInput,
  type OrdenProduccionInput,
} from "@/lib/validaciones/produccion.schema";

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

export async function sugerirFolioOrdenAction() {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  return sugerirFolioOrden(supabase);
}

export async function crearOrdenProduccion(input: OrdenProduccionInput) {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = ordenProduccionSchema.parse(input);
  const supabase = await createClient();

  const { data: lote, error } = await supabase
    .from("lotes_produccion")
    .insert({
      folio: datos.folio,
      pedido_id: datos.pedidoId || null,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin_estimada: datos.fechaFinEstimada || null,
      creado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("duplicate key")) {
      throw new Error("Ya existe una orden con ese folio.");
    }
    throw new Error(error.message);
  }

  const { error: errorItems } = await supabase.from("items_orden_produccion").insert(
    datos.items.map((item) => ({
      lote_id: lote.id,
      modelo_id: item.modeloId,
      talla_id: item.tallaId,
      variante_id: item.varianteId || null,
      cantidad_planeada: item.cantidadPlaneada,
    }))
  );

  if (errorItems) {
    await supabase.from("lotes_produccion").delete().eq("id", lote.id);
    throw new Error(errorItems.message);
  }

  if (datos.insumos.length) {
    const { error: errorInsumos } = await supabase.from("consumo_material_orden").insert(
      datos.insumos.map((insumo) => ({
        lote_id: lote.id,
        material_id: insumo.materialId,
        cantidad_estimada: insumo.cantidadEstimada,
      }))
    );
    if (errorInsumos) throw new Error(errorInsumos.message);
  }

  revalidatePath("/produccion");
  return lote.id as string;
}

export async function agregarEtapaLote(input: AgregarEtapaLoteInput) {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = agregarEtapaLoteSchema.parse(input);
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("items_orden_produccion")
    .select("id")
    .eq("lote_id", datos.loteId);

  if (!items?.length) throw new Error("La orden no tiene productos configurados.");

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

  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${datos.loteId}/etapas`);
  revalidatePath(`/produccion/${datos.loteId}`);
}

export async function quitarEtapaLote(loteId: string, ordenSecuencia: number) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: filas } = await supabase
    .from("lote_etapas")
    .select("cantidad_completada")
    .eq("lote_id", loteId)
    .eq("orden_secuencia", ordenSecuencia);

  if (filas?.some((f) => f.cantidad_completada > 0)) {
    throw new Error("No se puede quitar una etapa que ya tiene avance registrado.");
  }

  const { error } = await supabase
    .from("lote_etapas")
    .delete()
    .eq("lote_id", loteId)
    .eq("orden_secuencia", ordenSecuencia);

  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${loteId}/etapas`);
  revalidatePath(`/produccion/${loteId}`);
}

export async function crearIncidencia(input: IncidenciaInput) {
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

  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${datos.loteId}`);
}

export async function resolverIncidencia(id: string, loteId: string) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("incidencias_produccion").update({ resuelto: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${loteId}`);
}

export async function actualizarNotasOrden(loteId: string, notas: string) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("lotes_produccion").update({ notas: notas || null }).eq("id", loteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${loteId}`);
}
