import type { Database } from "@/types/database.types";

type Lote = Database["public"]["Tables"]["lotes_produccion"]["Row"];
type Registro = Database["public"]["Tables"]["registros_avance_colaborador"]["Row"];
type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];
type Consumo = Database["public"]["Tables"]["consumo_material_orden"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];
type Entrega = Database["public"]["Tables"]["entregas"]["Row"];

export interface EventoHistorial {
  fecha: string;
  titulo: string;
  detalle?: string;
}

export function construirHistorialOrden({
  lote,
  registros,
  loteEtapas,
  etapasCatalogo,
  consumos,
  materiales,
  entregas,
}: {
  lote: Pick<Lote, "created_at" | "fecha_inicio" | "fecha_fin_real">;
  registros: Registro[];
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  consumos: Consumo[];
  materiales: Material[];
  entregas: Entrega[];
}): EventoHistorial[] {
  const eventos: EventoHistorial[] = [];

  eventos.push({ fecha: lote.created_at, titulo: "Orden creada" });

  if (lote.fecha_inicio) {
    eventos.push({ fecha: lote.fecha_inicio, titulo: "Producción iniciada" });
  }

  for (const consumo of consumos) {
    const material = materiales.find((m) => m.id === consumo.material_id);
    eventos.push({
      fecha: consumo.created_at,
      titulo: "Insumo asignado",
      detalle: material ? `${material.nombre} (${consumo.cantidad_estimada ?? "—"} ${material.unidad_medida})` : undefined,
    });
  }

  const pasos = [...new Map(loteEtapas.map((le) => [le.orden_secuencia, le.etapa_id])).values()];
  for (const [index, etapaId] of pasos.entries()) {
    const ordenSecuencia = index + 1;
    const idsDeEstePaso = new Set(
      loteEtapas.filter((le) => le.orden_secuencia === ordenSecuencia).map((le) => le.id)
    );
    const registrosDelPaso = registros.filter((r) => idsDeEstePaso.has(r.lote_etapa_id));
    if (!registrosDelPaso.length) continue;

    const primero = registrosDelPaso.reduce((min, r) => (r.created_at < min ? r.created_at : min), registrosDelPaso[0].created_at);
    const nombreEtapa = etapasCatalogo.find((e) => e.id === etapaId)?.nombre ?? "Etapa";
    eventos.push({ fecha: primero, titulo: `${nombreEtapa} iniciada` });
  }

  if (lote.fecha_fin_real) {
    eventos.push({ fecha: lote.fecha_fin_real, titulo: "Orden completada" });
  }

  for (const entrega of entregas) {
    eventos.push({ fecha: entrega.fecha_programada, titulo: "Entrega programada" });
    if (entrega.fecha_real) {
      eventos.push({ fecha: entrega.fecha_real, titulo: "Entrega realizada" });
    }
  }

  return eventos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}
