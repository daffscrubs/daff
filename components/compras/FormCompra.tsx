"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarCompra, crearCompra } from "@/actions/compras.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { CompraItemInput } from "@/lib/validaciones/compras.schema";
import { fechaISOLocal } from "@/lib/fechas";
import { formatearMoneda } from "@/lib/dinero";

type Material = Database["public"]["Tables"]["materiales"]["Row"];

export function FormCompra({
  materiales,
  compraId,
  valoresIniciales,
}: {
  materiales: Material[];
  compraId?: string;
  valoresIniciales?: {
    proveedor: string;
    fecha: string;
    notas: string;
    items: CompraItemInput[];
  };
}) {
  const modoEdicion = !!compraId;
  const [proveedor, setProveedor] = useState(valoresIniciales?.proveedor ?? "");
  const [fecha, setFecha] = useState(() => valoresIniciales?.fecha ?? fechaISOLocal(new Date()));
  const [notas, setNotas] = useState(valoresIniciales?.notas ?? "");
  const [items, setItems] = useState<CompraItemInput[]>(valoresIniciales?.items ?? []);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const unidadMaterial = (id: string) => materiales.find((m) => m.id === id)?.unidad_medida ?? "";

  function agregarItem() {
    setItems((prev) => [...prev, { materialId: "", cantidad: 1, costoUnitario: 0 }]);
  }

  function actualizarItem(index: number, cambios: Partial<CompraItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...cambios } : item)));
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.costoUnitario) || 0), 0);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) {
      toast.error("Agrega al menos un material");
      return;
    }
    startTransition(async () => {
      const res = modoEdicion
        ? await actualizarCompra(compraId, { proveedor, fecha, notas, items })
        : await crearCompra({ proveedor, fecha, notas, items });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(modoEdicion ? "Compra actualizada, se ajustó el inventario" : "Compra registrada, se actualizó el inventario");
      router.push("/compras");
    });
  }

  return (
    <form className="space-y-6" onSubmit={enviar}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="proveedor">Proveedor</Label>
          <Input id="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Materiales comprados</Label>
          <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
            Agregar material
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Costo unitario</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="min-w-48">
                  <ComboboxField
                    items={materiales.map((m) => ({ value: m.id, label: `${m.nombre} (${m.unidad_medida})` }))}
                    value={item.materialId}
                    onValueChange={(v) => actualizarItem(index, { materialId: v })}
                    placeholder="Buscar material..."
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="w-24"
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(index, { cantidad: Number(e.target.value) })}
                  />
                  <span className="ml-1 text-xs text-muted-foreground">{unidadMaterial(item.materialId)}</span>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24"
                    value={item.costoUnitario}
                    onChange={(e) => actualizarItem(index, { costoUnitario: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>{formatearMoneda((Number(item.cantidad) || 0) * (Number(item.costoUnitario) || 0))}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => quitarItem(index)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Agrega al menos un material.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {!!items.length && (
          <p className="text-right text-sm font-medium">
            Total: {formatearMoneda(total)}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Registrar compra"}
      </Button>
    </form>
  );
}
