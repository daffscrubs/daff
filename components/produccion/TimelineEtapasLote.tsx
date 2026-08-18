import { calcularDisponiblePorEtapa } from "@/lib/produccion/avance";
import type { Database } from "@/types/database.types";

type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];

export function TimelineEtapasLote({
  loteEtapas,
  etapasCatalogo,
  cantidadPlaneada,
}: {
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  cantidadPlaneada: number;
}) {
  const ordenadas = loteEtapas.slice().sort((a, b) => a.orden_secuencia - b.orden_secuencia);
  const conDisponible = calcularDisponiblePorEtapa(ordenadas, cantidadPlaneada);
  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {conDisponible.map((etapa) => {
        const porcentaje = Math.min(100, Math.round((etapa.cantidad_completada / cantidadPlaneada) * 100));
        return (
          <div key={etapa.id} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Etapa {etapa.orden_secuencia}</p>
            <p className="font-medium">{nombreEtapa(etapa.etapa_id)}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {etapa.cantidad_completada} / {cantidadPlaneada} · disponible: {etapa.disponible}
            </p>
          </div>
        );
      })}
      {!conDisponible.length && (
        <p className="text-sm text-muted-foreground">Este lote no tiene etapas configuradas.</p>
      )}
    </div>
  );
}
