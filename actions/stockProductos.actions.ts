"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  movimientoStockProductoSchema,
  traspasoStockProductoSchema,
  type MovimientoStockProductoInput,
  type TraspasoStockProductoInput,
} from "@/lib/validaciones/stock-productos.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

export async function crearMovimientoStockProducto(input: MovimientoStockProductoInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = movimientoStockProductoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("movimientos_stock_producto").insert({
    modelo_id: datos.modeloId,
    talla_id: datos.tallaId,
    ubicacion_id: datos.ubicacionId,
    tipo: datos.tipo,
    cantidad: datos.tipo === "ajuste" ? datos.cantidad : Math.abs(datos.cantidad),
    motivo: datos.motivo || null,
    registrado_por: perfil.id,
  });

  if (error) return accionError(error.message);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${datos.modeloId}`);
  return accionOk(undefined);
}

// El traspaso (salida del origen + entrada al destino) se hace en una sola
// función de base de datos para que sea atómico: o se mueven las piezas de
// las dos ubicaciones, o no se mueve nada. La propia función valida el rol y
// que el origen tenga suficientes piezas, con mensajes claros.
export async function traspasarStockProducto(input: TraspasoStockProductoInput): Promise<AccionResultado> {
  await requerirPerfil(["admin", "supervisor"]);
  const datos = traspasoStockProductoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.rpc("fn_traspasar_stock_producto", {
    p_modelo_id: datos.modeloId,
    p_talla_id: datos.tallaId,
    p_origen_id: datos.origenId,
    p_destino_id: datos.destinoId,
    p_cantidad: datos.cantidad,
    p_motivo: datos.motivo?.trim() || undefined,
  });

  if (error) return accionError(error.message);
  revalidatePath("/inventario");
  revalidatePath(`/inventario/${datos.modeloId}`);
  return accionOk(undefined);
}
