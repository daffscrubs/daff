"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, ShoppingCart, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { BotonEliminarConfirmacion } from "@/components/forms/BotonEliminarConfirmacion";
import { eliminarCompra } from "@/actions/compras.actions";
import { formatearMoneda } from "@/lib/dinero";
import type { Database } from "@/types/database.types";

type Compra = Database["public"]["Tables"]["compras"]["Row"];
type CompraItem = Database["public"]["Tables"]["compra_items"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];

export function ComprasTable({
  compras,
  items,
  materiales,
}: {
  compras: Compra[];
  items: CompraItem[];
  materiales: Material[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<Compra | null>(null);

  const nombreMaterial = (id: string) => materiales.find((m) => m.id === id)?.nombre ?? "—";
  const unidadMaterial = (id: string) => materiales.find((m) => m.id === id)?.unidad_medida ?? "";
  const itemsDe = (compraId: string) => items.filter((i) => i.compra_id === compraId);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return compras;
    return compras.filter((c) => `${c.folio} ${c.proveedor}`.toLowerCase().includes(q));
  }, [compras, busqueda]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por folio o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtradas.map((c) => (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => setSeleccionada(c)}>
              <TableCell className="font-medium">{c.folio}</TableCell>
              <TableCell>{c.proveedor}</TableCell>
              <TableCell className="text-muted-foreground">{c.fecha}</TableCell>
              <TableCell>{formatearMoneda(c.total)}</TableCell>
            </TableRow>
          ))}
          {!filtradas.length && (
            <TableRow>
              <TableCell colSpan={4}>
                <EstadoVacio
                  icon={ShoppingCart}
                  titulo={compras.length ? "Sin resultados" : "Sin compras todavía"}
                  descripcion={compras.length ? "Prueba con otra búsqueda." : "Las compras que registres van a aparecer aquí."}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!seleccionada} onOpenChange={(open) => !open && setSeleccionada(null)}>
        <DialogContent>
          {seleccionada && (
            <>
              <DialogHeader>
                <DialogTitle>{seleccionada.folio}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={`/api/pdf/compras/${seleccionada.id}`} target="_blank" rel="noopener noreferrer" />}
                    nativeButton={false}
                  >
                    <Download className="size-4" />
                    Descargar PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/compras/${seleccionada.id}/editar`} />}
                    nativeButton={false}
                  >
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                  <BotonEliminarConfirmacion
                    entidad="compra"
                    onEliminar={async () => {
                      const res = await eliminarCompra(seleccionada.id);
                      if (res.ok) setSeleccionada(null);
                      return res;
                    }}
                  />
                </div>
                <p><span className="text-muted-foreground">Proveedor:</span> {seleccionada.proveedor}</p>
                <p><span className="text-muted-foreground">Fecha:</span> {seleccionada.fecha}</p>
                {seleccionada.notas && <p><span className="text-muted-foreground">Notas:</span> {seleccionada.notas}</p>}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo unit.</TableHead>
                      <TableHead>Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsDe(seleccionada.id).map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{nombreMaterial(i.material_id)}</TableCell>
                        <TableCell>{i.cantidad} {unidadMaterial(i.material_id)}</TableCell>
                        <TableCell>{formatearMoneda(i.costo_unitario)}</TableCell>
                        <TableCell>{formatearMoneda(i.subtotal ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-right font-medium">Total: {formatearMoneda(seleccionada.total)}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
