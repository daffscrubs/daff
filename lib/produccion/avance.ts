import type { Database } from "@/types/database.types";

type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];

export interface EtapaConDisponible extends LoteEtapa {
  disponible: number;
  /** etapa_id propio si es un proceso normal, o el de su proceso padre si es
   * un sub-proceso (los sub-procesos no tienen etapa_id propio). */
  etapaIdEfectivo: string;
  /** orden_secuencia propio, o el de su proceso padre si es un sub-proceso. */
  ordenSecuenciaEfectiva: number;
}

/**
 * El disponible de un proceso es lo que ya completó el proceso anterior (o la
 * cantidad planeada del ítem si es el primero) menos lo que este proceso ya
 * acumuló. Debe reflejar exactamente la regla que aplica el trigger
 * fn_validar_y_acumular_avance en la base de datos.
 *
 * Si un proceso tiene sub-procesos (ej. Confección con Manga/Delantero/
 * Trasero/Cuello), no se captura sobre el proceso padre directamente —
 * aparece un renglón "capturable" por cada sub-proceso, cada uno con el mismo
 * tope compartido (lo que dejó disponible el proceso anterior), y el padre
 * mismo no aparece en el resultado (su cantidad_completada es un total
 * derivado, el mínimo entre sus hijas, mantenido por el trigger).
 */
export function calcularDisponiblePorEtapa(
  filas: LoteEtapa[],
  cantidadPlaneada: number
): EtapaConDisponible[] {
  const padres = filas
    .filter((f) => !f.parent_lote_etapa_id)
    .sort((a, b) => (a.orden_secuencia ?? 0) - (b.orden_secuencia ?? 0));

  const resultado: EtapaConDisponible[] = [];
  padres.forEach((padre, index) => {
    const limite = index === 0 ? cantidadPlaneada : padres[index - 1].cantidad_completada;
    const hijas = filas.filter((f) => f.parent_lote_etapa_id === padre.id);
    const base = hijas.length ? hijas : [padre];
    base.forEach((fila) => {
      resultado.push({
        ...fila,
        disponible: Math.max(0, limite - fila.cantidad_completada),
        etapaIdEfectivo: padre.etapa_id!,
        ordenSecuenciaEfectiva: padre.orden_secuencia!,
      });
    });
  });
  return resultado;
}

/**
 * Solo las filas donde tiene sentido capturar avance directamente: los
 * sub-procesos, y los procesos padre que NO tienen sub-procesos. Un padre con
 * hijas es un total derivado (el mínimo de sus hijas) — el trigger rechaza
 * capturar ahí directamente, así que no se ofrece como opción en la UI.
 */
export function filasCapturables(filas: LoteEtapa[]): LoteEtapa[] {
  const idsConHijas = new Set(filas.filter((f) => f.parent_lote_etapa_id).map((f) => f.parent_lote_etapa_id));
  return filas.filter((f) => f.parent_lote_etapa_id || !idsConHijas.has(f.id));
}

// Pick con solo lo que estas dos funciones leen (no cantidad_completada,
// orden_secuencia, etc. que sí necesita calcularDisponiblePorEtapa arriba) —
// así una pantalla que solo necesita mostrar el nombre visible de la etapa
// puede pedirle a Supabase nada más estas columnas.
type LoteEtapaMinima = Pick<LoteEtapa, "id" | "etapa_id" | "parent_lote_etapa_id" | "nombre_subproceso">;

/** etapa_id propio de la fila, o el de su padre si es un sub-proceso. */
export function etapaIdEfectivoDe(fila: LoteEtapaMinima, todas: LoteEtapaMinima[]): string {
  if (fila.etapa_id) return fila.etapa_id;
  const padre = todas.find((f) => f.id === fila.parent_lote_etapa_id);
  return padre?.etapa_id ?? "";
}

/** "Confección" para un proceso normal, "Confección — Manga" para un sub-proceso. */
export function nombreVisibleEtapa(
  fila: LoteEtapaMinima,
  todas: LoteEtapaMinima[],
  nombreEtapaCatalogo: (etapaId: string) => string
): string {
  const base = nombreEtapaCatalogo(etapaIdEfectivoDe(fila, todas));
  return fila.nombre_subproceso ? `${base} — ${fila.nombre_subproceso}` : base;
}
