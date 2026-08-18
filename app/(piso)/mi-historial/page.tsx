import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MiHistorialPage() {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { data: registros } = await supabase
    .from("registros_avance_colaborador")
    .select("*, lotes_produccion(folio), lote_etapas(etapa_id)")
    .eq("colaborador_id", perfil.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: etapasCatalogo } = await supabase.from("etapas_proceso").select("*");
  const nombreEtapa = (id?: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Mi historial</h1>
      <div className="space-y-2">
        {registros?.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{nombreEtapa(r.lote_etapas?.etapa_id)}</span>
                <Badge variant={r.cantidad < 0 ? "destructive" : "default"}>
                  {r.cantidad > 0 ? "+" : ""}
                  {r.cantidad}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {r.lotes_produccion?.folio} · {r.fecha}
              {r.observaciones && <p className="mt-1">{r.observaciones}</p>}
            </CardContent>
          </Card>
        ))}
        {!registros?.length && (
          <p className="text-sm text-muted-foreground">Todavía no has registrado avance.</p>
        )}
      </div>
    </div>
  );
}
