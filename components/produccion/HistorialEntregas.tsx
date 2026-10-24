"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelarEntregaProduccion } from "@/actions/entregasProduccion.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaCorta } from "@/lib/fechas";
import type { EntregaConItems } from "@/lib/produccion/entregas";
import { cn } from "@/lib/utils";

export interface PagoEntrega {
  monto: number;
  estatus: string;
  fechaProgramada: string;
  fechaPagoReal: string | null;
}

// Todas las entregas de la orden (más reciente arriba): quién entregó y recibió, qué piezas, y, para quien ve montos,
// su pago. Una entrega se puede cancelar mientras su pago no esté marcado como pagado.
export function HistorialEntregas({
  loteId,
  entregas,
  nombrePerfil,
  nombreMaquilero,
  textoItem,
  pagos,
  puedeCancelar,
}: {
  loteId: string;
  entregas: EntregaConItems[];
  nombrePerfil: Record<string, string>;
  nombreMaquilero: Record<string, string>;
  textoItem: Record<string, string>;
  /** Solo para quien ve montos; null = no mostrar pagos. */
  pagos: Record<string, PagoEntrega> | null;
  puedeCancelar: boolean;
}) {
  const router = useRouter();
  const [cancelando, setCancelando] = useState<EntregaConItems | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pendiente, startTransition] = useTransition();

  function confirmarCancelacion() {
    if (!cancelando) return;
    startTransition(async () => {
      const res = await cancelarEntregaProduccion(cancelando.id, motivo, loteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Entrega cancelada: se revirtió el inventario");
      setCancelando(null);
      setMotivo("");
      router.refresh();
    });
  }

  if (!entregas.length) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no hay entregas registradas.</p>;
  }

  return (
    <>
      <ul className="space-y-3">
        {entregas.map((e) => {
          const cancelada = e.estatus === "cancelada";
          const pago = pagos?.[e.id];
          const total = e.entrega_produccion_items.reduce((acc, i) => acc + i.cantidad, 0);
          const pagado = pago?.estatus === "pagado";
          return (
            <li key={e.id} className={cn("rounded-xl border p-4", cancelada && "bg-muted/40")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className={cn("font-medium", cancelada && "text-muted-foreground line-through")}>
                    {formatearFechaCorta(e.fecha)} · {total} pieza{total === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Entregó {e.maquilero_id ? nombreMaquilero[e.maquilero_id] ?? "maquilero" : nombrePerfil[e.entregado_por ?? ""] ?? "—"} · recibió {nombrePerfil[e.recibido_por] ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {cancelada && <Badge variant="secondary">Cancelada</Badge>}
                  {pago && !cancelada && (
                    <Badge className={pagado ? "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}>
                      {pagado ? `Pagado ${pago.fechaPagoReal ? formatearFechaCorta(pago.fechaPagoReal) : ""}` : `Pago ${formatearMoneda(pago.monto)} · vence ${formatearFechaCorta(pago.fechaProgramada)}`}
                    </Badge>
                  )}
                  {puedeCancelar && !cancelada && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCancelando(e)}>
                      Cancelar entrega
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {e.entrega_produccion_items.map((i) => (
                  <span key={i.item_orden_id} className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {textoItem[i.item_orden_id] ?? "—"} <strong className="ml-1">×{i.cantidad}</strong>
                  </span>
                ))}
              </div>
              {e.notas && <p className="mt-2 text-sm text-muted-foreground">Nota: {e.notas}</p>}
              {cancelada && e.motivo_cancelacion && <p className="mt-2 text-sm text-muted-foreground">Motivo de la cancelación: {e.motivo_cancelacion}</p>}
            </li>
          );
        })}
      </ul>

      <Dialog open={!!cancelando} onOpenChange={(o) => !o && !pendiente && setCancelando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar entrega del {cancelando ? formatearFechaCorta(cancelando.fecha) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Las piezas salen del inventario y, si es de maquila, también se cancela su pago. Solo se puede si el pago no está marcado como pagado y las piezas no se han vendido.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-entrega">Motivo</Label>
              <Input id="motivo-entrega" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se capturó en la orden equivocada" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCancelando(null)} disabled={pendiente}>
                Volver
              </Button>
              <Button type="button" variant="destructive" onClick={confirmarCancelacion} disabled={pendiente || motivo.trim().length < 3}>
                {pendiente ? "Cancelando..." : "Cancelar entrega"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
