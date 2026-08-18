"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearAjusteAvance } from "@/actions/avance.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];

export function AjusteAvanceForm({
  loteId,
  loteEtapas,
  etapasCatalogo,
  colaboradores,
}: {
  loteId: string;
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  colaboradores: Perfil[];
}) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [loteEtapaId, setLoteEtapaId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearAjusteAvance({
          colaboradorId,
          loteId,
          loteEtapaId,
          cantidad: Number(cantidad),
          observaciones,
        });
        toast.success("Ajuste aplicado");
        setCantidad("");
        setObservaciones("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al ajustar");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Colaborador</Label>
        <Select value={colaboradorId} onValueChange={(v) => setColaboradorId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona colaborador" />
          </SelectTrigger>
          <SelectContent>
            {colaboradores.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nombre_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Etapa</Label>
        <Select value={loteEtapaId} onValueChange={(v) => setLoteEtapaId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona etapa" />
          </SelectTrigger>
          <SelectContent>
            {loteEtapas.map((le) => (
              <SelectItem key={le.id} value={le.id}>{nombreEtapa(le.etapa_id)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cantidadAjuste">Cantidad (negativa para restar)</Label>
        <Input
          id="cantidadAjuste"
          type="number"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="motivoAjuste">Motivo del ajuste</Label>
        <Textarea
          id="motivoAjuste"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={pendiente} className="sm:col-span-2">
        {pendiente ? "Aplicando..." : "Aplicar ajuste"}
      </Button>
    </form>
  );
}
