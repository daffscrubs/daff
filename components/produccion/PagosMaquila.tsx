"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, Undo2 } from "lucide-react";
import { marcarPagoMaquila, reprogramarPagoMaquila } from "@/actions/entregasProduccion.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";

export interface PagoFila {
  id: string;
  maquileroId: string;
  maquilero: string;
  monto: number;
  fechaProgramada: string;
  estatus: "pendiente" | "pagado";
  fechaPagoReal: string | null;
  fechaEntrega: string;
  loteId: string;
  folio: string;
}

type Accion = { tipo: "pagar" | "reprogramar"; pago: PagoFila };

function TablaPagos({ pagos, hoy, onAccion, alDesmarcar }: { pagos: PagoFila[]; hoy: string; onAccion: (a: Accion) => void; alDesmarcar: (p: PagoFila) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Maquilero</TableHead>
            <TableHead>Orden</TableHead>
            <TableHead>Entrega</TableHead>
            <TableHead>Fecha de pago</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagos.map((p) => {
            const vencido = p.estatus === "pendiente" && p.fechaProgramada < hoy;
            return (
              <TableRow key={p.id}>
                <TableCell className="pl-4">
                  <Link href={`/produccion/maquileros/${p.maquileroId}`} className="font-medium hover:underline">
                    {p.maquilero}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/produccion/${p.loteId}`} className="hover:underline">
                    {p.folio}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatearFechaCorta(p.fechaEntrega)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {p.estatus === "pagado" ? (
                    <span className="text-emerald-600">Pagado {p.fechaPagoReal ? formatearFechaCorta(p.fechaPagoReal) : ""}</span>
                  ) : (
                    <span className={cn(vencido && "font-medium text-red-600")}>
                      {formatearFechaCorta(p.fechaProgramada)}
                      {vencido && <Badge variant="destructive" className="ml-2">Vencido</Badge>}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatearMoneda(p.monto)}</TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    {p.estatus === "pendiente" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => onAccion({ tipo: "reprogramar", pago: p })}>
                          <CalendarClock className="size-3.5" />
                          Reprogramar
                        </Button>
                        <Button size="sm" onClick={() => onAccion({ tipo: "pagar", pago: p })}>
                          <CheckCircle2 className="size-3.5" />
                          Marcar pagado
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => alDesmarcar(p)}>
                        <Undo2 className="size-3.5" />
                        Desmarcar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function PagosMaquila({
  hoy,
  finSemana,
  pagos,
}: {
  hoy: string;
  /** Domingo de esta semana ("YYYY-MM-DD"). */
  finSemana: string;
  pagos: PagoFila[];
}) {
  const router = useRouter();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [fecha, setFecha] = useState("");
  const [pendiente, startTransition] = useTransition();

  const pendientes = pagos.filter((p) => p.estatus === "pendiente").sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada));
  const urgentes = pendientes.filter((p) => p.fechaProgramada <= finSemana);
  const despues = pendientes.filter((p) => p.fechaProgramada > finSemana);
  const pagados = pagos.filter((p) => p.estatus === "pagado").sort((a, b) => (b.fechaPagoReal ?? "").localeCompare(a.fechaPagoReal ?? "")).slice(0, 30);
  const vencidoTotal = pendientes.filter((p) => p.fechaProgramada < hoy).reduce((acc, p) => acc + p.monto, 0);
  const semanaTotal = pendientes.filter((p) => p.fechaProgramada >= hoy && p.fechaProgramada <= finSemana).reduce((acc, p) => acc + p.monto, 0);
  const pendienteTotal = pendientes.reduce((acc, p) => acc + p.monto, 0);

  const porMaquilero = [...new Map(pendientes.map((p) => [p.maquileroId, p.maquilero])).entries()]
    .map(([id, nombre]) => {
      const suyos = pendientes.filter((p) => p.maquileroId === id);
      return {
        id,
        nombre,
        pagos: suyos.length,
        total: suyos.reduce((acc, p) => acc + p.monto, 0),
        vencido: suyos.filter((p) => p.fechaProgramada < hoy).reduce((acc, p) => acc + p.monto, 0),
        proxima: suyos[0].fechaProgramada,
      };
    })
    .sort((a, b) => b.total - a.total);

  function abrir(a: Accion) {
    setAccion(a);
    setFecha(a.tipo === "pagar" ? hoy : a.pago.fechaProgramada);
  }

  function confirmar() {
    if (!accion) return;
    startTransition(async () => {
      const res = accion.tipo === "pagar" ? await marcarPagoMaquila(accion.pago.id, true, fecha) : await reprogramarPagoMaquila(accion.pago.id, fecha);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(accion.tipo === "pagar" ? `Pago de ${formatearMoneda(accion.pago.monto)} marcado como pagado` : "Pago reprogramado");
      setAccion(null);
      router.refresh();
    });
  }

  function desmarcar(p: PagoFila) {
    startTransition(async () => {
      const res = await marcarPagoMaquila(p.id, false);
      if (!res.ok) return void toast.error(res.error);
      toast.success("El pago regresó a pendiente");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Vencido sin pagar</p>
          <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", vencidoTotal > 0 && "text-red-600")}>{formatearMoneda(vencidoTotal)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Vence esta semana</p>
          <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", semanaTotal > 0 && "text-amber-600")}>{formatearMoneda(semanaTotal)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total pendiente</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{formatearMoneda(pendienteTotal)}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vencidos y por vencer esta semana</h2>
        {urgentes.length ? (
          <TablaPagos pagos={urgentes} hoy={hoy} onAccion={abrir} alDesmarcar={desmarcar} />
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay pagos vencidos ni por vencer esta semana.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Total pendiente por maquilero</h2>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Maquilero</TableHead>
                <TableHead className="text-right">Pagos pendientes</TableHead>
                <TableHead>Próximo pago</TableHead>
                <TableHead className="text-right">Vencido</TableHead>
                <TableHead className="pr-4 text-right">Total pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porMaquilero.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">
                    <Link href={`/produccion/maquileros/${m.id}`} className="font-medium hover:underline">
                      {m.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{m.pagos}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatearFechaCorta(m.proxima)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", m.vencido > 0 ? "font-medium text-red-600" : "text-muted-foreground")}>{m.vencido > 0 ? formatearMoneda(m.vencido) : "—"}</TableCell>
                  <TableCell className="pr-4 text-right font-semibold tabular-nums">{formatearMoneda(m.total)}</TableCell>
                </TableRow>
              ))}
              {!porMaquilero.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No le debes nada a ningún maquilero.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {despues.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Más adelante</h2>
          <TablaPagos pagos={despues} hoy={hoy} onAccion={abrir} alDesmarcar={desmarcar} />
        </section>
      )}

      {pagados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pagados recientemente</h2>
          <TablaPagos pagos={pagados} hoy={hoy} onAccion={abrir} alDesmarcar={desmarcar} />
        </section>
      )}

      <Dialog open={!!accion} onOpenChange={(o) => !o && !pendiente && setAccion(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{accion?.tipo === "pagar" ? "Marcar como pagado" : "Reprogramar pago"}</DialogTitle>
          </DialogHeader>
          {accion && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {accion.pago.maquilero} · {accion.pago.folio} · <strong className="text-foreground">{formatearMoneda(accion.pago.monto)}</strong>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fecha-pago">{accion.tipo === "pagar" ? "Fecha en que se pagó" : "Nueva fecha de pago"}</Label>
                <Input id="fecha-pago" type="date" value={fecha} max={accion.tipo === "pagar" ? hoy : undefined} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAccion(null)} disabled={pendiente}>
                  Cancelar
                </Button>
                <Button type="button" onClick={confirmar} disabled={pendiente || !fecha}>
                  {pendiente ? "Guardando..." : accion.tipo === "pagar" ? "Marcar pagado" : "Reprogramar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
