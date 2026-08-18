"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { agregarEtapaLote, quitarEtapaLote } from "@/actions/produccion.actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database.types";

type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];
type ItemOrden = Database["public"]["Tables"]["items_orden_produccion"]["Row"];

export function EtapasLoteManager({
  loteId,
  lote,
  loteEtapas,
  etapasCatalogo,
  items,
  modelos,
  tallas,
}: {
  loteId: string;
  lote: { folio: string };
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  items: ItemOrden[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
}) {
  const [etapaId, setEtapaId] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  // Los pasos son compartidos por todos los productos de la orden: se agrupan
  // por orden_secuencia (cada producto tiene su propia fila de lote_etapas,
  // pero todas comparten la misma etapa y el mismo número de paso).
  const pasos = [...new Map(loteEtapas.map((le) => [le.orden_secuencia, le])).values()].sort(
    (a, b) => a.orden_secuencia - b.orden_secuencia
  );

  const yaUsadas = new Set(pasos.map((p) => p.etapa_id));
  const disponibles = etapasCatalogo.filter((e) => e.activo && !yaUsadas.has(e.id));
  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";
  const nombreItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return "—";
    return `${modelos.find((m) => m.id === item.modelo_id)?.nombre ?? ""} ${tallas.find((t) => t.id === item.talla_id)?.codigo ?? ""}`.trim();
  };

  function agregar() {
    if (!etapaId) {
      toast.error("Selecciona una etapa");
      return;
    }
    startTransition(async () => {
      try {
        await agregarEtapaLote({ loteId, etapaId });
        setEtapaId("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al agregar");
      }
    });
  }

  function quitar(ordenSecuencia: number) {
    startTransition(async () => {
      try {
        await quitarEtapaLote(loteId, ordenSecuencia);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al quitar");
      }
    });
  }

  const ultimoPaso = pasos[pasos.length - 1];
  const ultimoPasoSinAvance = ultimoPaso
    ? loteEtapas.filter((le) => le.orden_secuencia === ultimoPaso.orden_secuencia).every((le) => le.cantidad_completada === 0)
    : false;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Procesos de {lote.folio}</h1>
        <p className="text-muted-foreground">
          Define el proceso (ej. Corte → Confección → Terminado). Se aplica a los {items.length} producto(s) de esta orden:{" "}
          {items.map((i) => nombreItem(i.id)).join(", ")}.
        </p>
      </div>

      <ol className="space-y-2">
        {pasos.map((paso, index) => (
          <li key={paso.orden_secuencia} className="flex items-center justify-between rounded-lg border p-3">
            <span>
              <span className="mr-2 text-muted-foreground">{paso.orden_secuencia}.</span>
              {nombreEtapa(paso.etapa_id)}
            </span>
            {index === pasos.length - 1 && ultimoPasoSinAvance && (
              <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => quitar(paso.orden_secuencia)}>
                Quitar
              </Button>
            )}
          </li>
        ))}
        {!pasos.length && (
          <p className="text-sm text-muted-foreground">Aún no hay etapas configuradas.</p>
        )}
      </ol>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Select
            items={disponibles.map((e) => ({ value: e.id, label: e.nombre }))}
            value={etapaId}
            onValueChange={(v) => setEtapaId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Agregar proceso..." />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={agregar} disabled={pendiente || !disponibles.length}>
          Agregar
        </Button>
      </div>

      {!!pasos.length && (
        <Button render={<Link href={`/produccion/${loteId}`} />} nativeButton={false}>
          Ver orden
        </Button>
      )}
    </div>
  );
}
