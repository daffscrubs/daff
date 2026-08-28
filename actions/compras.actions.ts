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
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

export interface ItemCompraConSeguimiento {
  compraItemId: string;
  materialId: string;
  materialNombre: string;
  cantidadComprada: number;
  mideCantidadPorUnidad: boolean;
}

// compra_items no tiene "on delete cascade" hacia unidades_material (a
// propósito: perder la trazabilidad de qué compra originó un rollo/bolsa con
// QR ya generado sería peor que bloquear la edición). Editar o eliminar una
// compra borra/reemplaza sus compra_items, así que si alguno ya tiene
// unidades generadas, Postgres rechazaría el DELETE con un error crudo de
// llave foránea — se revisa antes y se avisa con claridad.
async function requerirCompraSinUnidadesGeneradas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compraId: string
): Promise<AccionResultado> {
  const { data: items } = await supabase.from("compra_items").select("id").eq("compra_id", compraId);
  const itemIds = (items ?? []).map((i) => i.id);
  if (!itemIds.length) return accionOk(undefined);

  const { count, error } = await supabase
    .from("unidades_material")
    .select("id", { count: "exact", head: true })
    .in("compra_item_id", itemIds);
  if (error) return accionError(error.message);
  if (count && count > 0) {
    return accionError(
      "No se puede modificar esta compra: ya se generaron unidades con código QR para uno de sus materiales."
    );
  }
  return accionOk(undefined);
}

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

export async function crearCompra(
  input: CompraInput
): Promise<AccionResultado<{ id: string; itemsParaDividir: ItemCompraConSeguimiento[] }>> {
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

  if (error) return accionError(error.message);

  const { data: itemsCreados, error: errorItems } = await supabase
    .from("compra_items")
    .insert(
      datos.items.map((item) => ({
        compra_id: compra.id,
        material_id: item.materialId,
        cantidad: item.cantidad,
        costo_unitario: item.costoUnitario,
      }))
    )
    .select("id, material_id, cantidad");

  if (errorItems) {
    await supabase.from("compras").delete().eq("id", compra.id);
    return accionError(errorItems.message);
  }

  // Cada material comprado genera su entrada de inventario y actualiza su
  // costo unitario al precio de esta compra (costo más reciente). El
  // movimiento queda ligado a la compra (compra_id) para poder revertirlo
  // correctamente si la compra se edita o se elimina después.
  //
  // Los movimientos se mandan en un solo insert de varias filas (antes era
  // una llamada a la base por cada material de la compra) — el trigger
  // fn_aplicar_movimiento_inventario sigue disparándose una vez por fila
  // igual que antes, solo cambia que viajan juntas en un round-trip en vez
  // de uno por material. El costo_unitario sí se deja secuencial: cada
  // material lleva un valor distinto y agruparlo en paralelo cambiaría en
  // qué punto se detiene el proceso si un material falla a medio camino.
  if (datos.items.length) {
    const { error: errorMovimientos } = await supabase.from("movimientos_inventario").insert(
      datos.items.map((item) => ({
        material_id: item.materialId,
        tipo: "entrada" as const,
        cantidad: item.cantidad,
        motivo: `Compra ${folio} — ${datos.proveedor}`,
        registrado_por: perfil.id,
        compra_id: compra.id,
      }))
    );
    if (errorMovimientos) return accionError(errorMovimientos.message);
  }

  for (const item of datos.items) {
    const { error: errorCosto } = await supabase
      .from("materiales")
      .update({ costo_unitario: item.costoUnitario })
      .eq("id", item.materialId);
    if (errorCosto) return accionError(errorCosto.message);
  }

  // De los materiales recién comprados, cuáles se controlan por unidad —
  // para que el formulario pueda ofrecer "Dividir en unidades" justo
  // después de guardar, sin que el cliente tenga que adivinarlo.
  const materialIds = [...new Set((itemsCreados ?? []).map((i) => i.material_id))];
  const { data: materialesConSeguimiento } = materialIds.length
    ? await supabase
        .from("materiales")
        .select("id, nombre, mide_cantidad_por_unidad")
        .in("id", materialIds)
        .eq("seguimiento_por_unidad", true)
    : { data: [] };

  const datosPorMaterial = new Map(
    (materialesConSeguimiento ?? []).map((m) => [m.id, { nombre: m.nombre, mideCantidad: m.mide_cantidad_por_unidad }])
  );
  const itemsParaDividir: ItemCompraConSeguimiento[] = (itemsCreados ?? [])
    .filter((i) => datosPorMaterial.has(i.material_id))
    .map((i) => ({
      compraItemId: i.id as string,
      materialId: i.material_id as string,
      materialNombre: datosPorMaterial.get(i.material_id)!.nombre,
      cantidadComprada: i.cantidad as number,
      mideCantidadPorUnidad: datosPorMaterial.get(i.material_id)!.mideCantidad,
    }));

  revalidatePath("/compras");
  revalidatePath("/materiales");
  return accionOk({ id: compra.id as string, itemsParaDividir });
}

