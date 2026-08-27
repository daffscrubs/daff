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
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

// ---------- Modelos ----------
export async function crearModelo(input: ModeloInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = modeloSchema.parse(input);
  const supabase = await createClient();
  const { data: modelo, error } = await supabase
    .from("modelos")
    .insert({
      nombre: datos.nombre,
      descripcion: datos.descripcion || null,
      categoria: datos.categoria || null,
      costo_unitario: datos.costoUnitario ?? null,
      precio_venta: datos.precioVenta ?? null,
    })
    .select("id")
    .single();
  if (error) return accionError(error.message);

  if (datos.tallaIds?.length) {
    const { error: errorTallas } = await supabase
      .from("modelo_tallas")
      .insert(datos.tallaIds.map((tallaId) => ({ modelo_id: modelo.id, talla_id: tallaId })));
    if (errorTallas) return accionError(errorTallas.message);
  }

  revalidatePath("/inventario");
  return accionOk(undefined);
}

export async function actualizarCostoModelo(
  id: string,
  costoUnitario: number,
  precioVenta: number,
  categoria: string
): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("modelos")
    .update({ costo_unitario: costoUnitario, precio_venta: precioVenta, categoria: categoria || null })
    .eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${id}`);
  return accionOk(undefined);
}

export async function guardarTallasModelo(
  modeloId: string,
  tallas: { tallaId: string; precioVenta?: number }[]
): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { error: errorEliminar } = await supabase.from("modelo_tallas").delete().eq("modelo_id", modeloId);
  if (errorEliminar) return accionError(errorEliminar.message);

  if (tallas.length) {
    const { error: errorInsertar } = await supabase.from("modelo_tallas").insert(
      tallas.map((t) => ({
        modelo_id: modeloId,
        talla_id: t.tallaId,
        precio_venta: t.precioVenta ?? null,
      }))
    );
    if (errorInsertar) return accionError(errorInsertar.message);
  }

  revalidatePath("/inventario");
  revalidatePath(`/inventario/${modeloId}`);
  return accionOk(undefined);
}

export async function eliminarModelo(id: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  // Tallas, precios por talla, stock y su historial de movimientos son datos
  // propios de este producto (nada más los referencia), así que se eliminan
  // junto con él. Pedidos y órdenes de producción reales SÍ lo bloquean —
  // borrarlos ahí destruiría historial de ventas/producción del negocio.
  await supabase.from("plantilla_items").delete().eq("modelo_id", id);
  await supabase.from("movimientos_stock_producto").delete().eq("modelo_id", id);
  await supabase.from("stock_productos").delete().eq("modelo_id", id);

  const { error } = await supabase.from("modelos").delete().eq("id", id);
  if (error) return accionError("No se puede eliminar: el producto tiene pedidos u órdenes de producción reales asociadas.");
  revalidatePath("/inventario");
  return accionOk(undefined);
}

// ---------- Tallas ----------
export async function crearTalla(input: TallaInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = tallaSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("tallas").insert(datos);
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/tallas");
  return accionOk(undefined);
}

export async function eliminarTalla(id: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.from("tallas").delete().eq("id", id);
  if (error) return accionError("No se puede eliminar: la talla ya está en uso.");
  revalidatePath("/catalogos/tallas");
  return accionOk(undefined);
}

// ---------- Etapas de proceso ----------
export async function crearEtapa(input: EtapaInput): Promise<AccionResultado> {
  await requerirPerfil(["admin"]);
  const datos = etapaSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("etapas_proceso").insert({
    nombre: datos.nombre,
    descripcion: datos.descripcion || null,
  });
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/etapas-proceso");
  return accionOk(undefined);
}

export async function alternarEtapaActiva(id: string, activo: boolean): Promise<AccionResultado> {
  await requerirPerfil(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("etapas_proceso").update({ activo }).eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/etapas-proceso");
  return accionOk(undefined);
}

// ---------- Plantillas de pedido ----------
export async function crearPlantilla(input: PlantillaInput): Promise<AccionResultado<string>> {
  await requerirPerfil(["admin", "ventas"]);
  const datos = plantillaSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plantillas_pedido")
    .insert({ nombre: datos.nombre, cliente_id: datos.clienteId ?? null })
    .select("id")
    .single();
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/plantillas");
  return accionOk(data.id as string);
}

export async function eliminarPlantilla(id: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();
  const { error } = await supabase.from("plantillas_pedido").delete().eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/plantillas");
  return accionOk(undefined);
}

export async function agregarPlantillaItem(input: PlantillaItemInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const datos = plantillaItemSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("plantilla_items").insert({
    plantilla_id: datos.plantillaId,
    modelo_id: datos.modeloId,
    talla_id: datos.tallaId,
    cantidad_sugerida: datos.cantidadSugerida ?? null,
  });
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/plantillas");
  return accionOk(undefined);
}

export async function eliminarPlantillaItem(id: string): Promise<AccionResultado> {
  await requerirPerfil(["admin", "ventas"]);
  const supabase = await createClient();
  const { error } = await supabase.from("plantilla_items").delete().eq("id", id);
  if (error) return accionError(error.message);
  revalidatePath("/catalogos/plantillas");
  return accionOk(undefined);
}
