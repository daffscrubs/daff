"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  compraSchema,
  gastoSchema,
  type CompraInput,
  type GastoInput,
} from "@/lib/validaciones/compras.schema";

async function sugerirFolioCompra(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Folio numérico simple y consecutivo (1, 2, 3...). Se toma el máximo folio
  // numérico existente (ignorando folios antiguos con otro formato) en vez de
  // un conteo de filas, para no repetir folio si alguna compra fue eliminada.
  const { data } = await supabase.from("compras").select("folio");
  const maxNumerico = (data ?? [])
    .map((c) => Number(c.folio))
    .filter((n) => Number.isInteger(n) && n > 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return String(maxNumerico + 1);
}

export async function crearCompra(input: CompraInput) {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = compraSchema.parse(input);
  const supabase = await createClient();

  const folio = await sugerirFolioCompra(supabase);
  const total = datos.items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      folio,
      proveedor: datos.proveedor,
      fecha: datos.fecha,
      total,
      notas: datos.notas || null,
      registrado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { error: errorItems } = await supabase.from("compra_items").insert(
    datos.items.map((item) => ({
      compra_id: compra.id,
      material_id: item.materialId,
      cantidad: item.cantidad,
      costo_unitario: item.costoUnitario,
    }))
  );

  if (errorItems) {
    await supabase.from("compras").delete().eq("id", compra.id);
    throw new Error(errorItems.message);
  }

  // Cada material comprado genera su entrada de inventario y actualiza su
  // costo unitario al precio de esta compra (costo más reciente). El
  // movimiento queda ligado a la compra (compra_id) para poder revertirlo
  // correctamente si la compra se edita o se elimina después.
  for (const item of datos.items) {
    const { error: errorMovimiento } = await supabase.from("movimientos_inventario").insert({
      material_id: item.materialId,
      tipo: "entrada",
      cantidad: item.cantidad,
      motivo: `Compra ${folio} — ${datos.proveedor}`,
      registrado_por: perfil.id,
      compra_id: compra.id,
    });
    if (errorMovimiento) throw new Error(errorMovimiento.message);

    const { error: errorCosto } = await supabase
      .from("materiales")
      .update({ costo_unitario: item.costoUnitario })
      .eq("id", item.materialId);
    if (errorCosto) throw new Error(errorCosto.message);
  }

  revalidatePath("/compras");
  revalidatePath("/materiales");
  return compra.id as string;
}

// Revierte el efecto en inventario de una compra: por cada movimiento de
// "entrada" que generó, registra una "salida" compensatoria (nunca se
// borran movimientos, para no perder el rastro de auditoría).
async function revertirMovimientosCompra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compraId: string,
  perfilId: string,
  motivo: string
) {
  const { data: movimientos, error } = await supabase
    .from("movimientos_inventario")
    .select("material_id, cantidad, tipo")
    .eq("compra_id", compraId);
  if (error) throw new Error(error.message);

  for (const m of movimientos ?? []) {
    if (m.tipo !== "entrada") continue;
    const { error: errorReversa } = await supabase.from("movimientos_inventario").insert({
      material_id: m.material_id,
      tipo: "salida",
      cantidad: m.cantidad,
      motivo,
      registrado_por: perfilId,
      compra_id: compraId,
    });
    if (errorReversa) throw new Error(errorReversa.message);
  }
}

export async function actualizarCompra(id: string, input: CompraInput) {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = compraSchema.parse(input);
  const supabase = await createClient();

  const { data: compraActual, error: errorCompra } = await supabase
    .from("compras")
    .select("folio")
    .eq("id", id)
    .single();
  if (errorCompra) throw new Error(errorCompra.message);

  await revertirMovimientosCompra(
    supabase,
    id,
    perfil.id,
    `Edición de compra ${compraActual.folio} — se reemplazan los materiales`
  );

  const total = datos.items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);

  const { error: errorUpdate } = await supabase
    .from("compras")
    .update({
      proveedor: datos.proveedor,
      fecha: datos.fecha,
      total,
      notas: datos.notas || null,
    })
    .eq("id", id);
  if (errorUpdate) throw new Error(errorUpdate.message);

  const { error: errorEliminar } = await supabase.from("compra_items").delete().eq("compra_id", id);
  if (errorEliminar) throw new Error(errorEliminar.message);

  const { error: errorItems } = await supabase.from("compra_items").insert(
    datos.items.map((item) => ({
      compra_id: id,
      material_id: item.materialId,
      cantidad: item.cantidad,
      costo_unitario: item.costoUnitario,
    }))
  );
  if (errorItems) throw new Error(errorItems.message);

  for (const item of datos.items) {
    const { error: errorMovimiento } = await supabase.from("movimientos_inventario").insert({
      material_id: item.materialId,
      tipo: "entrada",
      cantidad: item.cantidad,
      motivo: `Compra ${compraActual.folio} — ${datos.proveedor} (editada)`,
      registrado_por: perfil.id,
      compra_id: id,
    });
    if (errorMovimiento) throw new Error(errorMovimiento.message);

    const { error: errorCosto } = await supabase
      .from("materiales")
      .update({ costo_unitario: item.costoUnitario })
      .eq("id", item.materialId);
    if (errorCosto) throw new Error(errorCosto.message);
  }

  revalidatePath("/compras");
  revalidatePath("/materiales");
}

export async function eliminarCompra(id: string) {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: compra, error: errorCompra } = await supabase
    .from("compras")
    .select("folio")
    .eq("id", id)
    .single();
  if (errorCompra) throw new Error(errorCompra.message);

  await revertirMovimientosCompra(supabase, id, perfil.id, `Compra ${compra.folio} eliminada`);

  const { error } = await supabase.from("compras").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/compras");
  revalidatePath("/materiales");
}

export async function crearGasto(input: GastoInput) {
  const perfil = await requerirPerfil(["admin", "ventas"]);
  const datos = gastoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("gastos").insert({
    fecha: datos.fecha,
    categoria: datos.categoria,
    concepto: datos.concepto,
    monto: datos.monto,
    notas: datos.notas || null,
    registrado_por: perfil.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/compras/gastos");
}
