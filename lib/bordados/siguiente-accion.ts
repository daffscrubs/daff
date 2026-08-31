import { marcarRecogida, marcarBordada, marcarRegresada } from "@/actions/prendasBordado.actions";
import type { AccionResultado } from "@/lib/tipos/accion";
import type { EstatusPrendaBordado } from "@/types/database.types";

/**
 * La siguiente acción disponible depende solo del estatus actual de la
 * prenda -- mismo orden que valida transicionarEstatusPrenda en el
 * servidor. null significa "estatus final, no hay nada más que marcar".
 * Un solo lugar para esta regla: la usan el escaneo (piso y admin), el
 * listado de admin y la lista de piso, para no repetir el mapeo en cada uno.
 */
export const SIGUIENTE_ACCION_PRENDA: Record<
  EstatusPrendaBordado,
  { etiqueta: string; accion: (id: string) => Promise<AccionResultado> } | null
> = {
  recibida_en_tienda: { etiqueta: "Marcar recogida para bordar", accion: marcarRecogida },
  recogida_para_bordar: { etiqueta: "Marcar bordada", accion: marcarBordada },
  bordada: { etiqueta: "Marcar regresada a tienda", accion: marcarRegresada },
  regresada_a_tienda: null,
};
