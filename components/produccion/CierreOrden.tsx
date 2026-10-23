"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { cerrarOrdenProduccion, reabrirOrdenProduccion } from "@/actions/entregasProduccion.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Cerrar la orden a mano cuando hubo faltantes (necesita al menos una entrega) o reabrirla si se cerró por error.
export function CierreOrden({
  loteId,
  puedeCerrar,
  cerradaConFaltantes,
  motivoCierre,
  faltan,
}: {
  loteId: string;
  /** Hay entregas, la orden no está completa ni cancelada y faltan piezas. */
  puedeCerrar: boolean;
  cerradaConFaltantes: boolean;
  motivoCierre: string | null;
  faltan: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    startTransition(async () => {
      const res = await accion();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo completar la acción");
        return;
      }
      toast.success(exito);
      setAbierto(false);
      setMotivo("");
      router.refresh();
    });
  }

  if (cerradaConFaltantes) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Orden cerrada con faltantes.</strong> {motivoCierre}
          </span>
        </p>
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => reabrirOrdenProduccion(loteId), "Orden reabierta")}>
          Reabrir orden
        </Button>
      </div>
    );
  }
  if (!puedeCerrar) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Cerrar con faltantes
      </Button>
      <Dialog open={abierto} onOpenChange={(o) => !pendiente && setAbierto(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar la orden con faltantes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Faltan {faltan} pieza{faltan === 1 ? "" : "s"} por entregar. La orden quedará como completa pero marcada con faltantes, y ya no se podrán registrar entregas (puedes reabrirla después).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-cierre">¿Por qué se cierra con faltantes?</Label>
              <Input id="motivo-cierre" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. el maquilero ya no pudo terminar las 5 piezas" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)} disabled={pendiente}>
                Volver
              </Button>
              <Button type="button" onClick={() => ejecutar(() => cerrarOrdenProduccion(loteId, motivo), "Orden cerrada con faltantes")} disabled={pendiente || motivo.trim().length < 3}>
                {pendiente ? "Cerrando..." : "Cerrar orden"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
