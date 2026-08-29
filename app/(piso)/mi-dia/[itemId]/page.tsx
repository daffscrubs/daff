import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { visualEtapa } from "@/lib/produccion/etapa-visual";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Paso 2 de 2: los procesos/sub-procesos disponibles, pero acotados a UN
// solo producto (el que se eligió en /mi-dia) en vez de la lista completa
// de todas las órdenes mezcladas.
export default async function MiDiaProcesosPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { data: item } = await supabase.from("items_orden_produccion").select("*").eq("id", itemId).single();
  if (!item) notFound();

  const [{ data: lote }, { data: loteEtapas }, { data: etapasCatalogo }, { data: modelo }, { data: talla }, { data: funciones }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("folio").eq("id", item.lote_id).single(),
      supabase.from("lote_etapas").select("*").eq("item_orden_id", itemId),
      supabase.from("etapas_proceso").select("*"),
      supabase.from("modelos").select("nombre").eq("id", item.modelo_id).single(),
      supabase.from("tallas").select("codigo").eq("id", item.talla_id).single(),
      supabase.from("colaborador_etapas").select("etapa_id").eq("perfil_id", perfil.id),
    ]);

  const etapasPermitidas = (funciones ?? []).map((f) => f.etapa_id);
  const nombreEtapa = (id: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";

  const tarjetas = calcularDisponiblePorEtapa(loteEtapas ?? [], item.cantidad_planeada)
    .filter((e) => e.disponible > 0)
    .filter((e) => !etapasPermitidas.length || etapasPermitidas.includes(e.etapaIdEfectivo));

  return (
    <div className="space-y-4">
      <Link href="/mi-dia" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        Mi día
      </Link>

      <div>
        <h1 className="text-lg font-semibold">
          {modelo?.nombre} · Talla {talla?.codigo}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lote?.folio} · Elige el proceso en el que vas a trabajar.
        </p>
      </div>

      <div className="space-y-3">
        {tarjetas.map((etapa) => {
          const nombreBase = nombreEtapa(etapa.etapaIdEfectivo);
          const nombre = etapa.nombre_subproceso ? `${nombreBase} — ${etapa.nombre_subproceso}` : nombreBase;
          const { icon: Icon, color } = visualEtapa(nombreBase);
          return (
            <Link key={etapa.id} href={`/mi-dia/nuevo?loteEtapaId=${etapa.id}`}>
              <Card className="transition-all active:scale-[0.99] active:bg-muted">
                <CardContent className="flex items-center gap-3">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="size-5" />
                  </div>
                  <p className="min-w-0 flex-1 font-medium">{nombre}</p>
                  <Badge className="shrink-0">{etapa.disponible} pzas</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!tarjetas.length && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <PackageSearch className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ya no hay avance disponible para este producto.</p>
          </div>
        )}
      </div>
    </div>
  );
}
