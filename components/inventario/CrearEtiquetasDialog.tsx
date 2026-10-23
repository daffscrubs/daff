"use client";

import { useState } from "react";
import { Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_COPIAS } from "@/lib/inventario/etiquetas";
import { cn } from "@/lib/utils";

type Origen = "seleccionados" | "busqueda" | "todos";

export interface ConteoEtiquetas {
  /** Productos del grupo que tienen al menos una talla con código de barras. */
  idsConCodigo: string[];
  /** Total de productos del grupo (con o sin códigos), para mostrarlo en la opción. */
  productos: number;
  /** Tallas con código de barras: cada una es una etiqueta. */
  tallasConCodigo: number;
  /** Tallas sin código de barras: no se pueden etiquetar. */
  tallasSinCodigo: number;
}

// El PDF se pide con un formulario normal (POST) que abre en otra pestaña: con todos los
// productos son cientos de ids, demasiados para ir en la dirección de una URL.
function Contenido({
  grupos,
  alCerrar,
}: {
  grupos: Record<Origen, ConteoEtiquetas>;
  alCerrar: () => void;
}) {
  const [origen, setOrigen] = useState<Origen>(grupos.seleccionados.productos ? "seleccionados" : "todos");
  const [copiasTexto, setCopiasTexto] = useState("1");
  const copias = Math.floor(Number(copiasTexto));
  const copiasValidas = Number.isFinite(copias) && copias >= 1 && copias <= MAX_COPIAS;
  const grupo = grupos[origen];
  const totalEtiquetas = grupo.tallasConCodigo * (copiasValidas ? copias : 0);

  const opciones: { valor: Origen; titulo: string; deshabilitada: boolean }[] = [
    { valor: "seleccionados", titulo: "Productos seleccionados", deshabilitada: !grupos.seleccionados.productos },
    { valor: "busqueda", titulo: "Productos en tu búsqueda actual", deshabilitada: !grupos.busqueda.productos },
    { valor: "todos", titulo: "Todos los productos", deshabilitada: !grupos.todos.productos },
  ];

  return (
    <form
      method="post"
      action="/api/pdf/etiquetas-productos"
      target="_blank"
      className="space-y-4"
      onSubmit={() => setTimeout(alCerrar, 0)}
    >
      <input type="hidden" name="modeloIds" value={grupo.idsConCodigo.join(",")} />
      <input type="hidden" name="copias" value={copiasValidas ? copias : 1} />

      <div className="space-y-2">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
              origen === o.valor && "border-primary bg-primary/5",
              o.deshabilitada && "cursor-not-allowed opacity-50"
            )}
          >
            <input
              type="radio"
              name="origen"
              className="size-4"
              checked={origen === o.valor}
              disabled={o.deshabilitada}
              onChange={() => setOrigen(o.valor)}
            />
            <span className="font-medium">{o.titulo}</span>
            <span className="text-muted-foreground">({grupos[o.valor].productos})</span>
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="copiasEtiquetas">Copias de cada etiqueta</Label>
        <Input
          id="copiasEtiquetas"
          type="number"
          min={1}
          max={MAX_COPIAS}
          className="w-28"
          value={copiasTexto}
          onChange={(e) => setCopiasTexto(e.target.value)}
        />
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <p>
          Se van a crear <span className="font-semibold">{totalEtiquetas.toLocaleString("es-MX")}</span> etiqueta
          {totalEtiquetas === 1 ? "" : "s"} de 62 × 25 mm, una por cada talla con código de barras.
        </p>
        {grupo.tallasSinCodigo > 0 && (
          <p className="mt-1 text-muted-foreground">
            {grupo.tallasSinCodigo.toLocaleString("es-MX")} talla{grupo.tallasSinCodigo === 1 ? "" : "s"} no tiene
            {grupo.tallasSinCodigo === 1 ? "" : "n"} código de barras y se omite
            {grupo.tallasSinCodigo === 1 ? "" : "n"}.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!totalEtiquetas}>
          Continuar
        </Button>
      </div>
    </form>
  );
}

export function CrearEtiquetasDialog({
  abierto,
  onOpenChange,
  grupos,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  grupos: Record<Origen, ConteoEtiquetas>;
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="size-5" />
            Crear etiquetas
          </DialogTitle>
        </DialogHeader>
        {/* Se monta al abrir para que la opción inicial (seleccionados o todos) se calcule en ese momento. */}
        {abierto && <Contenido grupos={grupos} alCerrar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
