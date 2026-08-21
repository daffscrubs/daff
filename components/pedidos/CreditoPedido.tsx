"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registrarPagoPedido } from "@/actions/pedidos.actions";
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
import { formatearMoneda } from "@/lib/dinero";
import { fechaISOLocal, formatearFechaSolo, sumarDias } from "@/lib/fechas";
import type { Database } from "@/types/database.types";

type Pago = Database["public"]["Tables"]["pagos_pedido"]["Row"];

export function CreditoPedido({
  pedidoId,
  fechaPedido,
  diasCredito,
  total,
  pagos,
}: {
  pedidoId: string;
  fechaPedido: string;
  diasCredito: number;
  total: number;
  pagos: Pago[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => fechaISOLocal(new Date()));
  const [notas, setNotas] = useState("");
  const [pendiente, startTransition] = useTransition();

  const pagado = pagos.reduce((acc, p) => acc + p.monto, 0);
  const saldo = Math.max(total - pagado, 0);
  const esCredito = diasCredito > 0;
  const fechaLimite = esCredito ? sumarDias(fechaPedido, diasCredito) : null;
  const vencido = !!fechaLimite && saldo > 0 && fechaLimite < fechaISOLocal(new Date());

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await registrarPagoPedido({ pedidoId, monto: Number(monto), fecha, notas });
        toast.success("Pago registrado");
        setAbierto(false);
        setMonto("");
        setNotas("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar el pago");
      }
    });
  }

  if (!total) return null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Crédito y pagos</h2>
          <p className="text-sm text-muted-foreground">
            {esCredito ? `Crédito a ${diasCredito} días` : "Contado"}
            {fechaLimite && ` · Vence ${formatearFechaSolo(fechaLimite)}`}
          </p>
        </div>
        {vencido && <Badge variant="destructive">Vencido</Badge>}
        {!vencido && saldo === 0 && <Badge variant="secondary">Pagado</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">{formatearMoneda(total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="text-lg font-semibold">{formatearMoneda(pagado)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Saldo pendiente</p>
          <p className={`text-lg font-semibold ${saldo > 0 ? "text-destructive" : ""}`}>{formatearMoneda(saldo)}</p>
        </div>
      </div>

      {saldo > 0 && (
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button size="sm" />}>Registrar cobro</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar cobro</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={registrar}>
              <div className="space-y-2">
                <Label htmlFor="monto">Monto</Label>
                <Input
                  id="monto"
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={saldo}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Saldo pendiente: {formatearMoneda(saldo)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaPago">Fecha</Label>
                <Input id="fechaPago" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notasPago">Notas (opcional)</Label>
                <Input id="notasPago" value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={pendiente}>
                {pendiente ? "Guardando..." : "Guardar pago"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {!!pagos.length && (
        <div>
          <p className="mb-2 text-sm font-medium">Pagos registrados</p>
          <ul className="space-y-1">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatearFechaSolo(p.fecha)}
                  {p.notas ? ` · ${p.notas}` : ""}
                </span>
                <span className="font-medium">{formatearMoneda(p.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
