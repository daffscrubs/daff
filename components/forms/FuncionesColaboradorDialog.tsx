"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { guardarFuncionesColaborador } from "@/actions/colaboradores.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database } from "@/types/database.types";

type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];

export function FuncionesColaboradorDialog({
  perfilId,
  nombreColaborador,
  etapasCatalogo,
  etapasAsignadasIniciales,
}: {
  perfilId: string;
  nombreColaborador: string;
  etapasCatalogo: EtapaProceso[];
  etapasAsignadasIniciales: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<string[]>(etapasAsignadasIniciales);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function alternar(etapaId: string) {
    setSeleccionadas((prev) =>
      prev.includes(etapaId) ? prev.filter((id) => id !== etapaId) : [...prev, etapaId]
    );
  }

  function guardar() {
    startTransition(async () => {
      try {
        await guardarFuncionesColaborador(perfilId, seleccionadas);
        toast.success("Funciones actualizadas");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Funciones</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Procesos de {nombreColaborador}</DialogTitle>
          <DialogDescription>
            Si no marcas ningún proceso, este colaborador podrá capturar avance en cualquier etapa.
            Si marcas al menos uno, solo podrá registrar piezas en los procesos seleccionados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {etapasCatalogo.map((etapa) => (
            <label key={etapa.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
              <input
                type="checkbox"
                checked={seleccionadas.includes(etapa.id)}
                onChange={() => alternar(etapa.id)}
                className="size-4"
              />
              <Label className="cursor-pointer font-normal">{etapa.nombre}</Label>
            </label>
          ))}
          {!etapasCatalogo.length && (
            <p className="text-sm text-muted-foreground">Sin procesos en el catálogo todavía.</p>
          )}
        </div>
        <Button onClick={guardar} disabled={pendiente} className="w-full">
          {pendiente ? "Guardando..." : "Guardar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
