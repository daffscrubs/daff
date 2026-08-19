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

export async function crearMaterial(input: MaterialInput) {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = materialSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("materiales").insert({
    nombre: datos.nombre,
    categoria: datos.categoria || null,
    unidad_medida: datos.unidadMedida,
    stock_minimo: datos.stockMinimo,
    costo_unitario: datos.costoUnitario ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/materiales");
}

export async function actualizarCostoMaterial(id: string, costoUnitario: number, stockMinimo: number) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("materiales")
    .update({ costo_unitario: costoUnitario, stock_minimo: stockMinimo })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/materiales");
}

export async function crearMovimiento(input: MovimientoInput) {
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

  if (error) throw new Error(error.message);
  revalidatePath("/materiales");
  revalidatePath(`/materiales/${datos.materialId}`);
}

export async function guardarConsumoEstimado(input: ConsumoEstimadoInput) {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = consumoEstimadoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase
    .from("consumo_material_orden")
    .upsert(
      { lote_id: datos.loteId, material_id: datos.materialId, cantidad_estimada: datos.cantidadEstimada },
      { onConflict: "lote_id,material_id" }
    );

  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${datos.loteId}`);
}

export async function eliminarConsumoMaterial(id: string, loteId: string) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("consumo_material_orden").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${loteId}`);
}

export async function registrarConsumoReal(id: string, loteId: string, cantidadReal: number) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("consumo_material_orden").update({ cantidad_real: cantidadReal }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/produccion/${loteId}`);
}
