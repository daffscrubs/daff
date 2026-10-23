import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { hoyMexico, rangoDiaMexico } from "@/lib/fechas";
import { CajaPanel } from "@/components/caja/CajaPanel";

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ ubicacion?: string; fecha?: string }> }) {
  const perfil = await requerirPermiso("modulo.caja");
  const params = await searchParams;
  const supabase = await createClient();

  const { data: ubicaciones } = await supabase.from("ubicaciones").select("id, nombre").eq("activa", true).order("orden").order("nombre");
  const ubicacionId = ubicaciones?.find((u) => u.id === params.ubicacion)?.id ?? ubicaciones?.[0]?.id ?? "";
  const hoy = hoyMexico();
  const fecha = params.fecha && FECHA_VALIDA.test(params.fecha) && params.fecha <= hoy ? params.fecha : hoy;
  const { desde, hasta } = rangoDiaMexico(fecha);
  const puedeVerVentas = tienePermiso(perfil, "pos.ver_ventas");

  const [{ data: sesionAbierta }, { data: sesiones }, { data: ventas }, { data: movimientos }] = await Promise.all([
    supabase
      .from("cajas_sesiones")
      .select("id, fecha_apertura, fondo_inicial, perfiles!cajas_sesiones_abierta_por_fkey(nombre_completo)")
      .eq("ubicacion_id", ubicacionId)
      .is("fecha_cierre", null)
      .maybeSingle(),
    // Turnos abiertos ese día, y el que siga abierto aunque se haya abierto otro día.
    supabase
      .from("cajas_sesiones")
      .select("id, fecha_apertura, fecha_cierre, fondo_inicial, efectivo_esperado, efectivo_contado, notas_cierre, abierta:perfiles!cajas_sesiones_abierta_por_fkey(nombre_completo), cerro:perfiles!cajas_sesiones_cerrada_por_fkey(nombre_completo)")
      .eq("ubicacion_id", ubicacionId)
      .or(`and(fecha_apertura.gte.${desde},fecha_apertura.lt.${hasta}),fecha_cierre.is.null`)
      .order("fecha_apertura", { ascending: false }),
    supabase
      .from("ventas")
      .select("id, folio, sesion_id, created_at, total, subtotal, descuento, estatus, motivo_cancelacion, venta_pagos(metodo, monto, recibido), vendedor:perfiles!ventas_vendedor_id_fkey(nombre_completo), clientes(nombre_comercial), venta_items(cantidad)")
      .eq("ubicacion_id", ubicacionId)
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .order("created_at", { ascending: false }),
    supabase
      .from("caja_movimientos")
      .select("id, tipo, monto, concepto, created_at, perfiles!caja_movimientos_registrado_por_fkey(nombre_completo), cajas_sesiones!inner(ubicacion_id)")
      .eq("cajas_sesiones.ubicacion_id", ubicacionId)
      .gte("created_at", desde)
      .lt("created_at", hasta)
      .order("created_at", { ascending: false }),
  ]);

  // Efectivo que debe haber en el cajón ahora (lo calcula la base de datos: es la misma cuenta del cierre).
  const efectivoEsperado = sesionAbierta ? Number((await supabase.rpc("fn_efectivo_esperado", { p_sesion_id: sesionAbierta.id })).data ?? 0) : null;

  return (
    <CajaPanel
      ubicaciones={ubicaciones ?? []}
      ubicacionId={ubicacionId}
      fecha={fecha}
      hoy={hoy}
      sesionAbierta={
        sesionAbierta
          ? {
              id: sesionAbierta.id,
              desde: sesionAbierta.fecha_apertura,
              fondo: Number(sesionAbierta.fondo_inicial),
              abiertaPor: sesionAbierta.perfiles?.nombre_completo ?? "",
              efectivoEsperado: efectivoEsperado ?? 0,
            }
          : null
      }
      sesiones={(sesiones ?? []).map((s) => ({
        id: s.id,
        apertura: s.fecha_apertura,
        cierre: s.fecha_cierre,
        fondo: Number(s.fondo_inicial),
        esperado: s.efectivo_esperado === null ? null : Number(s.efectivo_esperado),
        contado: s.efectivo_contado === null ? null : Number(s.efectivo_contado),
        notas: s.notas_cierre,
        abiertaPor: s.abierta?.nombre_completo ?? "",
        cerradaPor: s.cerro?.nombre_completo ?? "",
      }))}
      ventas={(ventas ?? []).map((v) => ({
        id: v.id,
        folio: v.folio,
        sesionId: v.sesion_id,
        fecha: v.created_at,
        total: Number(v.total),
        descuento: Number(v.descuento),
        estatus: v.estatus,
        motivoCancelacion: v.motivo_cancelacion,
        vendedor: v.vendedor?.nombre_completo ?? "",
        cliente: v.clientes?.nombre_comercial ?? null,
        piezas: v.venta_items.reduce((acc, i) => acc + i.cantidad, 0),
        pagos: v.venta_pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
      }))}
      movimientos={(movimientos ?? []).map((m) => ({
        id: m.id,
        tipo: m.tipo,
        monto: Number(m.monto),
        concepto: m.concepto,
        fecha: m.created_at,
        usuario: m.perfiles?.nombre_completo ?? "",
      }))}
      permisos={{
        verVentas: puedeVerVentas,
        abrirCerrar: tienePermiso(perfil, "caja.abrir_cerrar"),
        ingresos: tienePermiso(perfil, "caja.ingresos"),
        retiros: tienePermiso(perfil, "caja.retiros"),
        cancelar: tienePermiso(perfil, "pos.cancelar"),
        vender: tienePermiso(perfil, "modulo.pos"),
      }}
    />
  );
}
