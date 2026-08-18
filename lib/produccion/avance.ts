import type { Database } from "@/types/database.types";

type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];

export interface EtapaConDisponible extends LoteEtapa {
  disponible: number;
}

/**
 * El disponible de una etapa es lo que ya completó la etapa anterior (o la
 * cantidad planeada del lote si es la primera etapa) menos lo que esta etapa
 * ya acumuló. Debe reflejar exactamente la regla que aplica el trigger
 * fn_validar_y_acumular_avance en la base de datos.
 */
export function calcularDisponiblePorEtapa(
  etapasOrdenadas: LoteEtapa[],
  cantidadPlaneada: number
): EtapaConDisponible[] {
  return etapasOrdenadas.map((etapa, index) => {
    const limite = index === 0 ? cantidadPlaneada : etapasOrdenadas[index - 1].cantidad_completada;
    return { ...etapa, disponible: Math.max(0, limite - etapa.cantidad_completada) };
  });
}
