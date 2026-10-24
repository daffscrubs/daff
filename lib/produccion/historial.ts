import type { Database } from "@/types/database.types";
import type { EntregaConItems } from "@/lib/produccion/entregas";

type Lote = Database["public"]["Tables"]["lotes_produccion"]["Row"];
type Consumo = Database["public"]["Tables"]["consumo_material_orden"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];
type EntregaPedido = Database["public"]["Tables"]["entregas"]["Row"];

export interface EventoHistorial {
  /** Timestamp real (con hora) o fecha "YYYY-MM-DD" cuando `soloFecha` es true. */
  fecha: string;
  /** true si `fecha` no trae hora real (columnas `date`, no `timestamptz`). */
  soloFecha?: boolean;
  titulo: string;
  detalle?: string;
}

export function construirHistorialOrden({
  lote,
  entregasProduccion,
  descripcionEntrega,
  consumos,
  materiales,
  entregas,
}: {
  lote: Pick<Lote, "created_at" | "fecha_fin_real" | "cerrada_con_faltantes" | "fecha_cierre" | "motivo_cierre">;
  entregasProduccion: EntregaConItems[];
  /** Texto de lo entregado ("12 Filipina CH, 8 Filipina M") y de quién la hizo. */
  descripcionEntrega: (entrega: EntregaConItems) => { piezas: string; quien: string };
  consumos: Consumo[];
  materiales: Pick<Material, "id" | "nombre" | "unidad_medida">[];
  /** Entregas del PEDIDO al cliente (no confundir con las entregas de producción). */
  entregas: EntregaPedido[];
}): EventoHistorial[] {
  const eventos: EventoHistorial[] = [];

  eventos.push({ fecha: lote.created_at, titulo: "Orden creada" });

  for (const e of entregasProduccion) {
    const { piezas, quien } = descripcionEntrega(e);
    eventos.push({ fecha: e.created_at, titulo: `Entrega registrada: ${piezas}`, detalle: quien });
    if (e.estatus === "cancelada" && e.fecha_cancelacion) {
      eventos.push({ fecha: e.fecha_cancelacion, titulo: `Entrega cancelada: ${piezas}`, detalle: e.motivo_cancelacion ?? undefined });
    }
  }

  for (const consumo of consumos) {
    const material = materiales.find((m) => m.id === consumo.material_id);
    eventos.push({
      fecha: consumo.created_at,
      titulo: "Insumo asignado",
      detalle: material ? `${material.nombre} (${consumo.cantidad_estimada ?? "—"} ${material.unidad_medida})` : undefined,
    });
    if (consumo.cantidad_real_registrada_en) {
      eventos.push({
        fecha: consumo.cantidad_real_registrada_en,
        titulo: "Consumo real registrado",
        detalle: material ? `${material.nombre}: ${consumo.cantidad_real} ${material.unidad_medida}` : undefined,
      });
    }
  }

  if (lote.cerrada_con_faltantes && lote.fecha_cierre) {
    eventos.push({ fecha: lote.fecha_cierre, titulo: "Orden cerrada con faltantes", detalle: lote.motivo_cierre ?? undefined });
  } else if (lote.fecha_fin_real) {
    eventos.push({ fecha: lote.fecha_fin_real, soloFecha: true, titulo: "Orden completada" });
  }

  for (const entrega of entregas) {
    eventos.push({ fecha: entrega.fecha_programada, soloFecha: true, titulo: "Entrega del pedido al cliente programada" });
    if (entrega.fecha_real) {
      eventos.push({ fecha: entrega.fecha_real, titulo: "Entrega del pedido al cliente realizada" });
    }
  }

  // Más reciente arriba, más antiguo abajo.
  return eventos.sort((a, b) => (a.fecha > b.fecha ? -1 : a.fecha < b.fecha ? 1 : 0));
}
