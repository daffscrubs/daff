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
  // costo unitario al precio de esta compra (costo más reciente).
  for (const item of datos.items) {
    const { error: errorMovimiento } = await supabase.from("movimientos_inventario").insert({
      material_id: item.materialId,
      tipo: "entrada",
      cantidad: item.cantidad,
      motivo: `Compra ${folio} — ${datos.proveedor}`,
      registrado_por: perfil.id,
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
