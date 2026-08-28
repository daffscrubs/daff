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
      supabase.from("modelo_tallas").select("talla_id, precio_venta").eq("modelo_id", id),
    ]);

  const existenciasTotal = (existencias ?? []).reduce((acc, e) => acc + e.cantidad_actual, 0);

  return {
    modelo,
    existencias: existencias ?? [],
    existenciasTotal,
    movimientos: movimientos ?? [],
    tallas: tallas ?? [],
    tallaIdsAsignadas: (tallasAsignadas ?? []).map((t) => t.talla_id),
    preciosPorTalla: Object.fromEntries(
      (tallasAsignadas ?? []).map((t) => [t.talla_id, t.precio_venta])
    ) as Record<string, number | null>,
  };
}

export async function obtenerDetalleMaterial(id: string) {
  await requerirPerfil(["admin", "ventas", "supervisor"]);
  const supabase = await createClient();

  const [{ data: material }, { data: movimientos }, { data: unidades }] = await Promise.all([
    supabase.from("materiales").select("*").eq("id", id).single(),
    supabase
      .from("movimientos_inventario")
      .select("*, lotes_produccion(folio)")
      .eq("material_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("unidades_material").select("cantidad_actual, estatus").eq("material_id", id),
  ]);

  // Un material por unidad nunca recibe movimientos_inventario -- su
  // stock_actual queda congelado en 0. El stock real es la suma de sus
  // unidades no dadas de baja (mismo criterio que obtenerDetalleModelo usa
  // para existenciasTotal de productos terminados).
  const stockPorUnidades = (unidades ?? [])
    .filter((u) => u.estatus !== "de_baja")
    .reduce((acc, u) => acc + u.cantidad_actual, 0);

  return { material, movimientos: movimientos ?? [], stockPorUnidades };
}
