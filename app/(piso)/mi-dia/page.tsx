import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MiDiaPage() {
  const supabase = await createClient();

  const [{ data: lotes }, { data: loteEtapas }, { data: etapasCatalogo }] = await Promise.all([
    supabase
      .from("lotes_produccion")
      .select("*, modelos(nombre), tallas(codigo)")
      .in("estatus", ["planeada", "en_proceso"]),
    supabase.from("lote_etapas").select("*"),
    supabase.from("etapas_proceso").select("*"),
  ]);

  const nombreEtapa = (id: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";

  const tarjetas = (lotes ?? []).flatMap((lote) => {
    const etapasDelLote = (loteEtapas ?? [])
      .filter((le) => le.lote_id === lote.id)
      .sort((a, b) => a.orden_secuencia - b.orden_secuencia);
    const conDisponible = calcularDisponiblePorEtapa(etapasDelLote, lote.cantidad_planeada);
    return conDisponible
      .filter((e) => e.disponible > 0)
      .map((e) => ({ lote, etapa: e }));
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Mi día</h1>
      <p className="text-sm text-muted-foreground">
        Lotes y etapas donde puedes registrar tu avance hoy.
      </p>

      <div className="space-y-3">
        {tarjetas.map(({ lote, etapa }) => (
          <Link key={etapa.id} href={`/mi-dia/nuevo?loteEtapaId=${etapa.id}`}>
            <Card className="transition-colors active:bg-muted">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{nombreEtapa(etapa.etapa_id)}</span>
                  <Badge>{etapa.disponible} disponibles</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {lote.folio} · {lote.modelos?.nombre} · Talla {lote.tallas?.codigo}
              </CardContent>
            </Card>
          </Link>
        ))}
        {!tarjetas.length && (
          <p className="text-sm text-muted-foreground">
            No hay avance disponible para capturar en este momento.
          </p>
        )}
      </div>
    </div>
  );
}
