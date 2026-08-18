"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  eliminarConsumoMaterial,
  guardarConsumoEstimado,
  registrarConsumoReal,
} from "@/actions/materiales.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboboxField } from "@/components/ui/combobox-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database.types";

type Consumo = Database["public"]["Tables"]["consumo_material_orden"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];

export function InsumosOrden({
  loteId,
  consumos,
  materiales,
}: {
  loteId: string;
  consumos: Consumo[];
  materiales: Material[];
}) {
  const [materialId, setMaterialId] = useState("");
  const [cantidadEstimada, setCantidadEstimada] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombreMaterial = (id: string) => materiales.find((m) => m.id === id)?.nombre ?? "—";
  const unidadMaterial = (id: string) => materiales.find((m) => m.id === id)?.unidad_medida ?? "";
  const disponibles = materiales.filter((m) => !consumos.some((c) => c.material_id === m.id));

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) {
      toast.error("Selecciona un material");
      return;
    }
    startTransition(async () => {
      try {
        await guardarConsumoEstimado({ loteId, materialId, cantidadEstimada: Number(cantidadEstimada) });
        toast.success("Insumo asignado");
        setMaterialId("");
        setCantidadEstimada("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al asignar");
      }
    });
  }

  function quitar(id: string) {
    startTransition(async () => {
      try {
        await eliminarConsumoMaterial(id, loteId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al quitar");
      }
    });
  }

  function actualizarReal(id: string, valor: string) {
    startTransition(async () => {
      try {
        await registrarConsumoReal(id, loteId, Number(valor) || 0);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <ComboboxField
            items={disponibles.map((m) => ({ value: m.id, label: `${m.nombre} (${m.unidad_medida})` }))}
            value={materialId}
            onValueChange={setMaterialId}
            placeholder="Buscar material..."
          />
        </div>
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="Cantidad estimada"
          className="sm:w-40"
          value={cantidadEstimada}
          onChange={(e) => setCantidadEstimada(e.target.value)}
          required
        />
        <Button type="submit" disabled={pendiente}>Asignar insumo</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Estimado</TableHead>
            <TableHead>Real</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {consumos.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{nombreMaterial(c.material_id)}</TableCell>
              <TableCell>{c.cantidad_estimada ?? "—"} {unidadMaterial(c.material_id)}</TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-28"
                  defaultValue={c.cantidad_real}
                  onBlur={(e) => e.target.value !== String(c.cantidad_real) && actualizarReal(c.id, e.target.value)}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => quitar(c.id)}>
                  Quitar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!consumos.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin insumos asignados todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
