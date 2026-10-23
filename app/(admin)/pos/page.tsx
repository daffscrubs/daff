import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/supabase/auth-helpers";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { tienePermiso } from "@/lib/permisos";
import { TALLA_SIN_TALLAS } from "@/lib/inventario/etiquetas";
import { PuntoDeVenta, type VarianteVenta } from "@/components/pos/PuntoDeVenta";

export default async function PosPage() {
  const perfil = await requerirPermiso("modulo.pos");
  const supabase = await createClient();

  const [{ data: ubicaciones }, { data: sesiones }, { data: modelos }, { data: tallas }, { data: variantes }, { data: stock }, { data: clientes }] =
    await Promise.all([
      supabase.from("ubicaciones").select("id, nombre").eq("activa", true).order("orden").order("nombre"),
      supabase.from("cajas_sesiones").select("id, ubicacion_id, fecha_apertura, perfiles!cajas_sesiones_abierta_por_fkey(nombre_completo)").is("fecha_cierre", null),
      leerTodo((d, h) => supabase.from("modelos").select("id, nombre, categoria, precio_venta").eq("activo", true).order("id").range(d, h)),
      supabase.from("tallas").select("id, codigo, orden"),
      leerTodo((d, h) => supabase.from("modelo_tallas").select("modelo_id, talla_id, precio_venta, codigo_barras, sku").order("id").range(d, h)),
      leerTodo((d, h) => supabase.from("stock_productos").select("modelo_id, talla_id, ubicacion_id, cantidad_actual").order("id").range(d, h)),
      supabase.from("clientes").select("id, nombre_comercial").order("nombre_comercial"),
    ]);

  const modeloPorId = new Map((modelos ?? []).map((m) => [m.id, m]));
  const tallaPorId = new Map((tallas ?? []).map((t) => [t.id, t]));
  const existencias = new Map<string, Record<string, number>>();
  for (const s of stock ?? []) {
    const clave = `${s.modelo_id}|${s.talla_id}`;
    existencias.set(clave, { ...(existencias.get(clave) ?? {}), [s.ubicacion_id]: s.cantidad_actual });
  }

  // Una opción por cada talla de cada producto activo (cada talla tiene su precio, código y existencias).
  const catalogo: VarianteVenta[] = (variantes ?? []).flatMap((v) => {
    const modelo = modeloPorId.get(v.modelo_id);
    const talla = tallaPorId.get(v.talla_id);
    if (!modelo || !talla) return [];
    const codigoTalla = talla.codigo.trim();
    return [
      {
        modeloId: modelo.id,
        tallaId: talla.id,
        nombre: modelo.nombre,
        categoria: modelo.categoria,
        talla: codigoTalla.toUpperCase() === TALLA_SIN_TALLAS ? null : codigoTalla,
        ordenTalla: talla.orden,
        precio: v.precio_venta ?? modelo.precio_venta,
        codigoBarras: v.codigo_barras,
        sku: v.sku,
        stock: existencias.get(`${v.modelo_id}|${v.talla_id}`) ?? {},
      },
    ];
  });
  catalogo.sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.ordenTalla - b.ordenTalla);

  return (
    <PuntoDeVenta
      ubicaciones={ubicaciones ?? []}
      cajasAbiertas={(sesiones ?? []).map((s) => ({
        sesionId: s.id,
        ubicacionId: s.ubicacion_id,
        desde: s.fecha_apertura,
        abiertaPor: s.perfiles?.nombre_completo ?? "",
      }))}
      catalogo={catalogo}
      clientes={clientes ?? []}
      puedeDescuentos={tienePermiso(perfil, "pos.descuentos")}
      puedeVenderSinExistencias={tienePermiso(perfil, "pos.sin_existencias")}
      puedeAbrirCaja={tienePermiso(perfil, "modulo.caja") && tienePermiso(perfil, "caja.abrir_cerrar")}
      puedeVerCaja={tienePermiso(perfil, "modulo.caja")}
      puedeCrearProductos={tienePermiso(perfil, "modulo.inventario")}
    />
  );
}
