"use server";

import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";

export async function obtenerDetalleCliente(id: string) {
  await requerirPerfil(["admin", "ventas", "supervisor"]);
  const supabase = await createClient();

  const [{ data: cliente }, { data: pedidos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase
      .from("pedidos")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return { cliente, pedidos: pedidos ?? [] };
}

export async function obtenerDetalleModelo(id: string) {
  await requerirPerfil(["admin", "ventas", "supervisor"]);
  const supabase = await createClient();

  const [{ data: modelo }, { data: existencias }, { data: movimientos }, { data: tallas }, { data: tallasAsignadas }] =
    await Promise.all([
      supabase.from("modelos").select("*").eq("id", id).single(),
      supabase.from("stock_productos").select("*").eq("modelo_id", id),
      supabase
        .from("movimientos_stock_producto")
        .select("*, lotes_produccion(folio)")
        .eq("modelo_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("tallas").select("id, codigo"),
      supabase.from("modelo_tallas").select("talla_id").eq("modelo_id", id),
    ]);

  const existenciasTotal = (existencias ?? []).reduce((acc, e) => acc + e.cantidad_actual, 0);

  return {
    modelo,
    existencias: existencias ?? [],
    existenciasTotal,
    movimientos: movimientos ?? [],
    tallas: tallas ?? [],
    tallaIdsAsignadas: (tallasAsignadas ?? []).map((t) => t.talla_id),
  };
}

export async function obtenerDetalleMaterial(id: string) {
  await requerirPerfil(["admin", "ventas", "supervisor"]);
  const supabase = await createClient();

  const [{ data: material }, { data: movimientos }] = await Promise.all([
    supabase.from("materiales").select("*").eq("id", id).single(),
    supabase
      .from("movimientos_inventario")
      .select("*, lotes_produccion(folio)")
      .eq("material_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return { material, movimientos: movimientos ?? [] };
}
