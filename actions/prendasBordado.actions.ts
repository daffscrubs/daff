"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  crearPrendaBordadoSchema,
  type CrearPrendaBordadoInput,
} from "@/lib/validaciones/prendasBordado.schema";
import { ESTATUS_PRENDA_BORDADO_LABEL } from "@/lib/labels";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";
import type { Database, EstatusPrendaBordado } from "@/types/database.types";

type PrendaBordado = Database["public"]["Tables"]["prendas_bordado"]["Row"];
type DetalleBordado = Database["public"]["Tables"]["detalles_bordado"]["Row"];

export interface PrendaBordadoConDetalles {
  prenda: PrendaBordado;
  detalles: DetalleBordado[];
}

// Folio numérico consecutivo con prefijo (BRD-000001, BRD-000002...). Se
// toma el máximo folio existente (no un conteo de filas) para no repetir
// folio si alguna prenda fue eliminada -- mismo criterio que ya usa
// sugerirFolioCompra en compras.actions.ts.
async function siguienteFolioPrenda(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("prendas_bordado").select("folio");
  const maxNumerico = (data ?? [])
    .map((p) => Number(p.folio.replace(/^BRD-/, "")))
    .filter((n) => Number.isInteger(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return `BRD-${String(maxNumerico + 1).padStart(6, "0")}`;
}

export async function crearPrendaBordado(
  input: CrearPrendaBordadoInput
): Promise<AccionResultado<{ id: string; folio: string }>> {
  const perfil = await requerirPerfil();
  const datos = crearPrendaBordadoSchema.parse(input);
  const supabase = await createClient();

  const folio = await siguienteFolioPrenda(supabase);

  const { data: prenda, error } = await supabase
    .from("prendas_bordado")
    .insert({
      folio,
      descripcion: datos.descripcion,
      cliente_nombre: datos.clienteNombre,
      cliente_telefono: datos.clienteTelefono || null,
      fecha_entrega_compromiso: datos.fechaEntregaCompromiso,
      recibida_por: perfil.id,
    })
    .select("id, folio")
    .single();
  if (error) return accionError(error.message);

  const { error: errorDetalles } = await supabase.from("detalles_bordado").insert(
    datos.detalles.map((d) => ({
      prenda_id: prenda.id,
      ubicacion: d.ubicacion,
      tipo: d.tipo,
      descripcion: d.descripcion,
    }))
  );
  if (errorDetalles) {
    // Sin sus bordados la prenda no sirve de nada -- se quita el folio
    // "fantasma" en vez de dejar una prenda a medias.
    await supabase.from("prendas_bordado").delete().eq("id", prenda.id);
    return accionError(errorDetalles.message);
  }

  revalidatePath("/bordados");
  return accionOk({ id: prenda.id as string, folio: prenda.folio as string });
}

export async function obtenerPrendaPorFolio(folio: string): Promise<AccionResultado<PrendaBordadoConDetalles>> {
  await requerirPerfil();
  const supabase = await createClient();

  const { data: prenda, error } = await supabase
    .from("prendas_bordado")
    .select("*")
    .eq("folio", folio.trim().toUpperCase())
    .maybeSingle();
  if (error) return accionError(error.message);
  if (!prenda) return accionError("No se encontró ninguna prenda con ese folio.");

  const { data: detalles, error: errorDetalles } = await supabase
    .from("detalles_bordado")
    .select("*")
    .eq("prenda_id", prenda.id)
    .order("created_at");
  if (errorDetalles) return accionError(errorDetalles.message);

  return accionOk({ prenda, detalles: detalles ?? [] });
}

// Cada transición (recibida -> recogida -> bordada -> regresada) solo es
// válida desde el estatus inmediato anterior. Se checa primero para dar un
// mensaje claro de cuál es el problema, y el UPDATE lleva el mismo filtro de
// estatus como candado atómico contra dos personas marcando la misma prenda
// al mismo tiempo (mismo patrón que ya usan eliminarConsumoMaterial/
// registrarConsumoReal con cantidad_real_registrada_en).
async function transicionarEstatusPrenda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  estatusRequerido: EstatusPrendaBordado,
  estatusNuevo: EstatusPrendaBordado,
  camposAdicionales: Record<string, string>
): Promise<AccionResultado> {
  const { data: prenda, error: errorPrenda } = await supabase
    .from("prendas_bordado")
    .select("estatus")
    .eq("id", id)
    .single();
  if (errorPrenda) return accionError(errorPrenda.message);

  if (prenda.estatus !== estatusRequerido) {
    return accionError(
      `Esta prenda está "${ESTATUS_PRENDA_BORDADO_LABEL[prenda.estatus]}" — no se puede marcar como "${ESTATUS_PRENDA_BORDADO_LABEL[estatusNuevo]}" desde ahí.`
    );
  }

  const { data, error } = await supabase
    .from("prendas_bordado")
    .update({ estatus: estatusNuevo, ...camposAdicionales })
    .eq("id", id)
    .eq("estatus", estatusRequerido)
    .select("id");
  if (error) return accionError(error.message);
  if (!data?.length) {
    return accionError(
      `Esta prenda ya no está "${ESTATUS_PRENDA_BORDADO_LABEL[estatusRequerido]}" — alguien más la marcó antes.`
    );
  }

  revalidatePath("/bordados");
  revalidatePath(`/bordados/${id}`);
  return accionOk(undefined);
}

export async function marcarRecogida(id: string): Promise<AccionResultado> {
  const perfil = await requerirPerfil();
  const supabase = await createClient();
  return transicionarEstatusPrenda(supabase, id, "recibida_en_tienda", "recogida_para_bordar", {
    recogida_por: perfil.id,
    fecha_recogida: new Date().toISOString(),
  });
}

export async function marcarBordada(id: string): Promise<AccionResultado> {
  const perfil = await requerirPerfil();
  const supabase = await createClient();
  return transicionarEstatusPrenda(supabase, id, "recogida_para_bordar", "bordada", {
    bordada_por: perfil.id,
    fecha_bordada: new Date().toISOString(),
  });
}

export async function marcarRegresada(id: string): Promise<AccionResultado> {
  const perfil = await requerirPerfil();
  const supabase = await createClient();
  return transicionarEstatusPrenda(supabase, id, "bordada", "regresada_a_tienda", {
    regresada_por: perfil.id,
    fecha_regresada: new Date().toISOString(),
  });
}
