"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { actualizarCostoModelo, guardarTallasModelo } from "@/actions/catalogos.actions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database.types";

type Talla = Database["public"]["Tables"]["tallas"]["Row"];

export type DetalleModelo = Awaited<ReturnType<typeof obtenerDetalleModelo>>;

export function DetalleModeloSheet({
  open,
  onOpenChange,
  detalle,
  cargando,
  tallasCatalogo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalle: DetalleModelo | null;
  cargando: boolean;
  tallasCatalogo: Talla[];
}) {
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [tallaIds, setTallaIds] = useState<string[]>([]);
  const [inicializadoPara, setInicializadoPara] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [guardandoTallas, startTransitionTallas] = useTransition();

  if (detalle?.modelo && detalle.modelo.id !== inicializadoPara) {
    setInicializadoPara(detalle.modelo.id);
    setCosto(detalle.modelo.costo_unitario != null ? String(detalle.modelo.costo_unitario) : "");
    setPrecioVenta(detalle.modelo.precio_venta != null ? String(detalle.modelo.precio_venta) : "");
    setTallaIds(detalle.tallaIdsAsignadas);
  }

  function guardarCosto() {
    if (!detalle?.modelo) return;
    const id = detalle.modelo.id;
    startTransition(async () => {
      try {
        await actualizarCostoModelo(id, Number(costo) || 0, Number(precioVenta) || 0);
        toast.success("Costo y precio actualizados");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function alternarTalla(id: string) {
    setTallaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function guardarTallas() {
    if (!detalle?.modelo) return;
    const id = detalle.modelo.id;
    startTransitionTallas(async () => {
      try {
        await guardarTallasModelo(id, tallaIds);
        toast.success("Tallas actualizadas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  const nombreTalla = (id: string) => detalle?.tallas.find((t) => t.id === id)?.codigo ?? "—";

  const valorInventario = detalle?.modelo?.costo_unitario
    ? detalle.existenciasTotal * detalle.modelo.costo_unitario
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {cargando || !detalle ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{detalle.modelo?.nombre}</SheetTitle>
              <SheetDescription>{detalle.modelo?.descripcion || "Producto"}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Existencias totales</p>
                  <p className="text-2xl font-semibold">{detalle.existenciasTotal}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor en inventario</p>
                  <p className="text-2xl font-semibold">
                    {valorInventario != null ? `$${valorInventario.toFixed(2)}` : "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="costoModelo">Costo de producción</Label>
                  <Input
                    id="costoModelo"
                    type="number"
                    min={0}
                    step="0.01"
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioVentaModelo">Precio de venta</Label>
                  <Input
                    id="precioVentaModelo"
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={guardarCosto} disabled={pendiente} size="sm" className="w-full">
                Guardar costo y precio
              </Button>

              <div className="space-y-2">
                <Label>Tallas disponibles para este modelo</Label>
                <div className="flex flex-wrap gap-2">
                  {tallasCatalogo.map((talla) => (
                    <label key={talla.id} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={tallaIds.includes(talla.id)}
                        onChange={() => alternarTalla(talla.id)}
                        className="size-4"
                      />
                      {talla.codigo}
                    </label>
                  ))}
                </div>
                <Button onClick={guardarTallas} disabled={guardandoTallas} size="sm" variant="outline" className="w-full">
                  Guardar tallas
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Existencias por talla</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Talla</TableHead>
                      <TableHead>Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalle.existencias.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{nombreTalla(e.talla_id)}</TableCell>
                        <TableCell>{e.cantidad_actual}</TableCell>
                      </TableRow>
                    ))}
                    {!detalle.existencias.length && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Sin existencias todavía.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Historial</p>
                <ul className="space-y-2">
                  {detalle.movimientos.map((m) => (
                    <li key={m.id} className="rounded-lg border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{m.tipo}</span>
                        <Badge variant={m.tipo === "salida" ? "destructive" : "secondary"}>
                          {m.tipo === "salida" ? "-" : "+"}
                          {m.cantidad} · {nombreTalla(m.talla_id)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("es-MX")}
                        {m.lotes_produccion?.folio && ` · Orden ${m.lotes_produccion.folio}`}
                        {m.motivo && ` · ${m.motivo}`}
                      </p>
                    </li>
                  ))}
                  {!detalle.movimientos.length && (
                    <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
