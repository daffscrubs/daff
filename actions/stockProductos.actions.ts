"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import {
  movimientoStockProductoSchema,
  type MovimientoStockProductoInput,
} from "@/lib/validaciones/stock-productos.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";

export async function crearMovimientoStockProducto(input: MovimientoStockProductoInput): Promise<AccionResultado> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const datos = movimientoStockProductoSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("movimientos_stock_producto").insert({
    modelo_id: datos.modeloId,
    talla_id: datos.tallaId,
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
