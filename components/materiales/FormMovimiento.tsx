"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearMovimiento } from "@/actions/materiales.actions";
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

export function FormMovimiento({ materialId }: { materialId: string }) {
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const cantidadNum = Number(cantidad);
      const res = await crearMovimiento({
        materialId,
        tipo,
        cantidad: tipo === "ajuste" ? cantidadNum : Math.abs(cantidadNum),
        motivo,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Movimiento registrado");
      setCantidad("");
      setMotivo("");
      router.refresh();
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
        <Label htmlFor="cantidadMovimiento">
          Cantidad {tipo === "ajuste" && "(negativa para restar)"}
        </Label>
        <Input
          id="cantidadMovimiento"
          type="number"
          step="0.01"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-1">
        <Label htmlFor="motivoMovimiento">Motivo</Label>
        <Input id="motivoMovimiento" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Registrar movimiento"}
      </Button>
    </form>
  );
}
