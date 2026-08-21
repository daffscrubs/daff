"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { entregarPedido } from "@/actions/entregas.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatearFechaHora } from "@/lib/fechas";
import type { EstatusPedido } from "@/types/database.types";

export function EntregaPedido({
  pedidoId,
  estatus,
  fechaEntrega,
  recibidoPor,
}: {
  pedidoId: string;
  estatus: EstatusPedido;
  fechaEntrega: string | null;
  recibidoPor: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombreRecibe, setNombreRecibe] = useState("");
  const [pendiente, startTransition] = useTransition();

  const entregado = estatus === "entregado";
  const listo = estatus === "listo";

  function entregar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await entregarPedido({ pedidoId, recibidoPor: nombreRecibe });
        toast.success("Pedido entregado");
        setAbierto(false);
        setNombreRecibe("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al entregar el pedido");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Entrega</h2>
          {entregado ? (
            <p className="text-sm text-muted-foreground">
              {fechaEntrega && `Entregado el ${formatearFechaHora(fechaEntrega)}`}
              {recibidoPor && ` · Recibió: ${recibidoPor}`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {listo ? "El pedido está listo para entregarse." : "Disponible cuando el pedido esté listo."}
            </p>
          )}
        </div>
        {entregado ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300">
            Entregado
          </Badge>
        ) : (
          <Badge variant="secondary">No entregado</Badge>
        )}
      </div>

      {!entregado && (
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button size="sm" disabled={!listo} />}>
            <PackageCheck className="size-4" />
            Entregar pedido
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Entregar pedido</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={entregar}>
              <div className="space-y-2">
                <Label htmlFor="nombreRecibe">Recibió (opcional)</Label>
                <Input
                  id="nombreRecibe"
                  value={nombreRecibe}
                  onChange={(e) => setNombreRecibe(e.target.value)}
                  placeholder="Nombre de quién recibe"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pendiente}>
                {pendiente ? "Guardando..." : "Confirmar entrega"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
