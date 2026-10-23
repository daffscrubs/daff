"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { cancelarVentaSchema, registrarVentaSchema, type RegistrarVentaInput } from "@/lib/validaciones/ventas.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

// La validación de fondo (permisos, caja abierta, existencias, que los pagos sumen el total, precios
// tomados de la base) vive en fn_registrar_venta: ahí es una sola transacción. Aquí solo se revisa la
// forma de los datos y se pasa el mensaje de la base tal cual, que ya está escrito para el usuario.
export async function registrarVenta(input: RegistrarVentaInput): Promise<AccionResultado<{ id: string; folio: string }>> {
  await requerirPerfil();
  const datos = registrarVentaSchema.safeParse(input);
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos de la venta inválidos");
  const v = datos.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("fn_registrar_venta", {
    p_ubicacion_id: v.ubicacionId,
    p_cliente_id: v.clienteId,
    p_items: v.items.map((i) =>
      "manual" in i
        ? { manual: true, nombre: i.nombre, cantidad: i.cantidad, unidad: i.unidad, precio: i.precio, costo: i.costo ?? null, iva: i.iva, ieps: i.ieps }
        : { modelo_id: i.modeloId, talla_id: i.tallaId, cantidad: i.cantidad }
    ),
    p_pagos: v.pagos.map((p) => ({ metodo: p.metodo, monto: p.monto, recibido: p.recibido ?? null, referencia: p.referencia ?? null })),
    p_descuento: v.descuento,
    p_notas: v.notas,
  });
  if (error || !id) return accionError(error?.message ?? "No se pudo registrar la venta");

  const { data: venta } = await supabase.from("ventas").select("folio").eq("id", id).single();
  revalidatePath("/pos");
  revalidatePath("/caja");
  revalidatePath("/inventario");
  return accionOk({ id, folio: venta?.folio ?? "" });
}

export async function cancelarVenta(ventaId: string, motivo: string): Promise<AccionResultado> {
  await requerirPerfil();
  const datos = cancelarVentaSchema.safeParse({ ventaId, motivo });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cancelar_venta", { p_venta_id: datos.data.ventaId, p_motivo: datos.data.motivo });
  if (error) return accionError(error.message);

  revalidatePath("/pos");
  revalidatePath("/caja");
  revalidatePath("/inventario");
  return accionOk(undefined);
}
