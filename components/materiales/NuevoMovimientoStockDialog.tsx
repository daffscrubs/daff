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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Database, TipoMovimiento } from "@/types/database.types";

type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];

export function NuevoMovimientoStockDialog({
  modelos,
  tallas,
}: {
  modelos: Modelo[];
  tallas: Talla[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [modeloId, setModeloId] = useState("");
  const [tallaId, setTallaId] = useState("");
  const [tipo, setTipo] = useState<TipoMovimiento>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!modeloId || !tallaId) {
      toast.error("Selecciona modelo y talla");
      return;
    }
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
        setModeloId("");
        setTallaId("");
        setCantidad("");
        setMotivo("");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>Nuevo movimiento</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de stock</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={crear}>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select
              items={modelos.map((m) => ({ value: m.id, label: m.nombre }))}
              value={modeloId}
              onValueChange={(v) => setModeloId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Talla</Label>
            <Select
              items={tallas.map((t) => ({ value: t.id, label: t.codigo }))}
              value={tallaId}
              onValueChange={(v) => setTallaId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una talla" />
              </SelectTrigger>
              <SelectContent>
                {tallas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.codigo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="cantidadStock">
                Cantidad {tipo === "ajuste" && "(negativa para restar)"}
              </Label>
              <Input id="cantidadStock" type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivoStock">Motivo (opcional)</Label>
            <Input id="motivoStock" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar movimiento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
