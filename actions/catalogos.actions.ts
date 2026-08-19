"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  etapaSchema,
  modeloSchema,
  plantillaItemSchema,
  plantillaSchema,
  tallaSchema,
  type EtapaInput,
  type ModeloInput,
  type PlantillaInput,
  type PlantillaItemInput,
  type TallaInput,
} from "@/lib/validaciones/catalogos.schema";

// ---------- Modelos ----------
export async function crearModelo(input: ModeloInput) {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = modeloSchema.parse(input);
  const supabase = await createClient();
  const { data: modelo, error } = await supabase
    .from("modelos")
    .insert({
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
      costo_unitario: datos.costoUnitario ?? null,
      precio_venta: datos.precioVenta ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (datos.tallaIds?.length) {
    const { error: errorTallas } = await supabase
      .from("modelo_tallas")
      .insert(datos.tallaIds.map((tallaId) => ({ modelo_id: modelo.id, talla_id: tallaId })));
    if (errorTallas) throw new Error(errorTallas.message);
  }

  revalidatePath("/catalogos/modelos");
}

export async function actualizarCostoModelo(id: string, costoUnitario: number, precioVenta: number) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("modelos")
    .update({ costo_unitario: costoUnitario, precio_venta: precioVenta })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/modelos");
}

export async function guardarTallasModelo(modeloId: string, tallaIds: string[]) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error: errorEliminar } = await supabase.from("modelo_tallas").delete().eq("modelo_id", modeloId);
  if (errorEliminar) throw new Error(errorEliminar.message);

  if (tallaIds.length) {
    const { error: errorInsertar } = await supabase
      .from("modelo_tallas")
      .insert(tallaIds.map((tallaId) => ({ modelo_id: modeloId, talla_id: tallaId })));
    if (errorInsertar) throw new Error(errorInsertar.message);
  }

  revalidatePath("/catalogos/modelos");
}

export async function alternarModeloActivo(id: string, activo: boolean) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("modelos").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/modelos");
}

// ---------- Tallas ----------
export async function crearTalla(input: TallaInput) {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = tallaSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("tallas").insert(datos);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/tallas");
}

export async function eliminarTalla(id: string) {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("tallas").delete().eq("id", id);
  if (error) throw new Error("No se puede eliminar: la talla ya está en uso.");
  revalidatePath("/catalogos/tallas");
}

// ---------- Etapas de proceso ----------
export async function crearEtapa(input: EtapaInput) {
  await requerirPerfil(["admin"]);
  const datos = etapaSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("etapas_proceso").insert({
    nombre: datos.nombre,
    descripcion: datos.descripcion || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/etapas-proceso");
}

export async function alternarEtapaActiva(id: string, activo: boolean) {
  await requerirPerfil(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("etapas_proceso").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/etapas-proceso");
}

// ---------- Plantillas de pedido ----------
export async function crearPlantilla(input: PlantillaInput) {
  await requerirPerfil(["admin", "ventas"]);
  const datos = plantillaSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plantillas_pedido")
    .insert({ nombre: datos.nombre, cliente_id: datos.clienteId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/plantillas");
  return data.id as string;
}

export async function eliminarPlantilla(id: string) {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();
  const { error } = await supabase.from("plantillas_pedido").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/plantillas");
}

export async function agregarPlantillaItem(input: PlantillaItemInput) {
  await requerirPerfil(["admin", "ventas"]);
  const datos = plantillaItemSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("plantilla_items").insert({
    plantilla_id: datos.plantillaId,
    modelo_id: datos.modeloId,
    talla_id: datos.tallaId,
    cantidad_sugerida: datos.cantidadSugerida ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/plantillas");
}

export async function eliminarPlantillaItem(id: string) {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();
  const { error } = await supabase.from("plantilla_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogos/plantillas");
}
