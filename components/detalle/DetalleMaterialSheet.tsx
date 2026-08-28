"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { obtenerDetalleMaterial } from "@/actions/detalle.actions";
import { actualizarCostoMaterial } from "@/actions/materiales.actions";
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
import { formatearMoneda } from "@/lib/dinero";

export type DetalleMaterial = Awaited<ReturnType<typeof obtenerDetalleMaterial>>;

export function DetalleMaterialSheet({
  open,
  onOpenChange,
  detalle,
  cargando,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalle: DetalleMaterial | null;
  cargando: boolean;
}) {
  const [costo, setCosto] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [seguimientoPorUnidad, setSeguimientoPorUnidad] = useState(false);
  const [inicializadoPara, setInicializadoPara] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (detalle?.material && detalle.material.id !== inicializadoPara) {
    setInicializadoPara(detalle.material.id);
    setCosto(detalle.material.costo_unitario != null ? String(detalle.material.costo_unitario) : "");
    setStockMinimo(String(detalle.material.stock_minimo));
    setCategoria(detalle.material.categoria ?? "");
    setSeguimientoPorUnidad(detalle.material.seguimiento_por_unidad);
  }

  function guardar() {
    if (!detalle?.material) return;
    const id = detalle.material.id;
    startTransition(async () => {
      const res = await actualizarCostoMaterial(
        id,
        Number(costo) || 0,
        Number(stockMinimo) || 0,
        categoria,
        seguimientoPorUnidad
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Material actualizado");
    });
  }

  const valorInventario =
    detalle?.material?.costo_unitario != null
      ? detalle.material.stock_actual * detalle.material.costo_unitario
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
              <SheetTitle>{detalle.material?.nombre}</SheetTitle>
              <SheetDescription>{detalle.material?.categoria || "Materia prima"}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Stock actual</p>
                  <p className="text-2xl font-semibold">
                    {detalle.material?.stock_actual} {detalle.material?.unidad_medida}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor en inventario</p>
                  <p className="text-2xl font-semibold">
                    {valorInventario != null ? formatearMoneda(valorInventario) : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoriaMaterial">Categoría</Label>
                <Input
                  id="categoriaMaterial"
                  placeholder="Tela, hilo, accesorio..."
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="costoMaterial">Costo unitario</Label>
                  <Input
                    id="costoMaterial"
                    type="number"
                    min={0}
                    step="0.01"
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockMinimoMaterial">Stock mínimo</Label>
                  <Input
                    id="stockMinimoMaterial"
                    type="number"
                    min={0}
                    step="0.01"
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={seguimientoPorUnidad}
                  onChange={(e) => setSeguimientoPorUnidad(e.target.checked)}
                  className="size-4"
                />
                <span>
                  <Label className="cursor-pointer font-normal">Seguimiento por unidad (rollo/bolsa con QR)</Label>
                  <p className="text-xs text-muted-foreground">
                    Cada compra se dividirá en unidades individuales con su propio código QR.
                  </p>
                </span>
              </label>
              <div className="flex gap-2">
                <Button onClick={guardar} disabled={pendiente} size="sm" className="flex-1">
                  Guardar cambios
                </Button>
                {detalle.material && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    render={<Link href={`/materiales/${detalle.material.id}`} />}
                    nativeButton={false}
                  >
                    Registrar movimiento
                  </Button>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Historial de movimientos</p>
                <ul className="space-y-2">
                  {detalle.movimientos.map((m) => (
                    <li key={m.id} className="rounded-lg border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{m.tipo}</span>
                        <Badge variant={m.tipo === "salida" ? "destructive" : "secondary"}>
                          {m.tipo === "salida" ? "-" : ""}
                          {m.cantidad} {detalle.material?.unidad_medida}
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
