import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import { visualEtapa } from "@/lib/produccion/etapa-visual";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database.types";

type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];
type ItemOrden = Database["public"]["Tables"]["items_orden_produccion"]["Row"];

export function TimelineEtapasLote({
  items,
  loteEtapas,
  etapasCatalogo,
  modelos,
  tallas,
}: {
  items: ItemOrden[];
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
}) {
  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Esta orden no tiene productos.</p>;
  }

  return (
    <div className="space-y-6">
      {items.map((item) => {
        const etapasDelItem = loteEtapas
          .filter((le) => le.item_orden_id === item.id)
          .sort((a, b) => a.orden_secuencia - b.orden_secuencia);
        const conDisponible = calcularDisponiblePorEtapa(etapasDelItem, item.cantidad_planeada);
        const nombreModelo = modelos.find((m) => m.id === item.modelo_id)?.nombre ?? "—";
        const codigoTalla = tallas.find((t) => t.id === item.talla_id)?.codigo ?? "—";
        const etapaActual = etapasDelItem.find((e) => e.estatus !== "completa");
        const etiquetaEtapaActual = etapasDelItem.length
          ? etapaActual
            ? nombreEtapa(etapaActual.etapa_id)
            : "Completado"
          : "Sin etapas";

        return (
          <div key={item.id}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">
                {nombreModelo} · Talla {codigoTalla} · {item.cantidad_planeada} pzas
              </p>
              <Badge variant={etiquetaEtapaActual === "Completado" ? "default" : "secondary"}>
                Proceso actual: {etiquetaEtapaActual}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {conDisponible.map((etapa) => {
                const porcentaje = Math.min(100, Math.round((etapa.cantidad_completada / item.cantidad_planeada) * 100));
                const { icon: Icon, color } = visualEtapa(nombreEtapa(etapa.etapa_id));
                const completa = etapa.estatus === "completa";
                return (
                  <div key={etapa.id} className={`rounded-lg border p-3 ${completa ? "bg-muted/40" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${color}`}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Proceso {etapa.orden_secuencia}</p>
                        <p className="truncate font-medium">{nombreEtapa(etapa.etapa_id)}</p>
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${porcentaje}%` }} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {etapa.cantidad_completada} / {item.cantidad_planeada} · disponible: {etapa.disponible}
                    </p>
                  </div>
                );
              })}
              {!conDisponible.length && (
                <p className="text-sm text-muted-foreground">Sin etapas configuradas.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
