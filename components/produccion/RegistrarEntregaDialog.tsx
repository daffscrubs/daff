"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";
import { registrarEntregaProduccion } from "@/actions/entregasProduccion.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaCorta, sumarDias } from "@/lib/fechas";
import type { ResumenItem } from "@/lib/produccion/entregas";
import { cn } from "@/lib/utils";

interface Persona {
  id: string;
  nombre: string;
}

// Registra una entrega (parcial o total) de la orden: cuántas piezas de cada talla se entregaron hoy. Las piezas
// entran a inventario al guardar. En maquila también se fija la fecha de pago (por defecto entrega + 15 días).
export function RegistrarEntregaDialog({
  loteId,
  folio,
  tipo,
  maquilero,
  resumen,
  colaboradores,
  receptores,
  usuarioActualId,
  hoy,
  preciosPorModelo,
}: {
  loteId: string;
  folio: string;
  tipo: "interna" | "maquila";
  maquilero: string | null;
  resumen: ResumenItem[];
  colaboradores: Persona[];
  receptores: Persona[];
  usuarioActualId: string;
  /** "YYYY-MM-DD" de hoy en la hora de México. */
  hoy: string;
  /** Solo para quien ve montos: precio por pieza de cada modelo, para mostrar el pago estimado. */
  preciosPorModelo: Record<string, number> | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [fecha, setFecha] = useState(hoy);
  const [entregadoPor, setEntregadoPor] = useState("");
  const [recibidoPor, setRecibidoPor] = useState(receptores.some((r) => r.id === usuarioActualId) ? usuarioActualId : "");
  const [fechaPago, setFechaPago] = useState(sumarDias(hoy, 15));
  const [fechaPagoEditada, setFechaPagoEditada] = useState(false);
  const [notas, setNotas] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  const pendientes = resumen.filter((r) => r.pendiente > 0);
  const numero = (itemId: string) => {
    const n = Number(cantidades[itemId] ?? "");
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const exceso = pendientes.find((r) => numero(r.itemId) > r.pendiente);
  const invalido = pendientes.find((r) => (cantidades[r.itemId] ?? "").trim() !== "" && !/^\d+$/.test(cantidades[r.itemId].trim()));
  const totalPiezas = pendientes.reduce((acc, r) => acc + numero(r.itemId), 0);
  const pagoEstimado = preciosPorModelo
    ? pendientes.reduce((acc, r) => acc + numero(r.itemId) * (preciosPorModelo[r.modeloId] ?? 0), 0)
    : null;
  const faltaPrecio = tipo === "maquila" && preciosPorModelo ? pendientes.find((r) => numero(r.itemId) > 0 && preciosPorModelo[r.modeloId] === undefined) : undefined;

  function cambiarFecha(valor: string) {
    setFecha(valor);
    // La fecha de pago se sugiere sola (entrega + 15 días) hasta que alguien la cambie a mano.
    if (!fechaPagoEditada && valor) setFechaPago(sumarDias(valor, 15));
  }

  function guardar() {
    if (!totalPiezas) return void toast.error("Captura cuántas piezas se entregaron (al menos una talla).");
    if (invalido) return void toast.error(`Revisa la cantidad de ${invalido.modelo} ${invalido.talla}: debe ser un número entero.`);
    if (exceso) return void toast.error(`${exceso.modelo} talla ${exceso.talla}: solo faltan ${exceso.pendiente} por entregar. Si entregaron de más, aumenta primero la cantidad de la orden.`);
    if (tipo === "interna" && !entregadoPor) return void toast.error("Elige quién entrega.");
    if (!recibidoPor) return void toast.error("Elige quién recibe.");
    startTransition(async () => {
      const res = await registrarEntregaProduccion({
        loteId,
        fecha,
        entregadoPor: tipo === "interna" ? entregadoPor : null,
        recibidoPor,
        fechaPago: tipo === "maquila" ? fechaPago : null,
        notas: notas || undefined,
        items: pendientes.filter((r) => numero(r.itemId) > 0).map((r) => ({ itemOrdenId: r.itemId, cantidad: numero(r.itemId) })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Entrega registrada: ${totalPiezas} pieza${totalPiezas === 1 ? "" : "s"} entraron a inventario`);
      setAbierto(false);
      setCantidades({});
      setNotas("");
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !pendiente && setAbierto(o)}>
      <DialogTrigger render={<Button />}>
        <PackageCheck className="size-4" />
        Registrar entrega
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle className="text-xl">Registrar entrega · {folio}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {tipo === "maquila" ? `Maquila de ${maquilero ?? "—"}.` : "Producción interna."} Captura lo que se entregó hoy; puede ser solo una parte de la orden.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ent-fecha">Fecha de entrega</Label>
              <Input id="ent-fecha" type="date" value={fecha} max={hoy} onChange={(e) => cambiarFecha(e.target.value)} />
            </div>
            {tipo === "interna" ? (
              <div className="space-y-1.5">
                <Label>Quién entrega</Label>
                <Select items={colaboradores.map((c) => ({ value: c.id, label: c.nombre }))} value={entregadoPor} onValueChange={(v) => setEntregadoPor(v ?? "")}>
                  <SelectTrigger className="w-full" aria-label="Quién entrega">
                    <SelectValue placeholder={colaboradores.length ? "Elige al colaborador" : "No hay colaboradores"} />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Quién entrega</Label>
                <p className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm">{maquilero ?? "—"}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Quién recibe</Label>
              <Select items={receptores.map((c) => ({ value: c.id, label: c.nombre }))} value={recibidoPor} onValueChange={(v) => setRecibidoPor(v ?? "")}>
                <SelectTrigger className="w-full" aria-label="Quién recibe">
                  <SelectValue placeholder="Elige quién recibe" />
                </SelectTrigger>
                <SelectContent>
                  {receptores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipo === "maquila" && (
              <div className="space-y-1.5">
                <Label htmlFor="ent-pago">Fecha de pago al maquilero</Label>
                <Input
                  id="ent-pago"
                  type="date"
                  value={fechaPago}
                  min={fecha}
                  onChange={(e) => {
                    setFechaPago(e.target.value);
                    setFechaPagoEditada(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">Se sugiere entrega + 15 días; puedes cambiarla ({fechaPago ? formatearFechaCorta(fechaPago) : "—"}).</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Piezas entregadas por talla</Label>
            {pendientes.length ? (
              <div className="divide-y rounded-xl border">
                {pendientes.map((r) => {
                  const n = numero(r.itemId);
                  return (
                    <div key={r.itemId} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {r.modelo} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{r.talla}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pedido {r.pedido} · entregado {r.entregado} · <span className="font-medium text-amber-600">faltan {r.pendiente}</span>
                        </p>
                      </div>
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setCantidades((p) => ({ ...p, [r.itemId]: String(r.pendiente) }))}>
                        Todo
                      </button>
                      <Input
                        inputMode="numeric"
                        aria-label={`Entregado de ${r.modelo} ${r.talla}`}
                        placeholder="0"
                        className={cn("h-9 w-24 text-right", n > r.pendiente && "border-destructive")}
                        value={cantidades[r.itemId] ?? ""}
                        onChange={(e) => setCantidades((p) => ({ ...p, [r.itemId]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No hay piezas pendientes en esta orden.</p>
            )}
            {exceso && (
              <p className="text-xs text-destructive">
                {exceso.modelo} {exceso.talla}: solo faltan {exceso.pendiente}. Si entregaron de más, primero aumenta la cantidad de la orden (Editar).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ent-notas">Notas (opcional)</Label>
            <Input id="ent-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. faltó un botón en 2 piezas" />
          </div>

          {tipo === "maquila" && pagoEstimado !== null && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm">
              Pago a generar: <strong>{formatearMoneda(pagoEstimado)}</strong> ({totalPiezas} pieza{totalPiezas === 1 ? "" : "s"}) para el {fechaPago ? formatearFechaCorta(fechaPago) : "—"}.
              {faltaPrecio && <span className="mt-1 block text-destructive">Falta el precio por pieza de {faltaPrecio.modelo}: captúralo en Editar antes de registrar.</span>}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {totalPiezas} pieza{totalPiezas === 1 ? "" : "s"} entrarán a inventario
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setAbierto(false)} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="button" onClick={guardar} disabled={pendiente || !totalPiezas}>
              {pendiente ? "Guardando..." : "Registrar entrega"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
