import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { IncidenciasLote } from "@/components/produccion/IncidenciasLote";
import { NotasOrden } from "@/components/produccion/NotasOrden";
import { InsumosOrden } from "@/components/produccion/InsumosOrden";
import { UnidadesOrden } from "@/components/produccion/UnidadesOrden";
import { HistorialOrden } from "@/components/produccion/HistorialOrden";
import { BotonCancelarOrden } from "@/components/produccion/BotonCancelarOrden";
import { ResumenEntregas } from "@/components/produccion/ResumenEntregas";
import { RegistrarEntregaDialog } from "@/components/produccion/RegistrarEntregaDialog";
import { HistorialEntregas, type PagoEntrega } from "@/components/produccion/HistorialEntregas";
import { CierreOrden } from "@/components/produccion/CierreOrden";
import { construirHistorialOrden } from "@/lib/produccion/historial";
import { resumenPorItem, totalesResumen, type EntregaConItems } from "@/lib/produccion/entregas";
import { formatearMoneda } from "@/lib/dinero";
import { hoyMexico } from "@/lib/fechas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_ORDEN } from "@/lib/estatus-colores";

export default async function LoteDetallePage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId } = await params;
  const perfil = await requerirPerfil(["admin", "supervisor", "ventas"]);
  const supabase = await createClient();
  const puedeVerPagos = tienePermiso(perfil, "produccion.pagos_maquila");

  const [
    { data: lote },
    { data: items },
    { data: entregasProd },
    { data: perfiles },
    { data: incidencias },
    { data: modelos },
    { data: tallas },
    { data: consumos },
    { data: materiales },
    { data: consumosUnidad },
  ] = await Promise.all([
    supabase.from("lotes_produccion").select("*, ubicaciones(nombre), maquileros(nombre)").eq("id", loteId).single(),
    supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
    supabase
      .from("entregas_produccion")
      .select("*, entrega_produccion_items(item_orden_id, cantidad)")
      .eq("lote_id", loteId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("perfiles").select("id, nombre_completo, rol, activo"),
    supabase.from("incidencias_produccion").select("*").eq("lote_id", loteId).order("created_at", { ascending: false }),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo, orden"),
    supabase.from("consumo_material_orden").select("*").eq("lote_id", loteId),
    supabase.from("materiales").select("*"),
    supabase
      .from("consumo_unidad_orden")
      .select(
        "*, unidades_material(material_id, codigo, cantidad_actual, materiales(nombre, unidad_medida, mide_cantidad_por_unidad))"
      )
      .eq("lote_id", loteId),
  ]);

  if (!lote) notFound();

  const entregas = (entregasProd ?? []) as EntregaConItems[];

  // Pagos y precios: son montos, solo los ve quien tiene el permiso (la base de datos también lo exige).
  const [{ data: pagosData }, { data: preciosData }] = puedeVerPagos
    ? await Promise.all([
        entregas.length
          ? supabase.from("pagos_maquila").select("entrega_id, monto, estatus, fecha_programada, fecha_pago_real").in("entrega_id", entregas.map((e) => e.id))
          : Promise.resolve({ data: [] }),
        supabase.from("precios_maquila_orden").select("modelo_id, precio_por_pieza").eq("lote_id", loteId),
      ])
    : [{ data: null }, { data: null }];

  const pedidoAlCliente = lote.pedido_id
    ? (await supabase.from("entregas").select("*").eq("pedido_id", lote.pedido_id)).data ?? []
    : [];

  const itemsOrden = items ?? [];
  const nombreModelo = (id: string) => modelos?.find((m) => m.id === id)?.nombre ?? "—";
  const codigoTalla = (id: string) => tallas?.find((t) => t.id === id)?.codigo ?? "—";
  const ordenTalla = (id: string) => tallas?.find((t) => t.id === id)?.orden ?? 0;
  const puedeGestionar = perfil.rol === "admin" || perfil.rol === "supervisor";
  const esMaquila = lote.tipo_produccion === "maquila";
  const nombreMaquilero = lote.maquileros?.nombre ?? null;

  const resumen = resumenPorItem(itemsOrden, entregas, nombreModelo, codigoTalla, ordenTalla);
  const total = totalesResumen(resumen);
  const hayEntregasVigentes = entregas.some((e) => e.estatus === "registrada");
  const abierta = lote.estatus === "planeada" || lote.estatus === "en_proceso";

  const nombrePerfil = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));
  const textoItem = Object.fromEntries(resumen.map((r) => [r.itemId, `${r.modelo} ${r.talla}`]));
  const pagos: Record<string, PagoEntrega> | null = pagosData
    ? Object.fromEntries(
        pagosData
          .filter((p) => p.estatus !== "cancelado")
          .map((p) => [p.entrega_id, { monto: Number(p.monto), estatus: p.estatus, fechaProgramada: p.fecha_programada, fechaPagoReal: p.fecha_pago_real }])
      )
    : null;
  const totalPagos = Object.values(pagos ?? {}).reduce((acc, p) => acc + p.monto, 0);
  const totalPagado = Object.values(pagos ?? {}).filter((p) => p.estatus === "pagado").reduce((acc, p) => acc + p.monto, 0);
  const preciosPorModelo = preciosData ? Object.fromEntries(preciosData.map((p) => [p.modelo_id, Number(p.precio_por_pieza)])) : null;

  const descripcionEntrega = (e: EntregaConItems) => ({
    piezas: e.entrega_produccion_items.map((i) => `${i.cantidad} ${textoItem[i.item_orden_id] ?? ""}`.trim()).join(", "),
    quien: `Entregó ${e.maquilero_id ? nombreMaquilero ?? "el maquilero" : nombrePerfil[e.entregado_por ?? ""] ?? "—"} · recibió ${nombrePerfil[e.recibido_por] ?? "—"}`,
  });
  const eventosHistorial = construirHistorialOrden({
    lote,
    entregasProduccion: entregas,
    descripcionEntrega,
    consumos: consumos ?? [],
    materiales: materiales ?? [],
    entregas: pedidoAlCliente,
  });

  return (
    <div className="space-y-8">
      <Link href="/produccion" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        Producción
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{lote.folio}</h1>
          <p className="text-muted-foreground">
            {itemsOrden.length} producto(s) · {total.pedido} piezas en total
            {lote.ubicaciones?.nombre && ` · Entran a ${lote.ubicaciones.nombre}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={CLASE_ESTATUS_ORDEN[lote.estatus]}>{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
            {lote.cerrada_con_faltantes && <Badge variant="outline">Con faltantes</Badge>}
            {esMaquila ? (
              <Badge variant="secondary">
                Maquila ·{" "}
                {lote.maquilero_id ? (
                  <Link href={`/produccion/maquileros/${lote.maquilero_id}`} className="underline-offset-2 hover:underline">
                    {nombreMaquilero}
                  </Link>
                ) : (
                  "—"
                )}
              </Badge>
            ) : (
              <Badge variant="outline">Interna</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeGestionar && abierta && total.pendiente > 0 && (
            <RegistrarEntregaDialog
              loteId={loteId}
              folio={lote.folio}
              tipo={esMaquila ? "maquila" : "interna"}
              maquilero={nombreMaquilero}
              resumen={resumen}
              colaboradores={(perfiles ?? []).filter((p) => p.rol === "colaborador" && p.activo).map((p) => ({ id: p.id, nombre: p.nombre_completo }))}
              receptores={(perfiles ?? []).filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre_completo }))}
              usuarioActualId={perfil.id}
              hoy={hoyMexico()}
              preciosPorModelo={preciosPorModelo}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/api/pdf/produccion/${loteId}`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Descargar PDF
          </Button>
          {puedeGestionar && lote.estatus !== "cancelada" && (
            <Button variant="outline" size="sm" render={<Link href={`/produccion/${loteId}/editar`} />} nativeButton={false}>
              Editar
            </Button>
          )}
          {puedeGestionar && (
            <CierreOrden
              loteId={loteId}
              puedeCerrar={abierta && hayEntregasVigentes && total.pendiente > 0}
              cerradaConFaltantes={false}
              motivoCierre={null}
              faltan={total.pendiente}
            />
          )}
          {puedeGestionar && lote.estatus !== "cancelada" && <BotonCancelarOrden loteId={loteId} />}
        </div>
      </div>

      {puedeGestionar && lote.cerrada_con_faltantes && (
        <CierreOrden loteId={loteId} puedeCerrar={false} cerradaConFaltantes motivoCierre={lote.motivo_cierre} faltan={total.pendiente} />
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Pedido, entregado y pendiente por talla</h2>
        <ResumenEntregas resumen={resumen} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Entregas</h2>
          {esMaquila && pagos && (
            <p className="text-sm text-muted-foreground">
              Por pagar al maquilero: <strong className="text-foreground">{formatearMoneda(totalPagos - totalPagado)}</strong> · ya pagado {formatearMoneda(totalPagado)}
            </p>
          )}
        </div>
        <HistorialEntregas
          loteId={loteId}
          entregas={entregas}
          nombrePerfil={nombrePerfil}
          nombreMaquilero={lote.maquilero_id && nombreMaquilero ? { [lote.maquilero_id]: nombreMaquilero } : {}}
          textoItem={textoItem}
          pagos={pagos}
          puedeCancelar={puedeGestionar}
        />
      </div>

      {puedeGestionar && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Notas</h2>
          <NotasOrden loteId={loteId} notasIniciales={lote.notas ?? ""} />
        </div>
      )}

      {puedeGestionar && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Insumos a utilizar</h2>
            <InsumosOrden loteId={loteId} consumos={consumos ?? []} materiales={materiales ?? []} />
          </div>
          <div>
            <h3 className="mb-3 text-base font-semibold">Unidades específicas (rollo/bolsa con QR)</h3>
            <UnidadesOrden loteId={loteId} consumos={consumosUnidad ?? []} />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Cronología</h2>
        <HistorialOrden eventos={eventosHistorial} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Incidencias</h2>
        <IncidenciasLote loteId={loteId} incidencias={incidencias ?? []} puedeResolver={puedeGestionar} />
      </div>
    </div>
  );
}
