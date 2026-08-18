"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearIncidencia, resolverIncidencia } from "@/actions/produccion.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database.types";

type Incidencia = Database["public"]["Tables"]["incidencias_produccion"]["Row"];

const GRAVEDAD_VARIANT = {
  baja: "secondary",
  media: "default",
  alta: "destructive",
} as const;

export function IncidenciasLote({
  loteId,
  incidencias,
  puedeResolver,
}: {
  loteId: string;
  incidencias: Incidencia[];
  puedeResolver: boolean;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [gravedad, setGravedad] = useState<"baja" | "media" | "alta">("baja");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function reportar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearIncidencia({ loteId, descripcion, gravedad });
        toast.success("Incidencia reportada");
        setDescripcion("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al reportar");
      }
    });
  }

  function resolver(id: string) {
    startTransition(async () => {
      try {
        await resolverIncidencia(id, loteId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al resolver");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={reportar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Describe la incidencia..."
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
        </div>
        <Select
          items={[
            { value: "baja", label: "Baja" },
            { value: "media", label: "Media" },
            { value: "alta", label: "Alta" },
          ]}
          value={gravedad}
          onValueChange={(v) => setGravedad((v ?? "baja") as typeof gravedad)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="baja">Baja</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pendiente}>Reportar</Button>
      </form>

      <ul className="space-y-2">
        {incidencias.map((inc) => (
          <li key={inc.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={GRAVEDAD_VARIANT[inc.gravedad as keyof typeof GRAVEDAD_VARIANT] ?? "secondary"}>
                  {inc.gravedad}
                </Badge>
                {inc.resuelto && <Badge variant="secondary">Resuelta</Badge>}
              </div>
              <p className="mt-1 text-sm">{inc.descripcion}</p>
            </div>
            {puedeResolver && !inc.resuelto && (
              <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => resolver(inc.id)}>
                Marcar resuelta
              </Button>
            )}
          </li>
        ))}
        {!incidencias.length && (
          <p className="text-sm text-muted-foreground">Sin incidencias reportadas.</p>
        )}
      </ul>
    </div>
  );
}
