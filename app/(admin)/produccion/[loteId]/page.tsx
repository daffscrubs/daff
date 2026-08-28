import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { TimelineEtapasLote } from "@/components/produccion/TimelineEtapasLote";
import { IncidenciasLote } from "@/components/produccion/IncidenciasLote";
import { AjusteAvanceForm } from "@/components/produccion/AjusteAvanceForm";
import { NotasOrden } from "@/components/produccion/NotasOrden";
import { InsumosOrden } from "@/components/produccion/InsumosOrden";
import { UnidadesOrden } from "@/components/produccion/UnidadesOrden";
import { HistorialOrden } from "@/components/produccion/HistorialOrden";
import { BotonCancelarOrden } from "@/components/produccion/BotonCancelarOrden";
import { construirHistorialOrden } from "@/lib/produccion/historial";
import { construirRegistrosReporte } from "@/lib/produccion/registro-reporte";
import { formatearFechaHora } from "@/lib/fechas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const [
    { data: lote },
    { data: items },
    { data: loteEtapas },
    { data: etapasCatalogo },
    { data: incidencias },
    { data: registros },
    { data: colaboradores },
    { data: modelos },
    { data: tallas },
    { data: consumos },
    { data: materiales },
    { data: consumosUnidad },
  ] = await Promise.all([
    supabase.from("lotes_produccion").select("*").eq("id", loteId).single(),
    supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
    supabase.from("lote_etapas").select("*").eq("lote_id", loteId),
    supabase.from("etapas_proceso").select("*"),
    supabase.from("incidencias_produccion").select("*").eq("lote_id", loteId).order("created_at", { ascending: false }),
    supabase
      .from("registros_avance_colaborador")
      .select("*, perfiles!registros_avance_colaborador_colaborador_id_fkey(nombre_completo)")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false }),
    supabase.from("perfiles").select("*").eq("rol", "colaborador").eq("activo", true),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
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

  const entregas = lote.pedido_id
    ? (await supabase.from("entregas").select("*").eq("pedido_id", lote.pedido_id)).data ?? []
    : [];

  const itemsOrden = items ?? [];
  const nombreEtapa = (id: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";
  const nombreItem = (le: { item_orden_id: string }) => {
    const item = itemsOrden.find((i) => i.id === le.item_orden_id);
    if (!item) return "—";
    const nombreModelo = modelos?.find((m) => m.id === item.modelo_id)?.nombre ?? "";
    const codigoTalla = tallas?.find((t) => t.id === item.talla_id)?.codigo ?? "";
    return `${nombreModelo} ${codigoTalla}`.trim();
  };
  const puedeGestionar = perfil.rol === "admin" || perfil.rol === "supervisor";

  const registrosReporte = construirRegistrosReporte({
    registros: registros ?? [],
    etapasCatalogo: etapasCatalogo ?? [],
    loteEtapas: loteEtapas ?? [],
    items: itemsOrden,
    lotes: [{ id: lote.id, folio: lote.folio }],
    modelos: modelos ?? [],
    tallas: tallas ?? [],
  });

  const eventosHistorial = construirHistorialOrden({
    lote,
    registrosReporte,
    consumos: consumos ?? [],
    materiales: materiales ?? [],
    entregas,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lote.folio}</h1>
          <p className="text-muted-foreground">
            {itemsOrden.length} producto(s) ·{" "}
            {itemsOrden.reduce((acc, i) => acc + i.cantidad_planeada, 0)} piezas en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={CLASE_ESTATUS_ORDEN[lote.estatus]}>{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/api/pdf/produccion/${loteId}`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Descargar PDF
          </Button>
          {puedeGestionar && (
            <Button variant="outline" size="sm" render={<Link href={`/produccion/${loteId}/etapas`} />} nativeButton={false}>
              Configurar procesos
            </Button>
          )}
          {puedeGestionar && lote.estatus !== "cancelada" && (
            <Button variant="outline" size="sm" render={<Link href={`/produccion/${loteId}/editar`} />} nativeButton={false}>
              Editar
            </Button>
          )}
          {puedeGestionar && lote.estatus !== "cancelada" && (
            <BotonCancelarOrden loteId={loteId} />
          )}
        </div>
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
            <InsumosOrden
              loteId={loteId}
              consumos={consumos ?? []}
              materiales={materiales ?? []}
              materialesConUnidadAsignada={[
                ...new Set((consumosUnidad ?? []).map((c) => c.unidades_material?.material_id).filter((id): id is string => !!id)),
              ]}
            />
          </div>
          <div>
            <h3 className="mb-3 text-base font-semibold">Unidades específicas (rollo/bolsa con QR)</h3>
            <UnidadesOrden loteId={loteId} consumos={consumosUnidad ?? []} />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Avance por proceso</h2>
        <TimelineEtapasLote
          items={itemsOrden}
          loteEtapas={loteEtapas ?? []}
          etapasCatalogo={etapasCatalogo ?? []}
          modelos={modelos ?? []}
          tallas={tallas ?? []}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Cronología</h2>
        <HistorialOrden eventos={eventosHistorial} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Registros de avance</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Proceso</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros?.map((r) => {
              const le = loteEtapas?.find((le) => le.id === r.lote_etapa_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatearFechaHora(r.created_at)}</TableCell>
                  <TableCell>{r.perfiles?.nombre_completo ?? "—"}</TableCell>
                  <TableCell>{le ? nombreItem(le) : "—"}</TableCell>
                  <TableCell>{nombreEtapa(le?.etapa_id ?? "")}</TableCell>
                  <TableCell className={r.cantidad < 0 ? "text-destructive" : ""}>{r.cantidad}</TableCell>
                  <TableCell>{r.origen === "ajuste_supervisor" ? "Ajuste" : "Colaborador"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.observaciones ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {!registros?.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin registros de avance todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {puedeGestionar && !!loteEtapas?.length && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Corregir un registro (ajuste)</h2>
          <AjusteAvanceForm
            loteId={loteId}
            loteEtapas={loteEtapas ?? []}
            etapasCatalogo={etapasCatalogo ?? []}
            colaboradores={colaboradores ?? []}
            items={itemsOrden}
            modelos={modelos ?? []}
            tallas={tallas ?? []}
          />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Incidencias</h2>
        <IncidenciasLote loteId={loteId} incidencias={incidencias ?? []} puedeResolver={puedeGestionar} />
      </div>
    </div>
  );
}
