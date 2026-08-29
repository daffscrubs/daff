import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackageSearch, Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Paso 2 de 3: dentro de la orden elegida, qué producto (modelo + talla).
export default async function MiDiaProductosPage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId } = await params;
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const { data: lote } = await supabase.from("lotes_produccion").select("folio").eq("id", loteId).single();
  if (!lote) notFound();

  const [{ data: items }, { data: loteEtapas }, { data: modelos }, { data: tallas }, { data: funciones }] =
    await Promise.all([
      supabase.from("items_orden_produccion").select("*").eq("lote_id", loteId),
      supabase.from("lote_etapas").select("*").eq("lote_id", loteId),
      supabase.from("modelos").select("id, nombre"),
      supabase.from("tallas").select("id, codigo"),
      supabase.from("colaborador_etapas").select("etapa_id").eq("perfil_id", perfil.id),
    ]);

  const etapasPermitidas = (funciones ?? []).map((f) => f.etapa_id);

  const tarjetas = (items ?? []).flatMap((item) => {
    const etapasDelItem = (loteEtapas ?? []).filter((le) => le.item_orden_id === item.id);
    const disponibles = calcularDisponiblePorEtapa(etapasDelItem, item.cantidad_planeada)
      .filter((e) => e.disponible > 0)
      .filter((e) => !etapasPermitidas.length || etapasPermitidas.includes(e.etapaIdEfectivo));
    if (!disponibles.length) return [];
    return [{ item, procesosDisponibles: disponibles.length }];
  });

  return (
    <div className="space-y-4">
      <Link href="/mi-dia" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        Mi día
      </Link>

      <div>
        <h1 className="text-lg font-semibold">{lote.folio}</h1>
        <p className="text-sm text-muted-foreground">Elige el producto en el que vas a trabajar.</p>
      </div>

      <div className="space-y-3">
        {tarjetas.map(({ item, procesosDisponibles }) => (
          <Link key={item.id} href={`/mi-dia/${loteId}/${item.id}`}>
            <Card className="transition-all active:scale-[0.99] active:bg-muted">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 bg-slate-100 dark:bg-slate-800">
                  <Shirt className="size-5" />
                </div>
                <p className="min-w-0 flex-1 font-medium">
                  {modelos?.find((m) => m.id === item.modelo_id)?.nombre} · Talla{" "}
                  {tallas?.find((t) => t.id === item.talla_id)?.codigo}
                </p>
                <Badge className="shrink-0">
                  {procesosDisponibles} proceso{procesosDisponibles === 1 ? "" : "s"}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!tarjetas.length && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <PackageSearch className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ya no hay avance disponible en esta orden.</p>
          </div>
        )}
      </div>
    </div>
  );
}
