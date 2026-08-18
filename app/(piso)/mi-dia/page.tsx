import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { visualEtapa } from "@/lib/produccion/etapa-visual";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MiDiaPage() {
  const supabase = await createClient();

  const [{ data: lotes }, { data: items }, { data: loteEtapas }, { data: etapasCatalogo }, { data: modelos }, { data: tallas }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("*").in("estatus", ["planeada", "en_proceso"]),
      supabase.from("items_orden_produccion").select("*"),
      supabase.from("lote_etapas").select("*"),
      supabase.from("etapas_proceso").select("*"),
      supabase.from("modelos").select("id, nombre"),
      supabase.from("tallas").select("id, codigo"),
    ]);

  const nombreEtapa = (id: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";
  const loteDe = (loteId: string) => lotes?.find((l) => l.id === loteId);

  const tarjetas = (items ?? []).flatMap((item) => {
    const lote = loteDe(item.lote_id);
    if (!lote) return [];
    const etapasDelItem = (loteEtapas ?? [])
      .filter((le) => le.item_orden_id === item.id)
      .sort((a, b) => a.orden_secuencia - b.orden_secuencia);
    const conDisponible = calcularDisponiblePorEtapa(etapasDelItem, item.cantidad_planeada);
    return conDisponible
      .filter((e) => e.disponible > 0)
      .map((e) => ({ lote, item, etapa: e }));
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Mi día</h1>
        <p className="text-sm text-muted-foreground">
          Elige el producto y el proceso en el que vas a trabajar hoy.
        </p>
      </div>

      <div className="space-y-3">
        {tarjetas.map(({ lote, item, etapa }) => {
          const nombre = nombreEtapa(etapa.etapa_id);
          const { icon: Icon, color } = visualEtapa(nombre);
          return (
            <Link key={etapa.id} href={`/mi-dia/nuevo?loteEtapaId=${etapa.id}`}>
              <Card className="transition-all active:scale-[0.99] active:bg-muted">
                <CardContent className="flex items-center gap-3">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{nombre}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {modelos?.find((m) => m.id === item.modelo_id)?.nombre} · Talla{" "}
                      {tallas?.find((t) => t.id === item.talla_id)?.codigo} · {lote.folio}
                    </p>
                  </div>
                  <Badge className="shrink-0">{etapa.disponible} pzas</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {!tarjetas.length && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <PackageSearch className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay avance disponible para capturar en este momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
