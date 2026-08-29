import Link from "next/link";
import { PackageSearch, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Paso 1 de 3: elegir la orden de trabajo. Antes esta pantalla mezclaba de
// un jalón todos los procesos de todos los productos de todas las órdenes
// con avance disponible -- con varias órdenes, varios productos por orden y
// sub-procesos configurados, la lista se volvía interminable. Ahora es
// orden -> producto (/mi-dia/[loteId]) -> procesos
// (/mi-dia/[loteId]/[itemId]).
export default async function MiDiaPage() {
  const perfil = await requerirPerfil();
  const supabase = await createClient();

  const [{ data: lotes }, { data: items }, { data: loteEtapas }, { data: funciones }] = await Promise.all([
    supabase.from("lotes_produccion").select("*").in("estatus", ["planeada", "en_proceso"]),
    supabase.from("items_orden_produccion").select("*"),
    supabase.from("lote_etapas").select("*"),
    supabase.from("colaborador_etapas").select("etapa_id").eq("perfil_id", perfil.id),
  ]);

  const etapasPermitidas = (funciones ?? []).map((f) => f.etapa_id);

  const tarjetasPorLote = new Map<string, { folio: string; productosDisponibles: number }>();

  for (const item of items ?? []) {
    const lote = lotes?.find((l) => l.id === item.lote_id);
    if (!lote) continue;
    const etapasDelItem = (loteEtapas ?? []).filter((le) => le.item_orden_id === item.id);
    const hayDisponible = calcularDisponiblePorEtapa(etapasDelItem, item.cantidad_planeada)
      .filter((e) => e.disponible > 0)
      .some((e) => !etapasPermitidas.length || etapasPermitidas.includes(e.etapaIdEfectivo));
    if (!hayDisponible) continue;

    const actual = tarjetasPorLote.get(lote.id);
    tarjetasPorLote.set(lote.id, {
      folio: lote.folio,
      productosDisponibles: (actual?.productosDisponibles ?? 0) + 1,
    });
  }

  const tarjetas = [...tarjetasPorLote.entries()];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Mi día</h1>
        <p className="text-sm text-muted-foreground">Elige la orden de trabajo en la que vas a trabajar hoy.</p>
      </div>

      <div className="space-y-3">
        {tarjetas.map(([loteId, { folio, productosDisponibles }]) => (
          <Link key={loteId} href={`/mi-dia/${loteId}`}>
            <Card className="transition-all active:scale-[0.99] active:bg-muted">
              <CardContent className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-blue-600 bg-blue-100 dark:bg-blue-950">
                  <ClipboardList className="size-5" />
                </div>
                <p className="min-w-0 flex-1 font-medium">{folio}</p>
                <Badge className="shrink-0">
                  {productosDisponibles} producto{productosDisponibles === 1 ? "" : "s"}
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
