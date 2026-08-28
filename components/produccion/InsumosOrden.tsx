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

  // El material se cambió a seguimiento por unidad DESPUÉS de que este
  // consumo agregado ya existía: el trigger de la migración 0023 sigue
  // sincronizando esta fila si además se asignan unidades específicas, pero
  // registrar el consumo real por aquí (el camino viejo) ya lo rechaza
  // materiales.actions.ts. La única acción válida es quitarlo y, si aplica,
  // volver a capturarlo desde "Unidades específicas".
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
              Este material ahora se controla por unidad — quítalo y regístralo desde &ldquo;Unidades
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
  // específico (ver UnidadesOrden), no como cantidad agregada aquí. Pero un
  // consumo agregado ya existente para un material que se cambió a
  // seguimiento por unidad DESPUÉS de capturarlo (un registro "heredado") se
  // sigue mostrando aquí para poder quitarlo — esconderlo del todo lo dejaría
  // invisible e imposible de limpiar.
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
          {consumos.map((c) => (
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
