import type { Database } from "@/types/database.types";
import type { RegistroReporte } from "@/components/produccion/ReporteProductividadTable";

type Lote = Database["public"]["Tables"]["lotes_produccion"]["Row"];
type Consumo = Database["public"]["Tables"]["consumo_material_orden"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];
type Entrega = Database["public"]["Tables"]["entregas"]["Row"];

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
  registrosReporte,
  consumos,
  materiales,
  entregas,
}: {
  lote: Pick<Lote, "created_at" | "fecha_fin_real">;
  registrosReporte: RegistroReporte[];
  consumos: Consumo[];
  materiales: Pick<Material, "id" | "nombre" | "unidad_medida">[];
  entregas: Entrega[];
}): EventoHistorial[] {
  const eventos: EventoHistorial[] = [];

  eventos.push({ fecha: lote.created_at, titulo: "Orden creada" });

  // Cada captura de avance (o ajuste) es un evento propio, con su hora real
  // (created_at), en vez de agruparse en un solo "etapa iniciada" por proceso.
  for (const r of registrosReporte) {
    const accion = r.origen === "ajuste_supervisor" ? "ajustó" : "registró";
    const signo = r.cantidad > 0 ? "+" : "";
    eventos.push({
      fecha: r.created_at,
      titulo: `${r.colaborador} ${accion} ${signo}${r.cantidad} en ${r.etapa}`,
      detalle: r.producto !== "—" ? r.producto : undefined,
    });
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

  if (lote.fecha_fin_real) {
    eventos.push({ fecha: lote.fecha_fin_real, soloFecha: true, titulo: "Orden completada" });
  }

  for (const entrega of entregas) {
    eventos.push({ fecha: entrega.fecha_programada, soloFecha: true, titulo: "Entrega programada" });
    if (entrega.fecha_real) {
      eventos.push({ fecha: entrega.fecha_real, titulo: "Entrega realizada" });
    }
  }

  // Más reciente arriba, más antiguo abajo.
  return eventos.sort((a, b) => (a.fecha > b.fecha ? -1 : a.fecha < b.fecha ? 1 : 0));
}
