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
type Variante = Database["public"]["Tables"]["variantes"]["Row"];

export function PlantillaItemsManager({
  plantillaId,
  items,
  modelos,
  tallas,
  variantes,
}: {
  plantillaId: string;
  items: PlantillaItem[];
  modelos: Modelo[];
  tallas: Talla[];
  variantes: Variante[];
}) {
  const [modeloId, setModeloId] = useState("");
  const [tallaId, setTallaId] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombre = (id: string, lista: { id: string; nombre?: string; codigo?: string }[]) =>
    lista.find((x) => x.id === id)?.nombre ?? lista.find((x) => x.id === id)?.codigo ?? "—";

  const variantesDelModelo = variantes.filter((v) => v.modelo_id === modeloId);

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!modeloId || !tallaId) {
      toast.error("Selecciona modelo y talla");
      return;
    }
    startTransition(async () => {
      try {
        await agregarPlantillaItem({
          plantillaId,
          modeloId,
          tallaId,
          varianteId: varianteId || null,
          cantidadSugerida: cantidad ? Number(cantidad) : undefined,
        });
        toast.success("Ítem agregado");
        setModeloId("");
        setTallaId("");
        setVarianteId("");
        setCantidad("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al agregar");
      }
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      try {
        await eliminarPlantillaItem(id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={agregar} className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-5 sm:items-end">
        <div className="space-y-2">
          <Label>Modelo</Label>
          <ComboboxField
            items={modelos.map((m) => ({ value: m.id, label: m.nombre }))}
            value={modeloId}
            onValueChange={(v) => { setModeloId(v); setVarianteId(""); }}
            placeholder="Buscar modelo..."
          />
        </div>
        <div className="space-y-2">
          <Label>Talla</Label>
          <Select
            items={tallas.map((t) => ({ value: t.id, label: t.codigo }))}
            value={tallaId}
            onValueChange={(v) => setTallaId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Talla" />
            </SelectTrigger>
            <SelectContent>
              {tallas.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.codigo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Variante (opcional)</Label>
          <Select
            items={variantesDelModelo.map((v) => ({
              value: v.id,
              label: [v.color, v.tela, v.diseno].filter(Boolean).join(" / ") || v.sku || "Variante",
            }))}
            value={varianteId}
            onValueChange={(v) => setVarianteId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin variante" />
            </SelectTrigger>
            <SelectContent>
              {variantesDelModelo.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {[v.color, v.tela, v.diseno].filter(Boolean).join(" / ") || v.sku || "Variante"}
                </SelectItem>
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
            <TableHead>Variante</TableHead>
            <TableHead>Cantidad sugerida</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{nombre(item.modelo_id, modelos)}</TableCell>
              <TableCell>{nombre(item.talla_id, tallas)}</TableCell>
              <TableCell>
                {item.variante_id
                  ? variantes.find((v) => v.id === item.variante_id)?.color ?? "—"
                  : "—"}
              </TableCell>
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
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin ítems todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
