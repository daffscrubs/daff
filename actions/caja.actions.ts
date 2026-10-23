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

export interface ResultadoCorte {
  efectivo: { esperado: number; contado: number; diferencia: number };
  tarjeta: { esperado: number; contado: number | null; diferencia: number | null };
  transferencia: { esperado: number; contado: number | null; diferencia: number | null };
}

/** Cierra el turno y regresa, por método de pago, lo esperado, lo contado y la diferencia (contado - esperado: negativa = faltante). */
export async function cerrarCaja(
  sesionId: string,
  conteo: { efectivo: number; tarjeta?: number | null; transferencia?: number | null },
  notas?: string
): Promise<AccionResultado<ResultadoCorte>> {
  await requerirPerfil();
  const datos = cerrarCajaSchema.safeParse({
    sesionId,
    efectivoContado: conteo.efectivo,
    tarjetaContado: conteo.tarjeta ?? null,
    transferenciaContado: conteo.transferencia ?? null,
    notas,
  });
  if (!datos.success) return accionError(datos.error.issues[0]?.message ?? "Datos inválidos");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cerrar_caja", {
    p_sesion_id: datos.data.sesionId,
    p_efectivo_contado: datos.data.efectivoContado,
    p_notas: datos.data.notas,
    p_tarjeta_contado: datos.data.tarjetaContado ?? undefined,
    p_transferencia_contado: datos.data.transferenciaContado ?? undefined,
  });
  if (error) return accionError(error.message);

  // Lo esperado lo calcula la base al cerrar (no el navegador): se lee tal como quedó guardado en el corte.
  const { data: corte } = await supabase
    .from("cajas_sesiones")
    .select("efectivo_esperado, efectivo_contado, tarjeta_esperado, tarjeta_contado, transferencia_esperado, transferencia_contado")
    .eq("id", datos.data.sesionId)
    .single();
  revalidatePath("/caja");
  revalidatePath("/pos");
  if (!corte) return accionError("La caja se cerró, pero no se pudo leer el resultado del corte. Revisa Turnos de caja.");

  const num = (v: number | null) => (v === null ? null : Number(v));
  const metodo = (esperado: number | null, contado: number | null) => ({
    esperado: Number(esperado ?? 0),
    contado: num(contado),
    diferencia: contado === null ? null : Math.round((Number(contado) - Number(esperado ?? 0)) * 100) / 100,
  });
  const ef = metodo(corte.efectivo_esperado, corte.efectivo_contado);
  return accionOk({
    efectivo: { esperado: ef.esperado, contado: ef.contado ?? 0, diferencia: ef.diferencia ?? 0 },
    tarjeta: metodo(corte.tarjeta_esperado, corte.tarjeta_contado),
    transferencia: metodo(corte.transferencia_esperado, corte.transferencia_contado),
  });
}
