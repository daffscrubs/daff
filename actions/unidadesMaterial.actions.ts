"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  asignarUnidadAOrdenSchema,
  crearUnidadesDesdeCompraSchema,
  crearUnidadIndividualSchema,
  type AsignarUnidadAOrdenInput,
  type CrearUnidadesDesdeCompraInput,
  type CrearUnidadIndividualInput,
} from "@/lib/validaciones/unidadesMaterial.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";
import type { Database } from "@/types/database.types";

type UnidadMaterial = Database["public"]["Tables"]["unidades_material"]["Row"];
type UnidadConMaterial = UnidadMaterial & {
  materiales: { nombre: string; unidad_medida: string } | null;
};

// El código va impreso (etiqueta + QR) y es lo único que alguien lee a mano si
// el QR no escanea, así que se deriva del nombre del material + un
// consecutivo — no un UUID plano (ver el porqué del sufijo de material_id
// abajo).
function generarCodigoUnidad(materialId: string, nombreMaterial: string, numeroUnidad: number): string {
  const slug = nombreMaterial
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .slice(0, 16)
    .replace(/^-+|-+$/g, "");
  const sufijoMaterial = materialId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${slug || "MATERIAL"}-${sufijoMaterial}-${String(numeroUnidad).padStart(4, "0")}`;
}

// Red de seguridad además de la raíz corregida arriba: si de todos modos se
// llega a chocar el código (por ejemplo códigos capturados a mano en el
// futuro, o cualquier caso no previsto), esto da un mensaje claro en vez del
// error crudo de Postgres.
function esViolacionCodigoUnico(mensaje: string): boolean {
  return mensaje.includes("unidades_material_codigo_key");
}

async function siguienteNumeroUnidad(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materialId: string
): Promise<number> {
  const { data } = await supabase
    .from("unidades_material")
    .select("numero_unidad")
    .eq("material_id", materialId)
    .order("numero_unidad", { ascending: false })
    .limit(1);
  return (data?.[0]?.numero_unidad ?? 0) + 1;
}

export async function crearUnidadesDesdeCompra(
  input: CrearUnidadesDesdeCompraInput
): Promise<AccionResultado<{ idsCreados: string[] }>> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = crearUnidadesDesdeCompraSchema.parse(input);
  const supabase = await createClient();

  const { data: compraItem, error: errorItem } = await supabase
    .from("compra_items")
    .select("material_id, costo_unitario")
    .eq("id", datos.compraItemId)
    .single();
  if (errorItem) return accionError(errorItem.message);

  const { data: material, error: errorMaterial } = await supabase
    .from("materiales")
    .select("nombre, seguimiento_por_unidad")
    .eq("id", compraItem.material_id)
    .single();
  if (errorMaterial) return accionError(errorMaterial.message);
  if (!material.seguimiento_por_unidad) {
    return accionError("Este material no está configurado para seguimiento por unidad.");
  }

  let siguiente = await siguienteNumeroUnidad(supabase, compraItem.material_id);

  const filas = datos.cantidades.map((cantidad) => {
    const numeroUnidad = siguiente++;
    return {
      material_id: compraItem.material_id,
      compra_item_id: datos.compraItemId,
      numero_unidad: numeroUnidad,
      codigo: generarCodigoUnidad(compraItem.material_id, material.nombre, numeroUnidad),
      cantidad_inicial: cantidad,
      cantidad_actual: cantidad,
      costo_unitario: compraItem.costo_unitario,
      registrado_por: perfil.id,
    };
  });

  const { data, error } = await supabase.from("unidades_material").insert(filas).select("id");
  if (error) {
    if (esViolacionCodigoUnico(error.message)) {
      return accionError("No se pudo generar un código único para estas unidades. Intenta de nuevo.");
    }
    return accionError(error.message);
  }

  revalidatePath("/materiales");
  revalidatePath(`/materiales/${compraItem.material_id}`);
  return accionOk({ idsCreados: (data ?? []).map((f) => f.id as string) });
}

export async function crearUnidadIndividual(
  input: CrearUnidadIndividualInput
): Promise<AccionResultado<{ ids: string[] }>> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = crearUnidadIndividualSchema.parse(input);
  const supabase = await createClient();

  const { data: material, error: errorMaterial } = await supabase
    .from("materiales")
    .select("nombre, seguimiento_por_unidad")
    .eq("id", datos.materialId)
    .single();
  if (errorMaterial) return accionError(errorMaterial.message);
  if (!material.seguimiento_por_unidad) {
    return accionError("Este material no está configurado para seguimiento por unidad.");
  }

  let siguiente = await siguienteNumeroUnidad(supabase, datos.materialId);
  const filas = Array.from({ length: datos.cantidadDeUnidades }, () => {
    const numeroUnidad = siguiente++;
    return {
      material_id: datos.materialId,
      numero_unidad: numeroUnidad,
      codigo: generarCodigoUnidad(datos.materialId, material.nombre, numeroUnidad),
      cantidad_inicial: datos.cantidadInicial,
      cantidad_actual: datos.cantidadInicial,
      costo_unitario: datos.costoUnitario ?? null,
      proveedor: datos.proveedor || null,
      fecha_recepcion: datos.fechaRecepcion || undefined,
      registrado_por: perfil.id,
    };
  });

  const { data, error } = await supabase.from("unidades_material").insert(filas).select("id");
  if (error) {
    if (esViolacionCodigoUnico(error.message)) {
      return accionError("No se pudo generar un código único para estas unidades. Intenta de nuevo.");
    }
    return accionError(error.message);
  }

  revalidatePath("/materiales");
  revalidatePath(`/materiales/${datos.materialId}`);
  return accionOk({ ids: (data ?? []).map((f) => f.id as string) });
}

export async function buscarUnidadPorCodigo(codigo: string): Promise<AccionResultado<UnidadConMaterial>> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unidades_material")
    .select("*, materiales(nombre, unidad_medida)")
    .eq("codigo", codigo.trim())
    .maybeSingle();
  if (error) return accionError(error.message);
  if (!data) return accionError("No se encontró ninguna unidad con ese código.");
  return accionOk(data as UnidadConMaterial);
}

export async function listarUnidadesDeMaterial(materialId: string): Promise<AccionResultado<UnidadMaterial[]>> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unidades_material")
    .select("*")
    .eq("material_id", materialId)
    .order("numero_unidad");
  if (error) return accionError(error.message);
  return accionOk(data ?? []);
}

export async function asignarUnidadAOrden(input: AsignarUnidadAOrdenInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = asignarUnidadAOrdenSchema.parse(input);
  const supabase = await createClient();

  const { data: unidad, error: errorUnidad } = await supabase
    .from("unidades_material")
    .select("estatus")
    .eq("id", datos.unidadId)
    .single();
  if (errorUnidad) return accionError(errorUnidad.message);
  if (unidad.estatus !== "disponible") {
    return accionError("Esta unidad ya no está disponible (agotada o dada de baja).");
  }

  const { error } = await supabase.from("consumo_unidad_orden").insert({
    lote_id: datos.loteId,
    unidad_id: datos.unidadId,
    cantidad_estimada: datos.cantidadEstimada,
  });
  if (error) {
    if (error.message.includes("duplicate key")) {
      return accionError("Esta unidad ya está asignada a esta orden.");
    }
    return accionError(error.message);
  }

  revalidatePath(`/produccion/${datos.loteId}`);
  return accionOk(undefined);
}

// Espejo de eliminarConsumoMaterial (materiales.actions.ts) pero para una
// unidad específica: mismo candado (no se puede quitar si el consumo real ya
// se registró) y mismo mensaje. El trigger fn_descontar_unidad_material no
// revierte el descuento en un DELETE, así que sin este candado se podría
// desfasar cantidad_actual del rollo/bolsa sin forma de corregirlo.
export async function eliminarUnidadDeOrden(id: string, loteId: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consumo_unidad_orden")
    .delete()
    .eq("id", id)
    .is("cantidad_real_registrada_en", null)
    .select("id");
  if (error) return accionError(error.message);
  if (!data?.length) return accionError("No se puede quitar: el consumo real de esta unidad ya fue registrado.");
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}

export async function registrarConsumoRealUnidad(id: string, loteId: string, cantidadReal: number): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consumo_unidad_orden")
    .update({ cantidad_real: cantidadReal, cantidad_real_registrada_en: new Date().toISOString() })
    .eq("id", id)
    .is("cantidad_real_registrada_en", null)
    .select("id");
  if (error) return accionError(error.message);
  if (!data?.length) return accionError("El consumo real de esta unidad ya fue registrado y no se puede modificar.");
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}

// Corrige un error de captura (ej. cantidad_inicial mal puesta al dar de alta
// inventario inicial) antes de que la unidad se use. En cuanto se asignó a
// una orden ya no es un error de captura sino historial real de producción,
// así que se bloquea igual que el resto de "eliminar" de este módulo.
export async function eliminarUnidadMaterial(id: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: unidad, error: errorUnidad } = await supabase
    .from("unidades_material")
    .select("material_id")
    .eq("id", id)
    .single();
  if (errorUnidad) return accionError(errorUnidad.message);

  const { count, error: errorConteo } = await supabase
    .from("consumo_unidad_orden")
    .select("id", { count: "exact", head: true })
    .eq("unidad_id", id);
  if (errorConteo) return accionError(errorConteo.message);
  if (count && count > 0) {
    return accionError("No se puede eliminar: esta unidad ya fue asignada a una orden de producción.");
  }

  const { error } = await supabase.from("unidades_material").delete().eq("id", id);
  if (error) return accionError(error.message);

  revalidatePath("/materiales");
  revalidatePath(`/materiales/${unidad.material_id}`);
  return accionOk(undefined);
}
