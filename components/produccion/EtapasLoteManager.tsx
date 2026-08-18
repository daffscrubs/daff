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

export function EtapasLoteManager({
  loteId,
  lote,
  loteEtapas,
  etapasCatalogo,
}: {
  loteId: string;
  lote: { folio: string; cantidad_planeada: number };
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
}) {
  const [etapaId, setEtapaId] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const yaUsadas = new Set(loteEtapas.map((e) => e.etapa_id));
  const disponibles = etapasCatalogo.filter((e) => e.activo && !yaUsadas.has(e.id));
  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";

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

  function quitar(id: string) {
    startTransition(async () => {
      try {
        await quitarEtapaLote(id, loteId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al quitar");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Etapas de {lote.folio}</h1>
        <p className="text-muted-foreground">
          Define el orden del proceso (ej. Corte → Confección → Terminado). Cantidad planeada: {lote.cantidad_planeada}.
        </p>
      </div>

      <ol className="space-y-2">
        {loteEtapas
          .slice()
          .sort((a, b) => a.orden_secuencia - b.orden_secuencia)
          .map((le, index, arr) => (
            <li key={le.id} className="flex items-center justify-between rounded-lg border p-3">
              <span>
                <span className="mr-2 text-muted-foreground">{le.orden_secuencia}.</span>
                {nombreEtapa(le.etapa_id)}
              </span>
              {index === arr.length - 1 && le.cantidad_completada === 0 && (
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => quitar(le.id)}>
                  Quitar
                </Button>
              )}
            </li>
          ))}
        {!loteEtapas.length && (
          <p className="text-sm text-muted-foreground">Aún no hay etapas configuradas.</p>
        )}
      </ol>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Select value={etapaId} onValueChange={(v) => setEtapaId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Agregar etapa..." />
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

      {!!loteEtapas.length && (
        <Button render={<Link href={`/produccion/${loteId}`} />} nativeButton={false}>
          Ver lote
        </Button>
      )}
    </div>
  );
}
