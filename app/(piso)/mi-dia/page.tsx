import Link from "next/link";
import { PackageSearch, Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Paso 1 de 2: elegir en qué producto/orden se va a trabajar. Antes esta
// pantalla mezclaba de un jalón TODOS los procesos de TODAS las órdenes con
// avance disponible (un renglón por cada proceso/sub-proceso de cada
// producto) -- con varias órdenes y sub-procesos configurados, la lista se
// volvía interminable. Ahora se agrupa por producto (item de la orden): una
// tarjeta por producto, y solo al entrar a esa tarjeta (/mi-dia/[itemId])
// se ven sus procesos específicos.
export default async function MiDiaPage() {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const [{ data: lotes }, { data: items }, { data: loteEtapas }, { data: modelos }, { data: tallas }, { data: funciones }] =
    await Promise.all([
      supabase.from("lotes_produccion").select("*").in("estatus", ["planeada", "en_proceso"]),
      supabase.from("items_orden_produccion").select("*"),
      supabase.from("lote_etapas").select("*"),
      supabase.from("modelos").select("id, nombre"),
      supabase.from("tallas").select("id, codigo"),
      supabase.from("colaborador_etapas").select("etapa_id").eq("perfil_id", perfil.id),
    ]);

  const etapasPermitidas = (funciones ?? []).map((f) => f.etapa_id);
  const loteDe = (loteId: string) => lotes?.find((l) => l.id === loteId);

  const tarjetas = (items ?? []).flatMap((item) => {
    const lote = loteDe(item.lote_id);
    if (!lote) return [];
    const etapasDelItem = (loteEtapas ?? []).filter((le) => le.item_orden_id === item.id);
    const disponibles = calcularDisponiblePorEtapa(etapasDelItem, item.cantidad_planeada)
      .filter((e) => e.disponible > 0)
      .filter((e) => !etapasPermitidas.length || etapasPermitidas.includes(e.etapaIdEfectivo));
    if (!disponibles.length) return [];
    return [{ lote, item, procesosDisponibles: disponibles.length }];
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Mi día</h1>
        <p className="text-sm text-muted-foreground">Elige el producto/orden en el que vas a trabajar hoy.</p>
      </div>

      <div className="space-y-3">
        {tarjetas.map(({ lote, item, procesosDisponibles }) => (
          <Link key={item.id} href={`/mi-dia/${item.id}`}>
            <Card className="transition-all active:scale-[0.99] active:bg-muted">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 bg-slate-100 dark:bg-slate-800">
                  <Shirt className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {modelos?.find((m) => m.id === item.modelo_id)?.nombre} · Talla{" "}
                    {tallas?.find((t) => t.id === item.talla_id)?.codigo}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{lote.folio}</p>
                </div>
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
            <p className="text-sm text-muted-foreground">
              No hay avance disponible para capturar en este momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
