"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  eliminarConsumoMaterial,
  guardarConsumoEstimado,
  registrarConsumoReal,
} from "@/actions/materiales.actions";
import { Badge } from "@/components/ui/badge";
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

function FilaConsumo({
  consumo,
  loteId,
  nombreMaterial,
  unidadMaterial,
  esHeredado,
  onQuitar,
  bloqueado,
}: {
  consumo: Consumo;
  loteId: string;
  nombreMaterial: string;
  unidadMaterial: string;
  esHeredado: boolean;
  onQuitar: () => void;
  bloqueado: boolean;
}) {
  const valorGuardado = String(consumo.cantidad_real ?? 0);
  const [real, setReal] = useState(valorGuardado);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const registrado = !!consumo.cantidad_real_registrada_en;

  function guardar() {
    startTransition(async () => {
      const res = await registrarConsumoReal(consumo.id, loteId, Number(real) || 0);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Consumo real guardado");
      router.refresh();
    });
  }

  if (registrado) {
    return (
      <TableRow>
        <TableCell>{nombreMaterial}</TableCell>
        <TableCell>
          {consumo.cantidad_estimada ?? "—"} {unidadMaterial}
        </TableCell>
        <TableCell>
          {consumo.cantidad_real} {unidadMaterial}
        </TableCell>
        <TableCell className="text-right">
          <Badge variant="secondary">Registrado</Badge>
        </TableCell>
      </TableRow>
    );
  }

  // Este material se controla por unidad: el estimado/plan agregado de aquí
  // es independiente de qué rollos específicos se identifiquen en "Unidades
  // específicas" (eso es solo trazabilidad de qué rollo se usó, no
  // reemplaza este plan). registrarConsumoReal por el camino viejo lo sigue
  // rechazando materiales.actions.ts, así que aquí solo se puede quitar la
  // fila si ya no aplica.
  if (esHeredado) {
    return (
      <TableRow>
        <TableCell>{nombreMaterial}</TableCell>
        <TableCell>
          {consumo.cantidad_estimada ?? "—"} {unidadMaterial}
        </TableCell>
        <TableCell colSpan={2}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Este material también se identifica por rollo específico en &ldquo;Unidades
              específicas&rdquo;.
            </p>
            <Button variant="ghost" size="sm" disabled={pendiente || bloqueado} onClick={onQuitar}>
              Quitar
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{nombreMaterial}</TableCell>
      <TableCell>
        {consumo.cantidad_estimada ?? "—"} {unidadMaterial}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            className="w-24"
            value={real}
            onChange={(e) => setReal(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pendiente || bloqueado || real === valorGuardado}
            onClick={guardar}
          >
            Guardar
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" disabled={pendiente || bloqueado} onClick={onQuitar}>
          Quitar
        </Button>
      </TableCell>
    </TableRow>
  );
}

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
  const esPorUnidad = (id: string) => materiales.find((m) => m.id === id)?.seguimiento_por_unidad ?? false;
  // Los materiales con seguimiento_por_unidad se asignan por rollo/bolsa
  // específico en "Unidades específicas" -- pero eso es solo un identificador
  // de qué rollo se ocupó, no reemplaza el estimado/plan que ya se llevaba
  // aquí. Esta fila se sigue mostrando siempre, sin importar cuántas unidades
  // se hayan asignado a la orden: son dos cosas independientes a propósito.
  const consumosVisibles = consumos;
  const disponibles = materiales.filter(
    (m) => !m.seguimiento_por_unidad && !consumos.some((c) => c.material_id === m.id)
  );

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) {
      toast.error("Selecciona un material");
      return;
    }
    startTransition(async () => {
      const res = await guardarConsumoEstimado({ loteId, materialId, cantidadEstimada: Number(cantidadEstimada) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Insumo asignado");
      setMaterialId("");
      setCantidadEstimada("");
      router.refresh();
    });
  }

  function quitar(id: string) {
    startTransition(async () => {
      const res = await eliminarConsumoMaterial(id, loteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Insumo eliminado");
      router.refresh();
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
          {consumosVisibles.map((c) => (
            <FilaConsumo
              key={c.id}
              consumo={c}
              loteId={loteId}
              nombreMaterial={nombreMaterial(c.material_id)}
              unidadMaterial={unidadMaterial(c.material_id)}
              esHeredado={esPorUnidad(c.material_id)}
              bloqueado={pendiente}
              onQuitar={() => quitar(c.id)}
            />
          ))}
          {!consumosVisibles.length && (
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
