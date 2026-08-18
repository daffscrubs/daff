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
type ItemOrden = Database["public"]["Tables"]["items_orden_produccion"]["Row"];

export function AjusteAvanceForm({
  loteId,
  loteEtapas,
  etapasCatalogo,
  colaboradores,
  items,
  modelos,
  tallas,
}: {
  loteId: string;
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  colaboradores: Perfil[];
  items: ItemOrden[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
}) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [loteEtapaId, setLoteEtapaId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";
  const etiquetaLoteEtapa = (le: LoteEtapa) => {
    const item = items.find((i) => i.id === le.item_orden_id);
    const nombreModelo = item ? modelos.find((m) => m.id === item.modelo_id)?.nombre : "";
    const codigoTalla = item ? tallas.find((t) => t.id === item.talla_id)?.codigo : "";
    return `${nombreModelo ?? ""} ${codigoTalla ?? ""} · ${nombreEtapa(le.etapa_id)}`.trim();
  };

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
        <Select
          items={colaboradores.map((c) => ({ value: c.id, label: c.nombre_completo }))}
          value={colaboradorId}
          onValueChange={(v) => setColaboradorId(v ?? "")}
        >
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
        <Label>Proceso</Label>
        <Select
          items={loteEtapas.map((le) => ({ value: le.id, label: etiquetaLoteEtapa(le) }))}
          value={loteEtapaId}
          onValueChange={(v) => setLoteEtapaId(v ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona producto y etapa" />
          </SelectTrigger>
          <SelectContent>
            {loteEtapas.map((le) => (
              <SelectItem key={le.id} value={le.id}>{etiquetaLoteEtapa(le)}</SelectItem>
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
