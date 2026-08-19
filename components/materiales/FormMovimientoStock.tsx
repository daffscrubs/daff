"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearMovimientoStockProducto } from "@/actions/stockProductos.actions";
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
import type { TipoMovimiento } from "@/types/database.types";

export function FormMovimientoStock({
  modeloId,
  tallaId,
}: {
  modeloId: string;
  tallaId: string;
}) {
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearMovimientoStockProducto({
          modeloId,
          tallaId,
          tipo,
          cantidad: Number(cantidad),
          motivo,
        });
        toast.success("Movimiento registrado");
        setCantidad("");
        setMotivo("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-4 sm:items-end">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          items={[
            { value: "entrada", label: "Entrada" },
            { value: "salida", label: "Salida" },
            { value: "ajuste", label: "Ajuste" },
          ]}
          value={tipo}
          onValueChange={(v) => setTipo((v ?? "entrada") as TipoMovimiento)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="entrada">Entrada</SelectItem>
            <SelectItem value="salida">Salida</SelectItem>
            <SelectItem value="ajuste">Ajuste</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cantidadStockDetalle">
          Cantidad {tipo === "ajuste" && "(negativa para restar)"}
        </Label>
        <Input id="cantidadStockDetalle" type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
      </div>
      <div className="space-y-2 sm:col-span-1">
        <Label htmlFor="motivoStockDetalle">Motivo</Label>
        <Input id="motivoStockDetalle" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Registrar movimiento"}
      </Button>
    </form>
  );
}
