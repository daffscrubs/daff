import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { TimelineEtapasLote } from "@/components/produccion/TimelineEtapasLote";
import { IncidenciasLote } from "@/components/produccion/IncidenciasLote";
import { AjusteAvanceForm } from "@/components/produccion/AjusteAvanceForm";
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
    { data: loteEtapas },
    { data: etapasCatalogo },
    { data: incidencias },
    { data: registros },
    { data: colaboradores },
  ] = await Promise.all([
    supabase.from("lotes_produccion").select("*, modelos(nombre)").eq("id", loteId).single(),
    supabase.from("lote_etapas").select("*").eq("lote_id", loteId),
    supabase.from("etapas_proceso").select("*"),
    supabase.from("incidencias_produccion").select("*").eq("lote_id", loteId).order("created_at", { ascending: false }),
    supabase
      .from("registros_avance_colaborador")
      .select("*, perfiles!registros_avance_colaborador_colaborador_id_fkey(nombre_completo)")
      .eq("lote_id", loteId)
      .order("created_at", { ascending: false }),
    supabase.from("perfiles").select("*").eq("rol", "colaborador").eq("activo", true),
  ]);

  if (!lote) notFound();

  const nombreEtapa = (id: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";
  const puedeGestionar = perfil.rol === "admin" || perfil.rol === "supervisor";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lote.folio}</h1>
          <p className="text-muted-foreground">
            {lote.modelos?.nombre ?? "Modelo"} · {lote.cantidad_planeada} piezas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
          {puedeGestionar && (
            <Button variant="outline" size="sm" render={<Link href={`/produccion/${loteId}/etapas`} />} nativeButton={false}>
              Configurar etapas
            </Button>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Avance por etapa</h2>
        <TimelineEtapasLote
          loteEtapas={loteEtapas ?? []}
          etapasCatalogo={etapasCatalogo ?? []}
          cantidadPlaneada={lote.cantidad_planeada}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Registros de avance</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{r.fecha}</TableCell>
                <TableCell>{r.perfiles?.nombre_completo ?? "—"}</TableCell>
                <TableCell>{nombreEtapa(loteEtapas?.find((le) => le.id === r.lote_etapa_id)?.etapa_id ?? "")}</TableCell>
                <TableCell className={r.cantidad < 0 ? "text-destructive" : ""}>{r.cantidad}</TableCell>
                <TableCell>{r.origen === "ajuste_supervisor" ? "Ajuste" : "Colaborador"}</TableCell>
                <TableCell className="text-muted-foreground">{r.observaciones ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!registros?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
