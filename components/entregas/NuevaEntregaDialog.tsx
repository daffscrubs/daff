"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearEntrega } from "@/actions/entregas.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Database } from "@/types/database.types";

type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];

export function NuevaEntregaDialog({ pedidosListos }: { pedidosListos: Pedido[] }) {
  const [abierto, setAbierto] = useState(false);
  const [pedidoId, setPedidoId] = useState("");
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [notas, setNotas] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!pedidoId) {
      toast.error("Selecciona un pedido");
      return;
    }
    startTransition(async () => {
      try {
        await crearEntrega({ pedidoId, fechaProgramada, notas });
        toast.success("Entrega programada");
        setPedidoId("");
        setFechaProgramada("");
        setNotas("");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al programar");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>Programar entrega</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Programar entrega</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={crear}>
          <div className="space-y-2">
            <Label>Pedido listo para entregar</Label>
            <Select value={pedidoId} onValueChange={(v) => setPedidoId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un pedido" />
              </SelectTrigger>
              <SelectContent>
                {pedidosListos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.folio}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaProgramada">Fecha programada</Label>
            <Input
              id="fechaProgramada"
              type="date"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={pendiente}>
            {pendiente ? "Programando..." : "Programar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