// Revierte el efecto en inventario de una compra: registra una "salida"
// compensatoria por el NETO de entradas menos salidas ya ligadas a esta
// compra (nunca se borran movimientos, para no perder el rastro de
// auditoría). El neto —no solo la última entrada— importa porque una
// compra puede haberse editado más de una vez: si solo revirtiéramos la
// entrada más reciente, las reversiones de ediciones anteriores (que
// también quedan ligadas a compra_id) se contarían de más.
async function revertirMovimientosCompra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compraId: string,
  perfilId: string,
  motivo: string
): Promise<AccionResultado> {
  const { data: movimientos, error } = await supabase
    .from("movimientos_inventario")
    .select("material_id, cantidad, tipo")
    .eq("compra_id", compraId);
  if (error) return accionError(error.message);

  const netoPorMaterial = new Map<string, number>();
  for (const m of movimientos ?? []) {
    const signo = m.tipo === "entrada" ? 1 : m.tipo === "salida" ? -1 : 0;
    if (!signo) continue;
    netoPorMaterial.set(m.material_id, (netoPorMaterial.get(m.material_id) ?? 0) + signo * m.cantidad);
  }

  const filasReversa = [...netoPorMaterial]
    .filter(([, neto]) => neto > 0)
    .map(([materialId, neto]) => ({
      material_id: materialId,
      tipo: "salida" as const,
      cantidad: neto,
      motivo,
      registrado_por: perfilId,
      compra_id: compraId,
    }));

  if (filasReversa.length) {
    const { error: errorReversa } = await supabase.from("movimientos_inventario").insert(filasReversa);
    if (errorReversa) return accionError(errorReversa.message);
  }

  return accionOk(undefined);
}

export async function actualizarCompra(id: string, input: CompraInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = compraSchema.parse(input);
  const supabase = await createClient();

  const { data: compraActual, error: errorCompra } = await supabase
    .from("compras")
    .select("folio")
    .eq("id", id)
    .single();
  if (errorCompra) return accionError(errorCompra.message);

  const sinUnidades = await requerirCompraSinUnidadesGeneradas(supabase, id);
  if (!sinUnidades.ok) return sinUnidades;

  const reversion = await revertirMovimientosCompra(
    supabase,
    id,
    perfil.id,
    `Edición de compra ${compraActual.folio} — se reemplazan los materiales`
  );
  if (!reversion.ok) return reversion;

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
  if (errorUpdate) return accionError(errorUpdate.message);

  const { error: errorEliminar } = await supabase.from("compra_items").delete().eq("compra_id", id);
  if (errorEliminar) return accionError(errorEliminar.message);

  const { error: errorItems } = await supabase.from("compra_items").insert(
    datos.items.map((item) => ({
      compra_id: id,
      material_id: item.materialId,
      cantidad: item.cantidad,
      costo_unitario: item.costoUnitario,
    }))
  );
  if (errorItems) return accionError(errorItems.message);

  if (datos.items.length) {
    const { error: errorMovimientos } = await supabase.from("movimientos_inventario").insert(
      datos.items.map((item) => ({
        material_id: item.materialId,
        tipo: "entrada" as const,
        cantidad: item.cantidad,
        motivo: `Compra ${compraActual.folio} — ${datos.proveedor} (editada)`,
        registrado_por: perfil.id,
        compra_id: id,
      }))
    );
    if (errorMovimientos) return accionError(errorMovimientos.message);
  }

  for (const item of datos.items) {
    const { error: errorCosto } = await supabase
      .from("materiales")
      .update({ costo_unitario: item.costoUnitario })
      .eq("id", item.materialId);
    if (errorCosto) return accionError(errorCosto.message);
  }

  revalidatePath("/compras");
  revalidatePath("/materiales");
  return accionOk(undefined);
}

export async function eliminarCompra(id: string): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();

  const { data: compra, error: errorCompra } = await supabase
    .from("compras")
    .select("folio")
    .eq("id", id)
    .single();
  if (errorCompra) return accionError(errorCompra.message);

  const sinUnidades = await requerirCompraSinUnidadesGeneradas(supabase, id);
  if (!sinUnidades.ok) return sinUnidades;

  const reversion = await revertirMovimientosCompra(supabase, id, perfil.id, `Compra ${compra.folio} eliminada`);
  if (!reversion.ok) return reversion;

  const { error } = await supabase.from("compras").delete().eq("id", id);
  if (error) return accionError(error.message);

  revalidatePath("/compras");
  revalidatePath("/materiales");
  return accionOk(undefined);
}

export async function crearGasto(input: GastoInput): Promise<AccionResultado> {
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

  if (error) return accionError(error.message);
  revalidatePath("/compras/gastos");
  return accionOk(undefined);
}
