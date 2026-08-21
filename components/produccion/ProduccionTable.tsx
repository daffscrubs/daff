"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Factory } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_ORDEN } from "@/lib/estatus-colores";
import type { Database } from "@/types/database.types";

type Lote = Database["public"]["Tables"]["lotes_produccion"]["Row"];
type ItemOrden = Database["public"]["Tables"]["items_orden_produccion"]["Row"];

const OPCIONES_ESTATUS = [
  { value: "todos", label: "Todos los estatus" },
  ...Object.entries(ESTATUS_ORDEN_LABEL).map(([value, label]) => ({ value, label })),
];

export function ProduccionTable({
  lotes,
  items,
  modelos,
  tallas,
}: {
  lotes: Lote[];
  items: ItemOrden[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estatus, setEstatus] = useState("todos");

  const nombreModelo = (id: string) => modelos.find((m) => m.id === id)?.nombre ?? "—";
  const codigoTalla = (id: string) => tallas.find((t) => t.id === id)?.codigo ?? "—";
  const itemsDe = (loteId: string) => items.filter((i) => i.lote_id === loteId);

  const descripcionProductos = (loteId: string) =>
    itemsDe(loteId)
      .map((i) => `${nombreModelo(i.modelo_id)} ${codigoTalla(i.talla_id)} (${i.cantidad_planeada})`)
      .join(", ");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lotes.filter((l) => {
      if (estatus !== "todos" && l.estatus !== estatus) return false;
      if (!q) return true;
      return `${l.folio} ${descripcionProductos(l.id)}`.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, items, busqueda, estatus]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio o producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select items={OPCIONES_ESTATUS} value={estatus} onValueChange={(v) => setEstatus(v ?? "todos")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ESTATUS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Cantidad total</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((lote) => {
            const itemsLote = itemsDe(lote.id);
            return (
              <TableRow key={lote.id}>
                <TableCell>
                  <Link href={`/produccion/${lote.id}`} className="font-medium hover:underline">
                    {lote.folio}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{descripcionProductos(lote.id) || "—"}</TableCell>
                <TableCell>{itemsLote.reduce((acc, i) => acc + i.cantidad_planeada, 0)}</TableCell>
                <TableCell>
                  <Badge className={CLASE_ESTATUS_ORDEN[lote.estatus]}>{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={4}>
                <EstadoVacio
                  icon={Factory}
                  titulo={lotes.length ? "Sin resultados" : "Sin órdenes de producción todavía"}
                  descripcion={lotes.length ? "Prueba con otra búsqueda o filtro." : "Las órdenes que crees van a aparecer aquí."}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
