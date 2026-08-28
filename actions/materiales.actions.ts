"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  consumoEstimadoSchema,
  materialSchema,
  movimientoSchema,
  type ConsumoEstimadoInput,
  type MaterialInput,
  type MovimientoInput,
} from "@/lib/validaciones/materiales.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

// Los materiales con seguimiento_por_unidad=true se controlan por rollo/bolsa
// individual (unidades_material + consumo_unidad_orden, con QR); el consumo
// agregado de aquí abajo es solo para materiales por bulto. Sin este candado
// se podría escribir en consumo_material_orden por el camino viejo y desfasar
// el trigger que lo mantiene sincronizado desde las unidades.
async function requerirMaterialPorBulto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materialId: string
): Promise<AccionResultado> {
  const { data: material, error } = await supabase
    .from("materiales")
    .select("seguimiento_por_unidad")
    .eq("id", materialId)
    .single();
  if (error) return accionError(error.message);
  if (material.seguimiento_por_unidad) {
    return accionError(
      "Este material se controla por unidad (rollo/bolsa con QR) — asigna unidades específicas en vez de una cantidad agregada."
    );
  }
  return accionOk(undefined);
}

export async function crearMaterial(input: MaterialInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = materialSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("materiales").insert({
    nombre: datos.nombre,
    categoria: datos.categoria || null,
    unidad_medida: datos.unidadMedida,
    stock_minimo: datos.stockMinimo,
    costo_unitario: datos.costoUnitario ?? null,
    seguimiento_por_unidad: datos.seguimientoPorUnidad,
  });

  if (error) return accionError(error.message);
  revalidatePath("/materiales");
  return accionOk(undefined);
}

export async function actualizarCostoMaterial(
  id: string,
  costoUnitario: number,
  stockMinimo: number,
  categoria: string,
  seguimientoPorUnidad: boolean
): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  if (!seguimientoPorUnidad) {
    const { count } = await supabase
      .from("unidades_material")
      .select("id", { count: "exact", head: true })
      .eq("material_id", id);
    if (count && count > 0) {
      return accionError(
        "No se puede quitar el seguimiento por unidad: este material ya tiene unidades con código QR generadas."
      );
    }
  }

  const { error } = await supabase
    .from("materiales")
    .update({
      costo_unitario: costoUnitario,
      stock_minimo: stockMinimo,
      categoria: categoria || null,
      seguimiento_por_unidad: seguimientoPorUnidad,
    })
    .eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/materiales");
  return accionOk(undefined);
}

export async function crearMovimiento(input: MovimientoInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = movimientoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("movimientos_inventario").insert({
    material_id: datos.materialId,
    tipo: datos.tipo,
    cantidad: datos.cantidad,
    lote_id: datos.loteId || null,
    motivo: datos.motivo || null,
    registrado_por: perfil.id,
  });

  if (error) return accionError(error.message);
  revalidatePath("/materiales");
  revalidatePath(`/materiales/${datos.materialId}`);
  return accionOk(undefined);
}

export async function guardarConsumoEstimado(input: ConsumoEstimadoInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = consumoEstimadoSchema.parse(input);
  const supabase = await createClient();

  const chequeo = await requerirMaterialPorBulto(supabase, datos.materialId);
  if (!chequeo.ok) return chequeo;

  const { error } = await supabase
    .from("consumo_material_orden")
    .upsert(
      { lote_id: datos.loteId, material_id: datos.materialId, cantidad_estimada: datos.cantidadEstimada },
      { onConflict: "lote_id,material_id" }
    );

  if (error) return accionError(error.message);
  revalidatePath(`/produccion/${datos.loteId}`);
  return accionOk(undefined);
}

export async function eliminarConsumoMaterial(id: string, loteId: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: consumo, error: errorConsumo } = await supabase
    .from("consumo_material_orden")
    .select("material_id")
    .eq("id", id)
    .single();
  if (errorConsumo) return accionError(errorConsumo.message);

  const chequeo = await requerirMaterialPorBulto(supabase, consumo.material_id);
  if (!chequeo.ok) return chequeo;

  const { data, error } = await supabase
    .from("consumo_material_orden")
    .delete()
    .eq("id", id)
    .is("cantidad_real_registrada_en", null)
    .select("id");
  if (error) return accionError(error.message);
  if (!data?.length) return accionError("No se puede quitar: el consumo real de este insumo ya fue registrado.");
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}

export async function registrarConsumoReal(id: string, loteId: string, cantidadReal: number): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: consumo, error: errorConsumo } = await supabase
    .from("consumo_material_orden")
    .select("material_id")
    .eq("id", id)
    .single();
  if (errorConsumo) return accionError(errorConsumo.message);

  const chequeo = await requerirMaterialPorBulto(supabase, consumo.material_id);
  if (!chequeo.ok) return chequeo;

  const { data, error } = await supabase
    .from("consumo_material_orden")
    .update({ cantidad_real: cantidadReal, cantidad_real_registrada_en: new Date().toISOString() })
    .eq("id", id)
    .is("cantidad_real_registrada_en", null)
    .select("id");
  if (error) return accionError(error.message);
  if (!data?.length) return accionError("El consumo real de este insumo ya fue registrado y no se puede modificar.");
  revalidatePath(`/produccion/${loteId}`);
  return accionOk(undefined);
}
