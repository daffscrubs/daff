"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { abrirCajaSchema, cerrarCajaSchema, movimientoCajaSchema } from "@/lib/validaciones/ventas.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

// Igual que en ventas: los permisos y las reglas (una sola caja abierta por ubicación, no retirar más
// efectivo del que hay, no operar una caja cerrada) las impone la base de datos; aquí se revisa la forma.
export async function abrirCaja(ubicacionId: string, fondoInicial: number): Promise<AccionResultado<{ id: string }>> {
  await requerirPerfil();
  const datos = abrirCajaSchema.safeParse({ ubicacionId, fondoInicial });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_abrir_caja", { p_ubicacion_id: datos.data.ubicacionId, p_fondo_inicial: datos.data.fondoInicial });
  if (error || !data) return accionError(error?.message ?? "No se pudo abrir la caja");

  revalidatePath("/caja");
  revalidatePath("/pos");
  return accionOk({ id: data });
}

export async function registrarMovimientoCaja(
  sesionId: string,
  tipo: "ingreso" | "retiro",
  monto: number,
  concepto: string
): Promise<AccionResultado> {
  await requerirPerfil();
  const datos = movimientoCajaSchema.safeParse({ sesionId, tipo, monto, concepto });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_registrar_movimiento_caja", {
    p_sesion_id: datos.data.sesionId,
    p_tipo: datos.data.tipo,
    p_monto: datos.data.monto,
    p_concepto: datos.data.concepto,
  });
  if (error) return accionError(error.message);

  revalidatePath("/caja");
  return accionOk(undefined);
}

/** Cierra el turno; regresa la diferencia (contado - esperado): negativa = faltante, positiva = sobrante. */
export async function cerrarCaja(sesionId: string, efectivoContado: number, notas?: string): Promise<AccionResultado<{ diferencia: number }>> {
  await requerirPerfil();
  const datos = cerrarCajaSchema.safeParse({ sesionId, efectivoContado, notas });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cerrar_caja", {
    p_sesion_id: datos.data.sesionId,
    p_efectivo_contado: datos.data.efectivoContado,
    p_notas: datos.data.notas,
  });
  if (error || data === null) return accionError(error?.message ?? "No se pudo cerrar la caja");

  revalidatePath("/caja");
  revalidatePath("/pos");
  return accionOk({ diferencia: Number(data) });
}
