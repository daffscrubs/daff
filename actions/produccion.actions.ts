"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  agregarEtapaLoteSchema,
  incidenciaSchema,
  loteSchema,
  type AgregarEtapaLoteInput,
  type IncidenciaInput,
  type LoteInput,
} from "@/lib/validaciones/produccion.schema";

async function generarFolioLote(supabase: Awaited<ReturnType<typeof createClient>>) {
  const anio = new Date().getFullYear();
  const { count } = await supabase
    .from("lotes_produccion")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${anio}-01-01`)
    .lt("created_at", `${anio + 1}-01-01`);

  const consecutivo = String((count ?? 0) + 1).padStart(4, "0");
  return `LOTE-${anio}-${consecutivo}`;
}

export async function crearLote(input: LoteInput) {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = loteSchema.parse(input);
  const supabase = await createClient();

  const folio = await generarFolioLote(supabase);

  const { data: lote, error } = await supabase
    .from("lotes_produccion")
    .insert({
      folio,
      pedido_id: datos.pedidoId || null,
      modelo_id: datos.modeloId,
      talla_id: datos.tallaId,
      variante_id: datos.varianteId || null,
      cantidad_planeada: datos.cantidadPlaneada,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin_estimada: datos.fechaFinEstimada || null,
      creado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/produccion");
  return lote.id as string;
}

export async function agregarEtapaLote(input: AgregarEtapaLoteInput) {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = agregarEtapaLoteSchema.parse(input);
  const supabase = await createClient();

  const { data: existentes } = await supabase
    .from("lote_etapas")
    .select("orden_secuencia")
    .eq("lote_id", datos.loteId)
    .order("orden_secuencia", { ascending: false })
    .limit(1);

  const siguienteOrden = (existentes?.[0]?.orden_secuencia ?? 0) + 1;

  const { error } = await supabase.from("lote_etapas").insert({
    lote_id: datos.loteId,
    etapa_id: datos.etapaId,
    orden_secuencia: siguienteOrden,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${datos.loteId}/etapas`);
  revalidatePath(`/produccion/${datos.loteId}`);
}

export async function quitarEtapaLote(loteEtapaId: string, loteId: string) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: etapa } = await supabase
    .from("lote_etapas")
    .select("cantidad_completada")
    .eq("id", loteEtapaId)
    .single();

  if (etapa && etapa.cantidad_completada > 0) {
    throw new Error("No se puede quitar una etapa que ya tiene avance registrado.");
  }

  const { error } = await supabase.from("lote_etapas").delete().eq("id", loteEtapaId);
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
