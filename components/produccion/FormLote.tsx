"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearLote } from "@/actions/produccion.actions";
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
import type { Database } from "@/types/database.types";

type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];
type ItemPedido = Database["public"]["Tables"]["items_pedido"]["Row"];
type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type Variante = Database["public"]["Tables"]["variantes"]["Row"];

export function FormLote({
  pedidos,
  items,
  modelos,
  tallas,
  variantes,
}: {
  pedidos: Pedido[];
  items: ItemPedido[];
  modelos: Modelo[];
  tallas: Talla[];
  variantes: Variante[];
}) {
  const [pedidoId, setPedidoId] = useState("");
  const [itemId, setItemId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [tallaId, setTallaId] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [cantidadPlaneada, setCantidadPlaneada] = useState("");
  const [fechaFinEstimada, setFechaFinEstimada] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const itemsDelPedido = useMemo(
    () => items.filter((i) => i.pedido_id === pedidoId),
    [items, pedidoId]
  );

  function elegirItem(id: string) {
    setItemId(id);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setModeloId(item.modelo_id);
    setTallaId(item.talla_id);
    setVarianteId(item.variante_id ?? "");
    setCantidadPlaneada(String(item.cantidad));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!modeloId || !tallaId || !cantidadPlaneada) {
      toast.error("Completa modelo, talla y cantidad");
      return;
    }
    startTransition(async () => {
      try {
        const id = await crearLote({
          pedidoId: pedidoId || null,
          modeloId,
          tallaId,
          varianteId: varianteId || null,
          cantidadPlaneada: Number(cantidadPlaneada),
          fechaFinEstimada: fechaFinEstimada || undefined,
        });
        toast.success("Lote creado");
        router.push(`/produccion/${id}/etapas`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear el lote");
      }
    });
  }

  return (
    <form className="max-w-2xl space-y-4" onSubmit={enviar}>
      <div className="space-y-2">
        <Label>Pedido (opcional)</Label>
        <Select
          value={pedidoId}
          onValueChange={(v) => {
            setPedidoId(v ?? "");
            setItemId("");
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sin pedido asociado" />
          </SelectTrigger>
          <SelectContent>
            {pedidos.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.folio}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!!pedidoId && (
        <div className="space-y-2">
          <Label>Producto del pedido</Label>
          <Select value={itemId} onValueChange={(v) => v && elegirItem(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona el producto a producir" />
            </SelectTrigger>
            <SelectContent>
              {itemsDelPedido.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {modelos.find((m) => m.id === item.modelo_id)?.nombre} —{" "}
                  {tallas.find((t) => t.id === item.talla_id)?.codigo} — {item.cantidad} pzas
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Select value={modeloId} onValueChange={(v) => setModeloId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Modelo" />
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
          <Select value={tallaId} onValueChange={(v) => setTallaId(v ?? "")}>
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
          <Select value={varianteId} onValueChange={(v) => setVarianteId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin variante" />
            </SelectTrigger>
            <SelectContent>
              {variantes.filter((v) => v.modelo_id === modeloId).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {[v.color, v.tela, v.diseno].filter(Boolean).join(" / ") || v.sku || "Variante"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cantidadPlaneada">Cantidad a producir</Label>
          <Input
            id="cantidadPlaneada"
            type="number"
            min={1}
            value={cantidadPlaneada}
            onChange={(e) => setCantidadPlaneada(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaFinEstimada">Fecha estimada de fin (opcional)</Label>
          <Input
            id="fechaFinEstimada"
            type="date"
            value={fechaFinEstimada}
            onChange={(e) => setFechaFinEstimada(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Creando..." : "Crear lote y configurar etapas"}
      </Button>
    </form>
  );
}
