"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { agregarPlantillaItem, eliminarPlantillaItem } from "@/actions/catalogos.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type PlantillaItem = Database["public"]["Tables"]["plantilla_items"]["Row"];
type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type ModeloTalla = Database["public"]["Tables"]["modelo_tallas"]["Row"];

export function PlantillaItemsManager({
  plantillaId,
  items,
  modelos,
  tallas,
  modeloTallas,
}: {
  plantillaId: string;
  items: PlantillaItem[];
  modelos: Modelo[];
  tallas: Talla[];
  modeloTallas: ModeloTalla[];
}) {
  const [modeloId, setModeloId] = useState("");
  const [tallaId, setTallaId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombre = (id: string, lista: { id: string; nombre?: string; codigo?: string }[]) =>
    lista.find((x) => x.id === id)?.nombre ?? lista.find((x) => x.id === id)?.codigo ?? "—";

  const tallasDisponibles = (() => {
    const asignadas = modeloTallas.filter((mt) => mt.modelo_id === modeloId).map((mt) => mt.talla_id);
    if (!asignadas.length) return tallas;
    return tallas.filter((t) => asignadas.includes(t.id));
  })();

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!modeloId || !tallaId) {
      toast.error("Selecciona modelo y talla");
      return;
    }
    startTransition(async () => {
      const res = await agregarPlantillaItem({
        plantillaId,
        modeloId,
        tallaId,
        cantidadSugerida: cantidad ? Number(cantidad) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ítem agregado");
      setModeloId("");
      setTallaId("");
      setCantidad("");
      router.refresh();
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarPlantillaItem(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={agregar} className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-4 sm:items-end">
        <div className="space-y-2">
          <Label>Modelo</Label>
          <ComboboxField
            items={modelos.map((m) => ({ value: m.id, label: m.nombre }))}
            value={modeloId}
            onValueChange={(v) => { setModeloId(v); setTallaId(""); }}
            placeholder="Buscar modelo..."
          />
        </div>
        <div className="space-y-2">
          <Label>Talla</Label>
          <Select
            items={tallasDisponibles.map((t) => ({ value: t.id, label: t.codigo }))}
            value={tallaId}
            onValueChange={(v) => setTallaId(v ?? "")}
            disabled={!modeloId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Talla" />
            </SelectTrigger>
            <SelectContent>
              {tallasDisponibles.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.codigo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cantidad">Cantidad sugerida</Label>
          <Input id="cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Agregando..." : "Agregar ítem"}
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Modelo</TableHead>
            <TableHead>Talla</TableHead>
            <TableHead>Cantidad sugerida</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{nombre(item.modelo_id, modelos)}</TableCell>
              <TableCell>{nombre(item.talla_id, tallas)}</TableCell>
              <TableCell>{item.cantidad_sugerida ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => eliminar(item.id)}>
                  Eliminar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!items.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin ítems todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
