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

const OPCIONES_ASIGNACION = [
  { value: "todas", label: "Todas las asignaciones" },
  { value: "sin_asignar", label: "Sin asignar" },
  { value: "interna", label: "Internas" },
  { value: "maquila", label: "Maquila" },
];

export function ProduccionTable({
  lotes,
  items,
  modelos,
  tallas,
  maquileros,
  entregadoPorItem,
}: {
  lotes: Lote[];
  items: ItemOrden[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
  maquileros: { id: string; nombre: string }[];
  /** Piezas entregadas (entregas vigentes) por renglón de la orden. */
  entregadoPorItem: Record<string, number>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estatus, setEstatus] = useState("todos");
  const [asignacion, setAsignacion] = useState("todas");

  const nombreModelo = (id: string) => modelos.find((m) => m.id === id)?.nombre ?? "—";
  const codigoTalla = (id: string) => tallas.find((t) => t.id === id)?.codigo ?? "—";
  const itemsDe = (loteId: string) => items.filter((i) => i.lote_id === loteId);
  const nombreMaquilero = (id: string | null) => maquileros.find((m) => m.id === id)?.nombre ?? "—";

  const descripcionProductos = (loteId: string) =>
    itemsDe(loteId)
      .map((i) => `${nombreModelo(i.modelo_id)} ${codigoTalla(i.talla_id)} (${i.cantidad_planeada})`)
      .join(", ");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lotes.filter((l) => {
      if (estatus !== "todos" && l.estatus !== estatus) return false;
      if (asignacion !== "todas" && l.tipo_produccion !== asignacion) return false;
      if (!q) return true;
      return `${l.folio} ${descripcionProductos(l.id)} ${l.maquilero_id ? nombreMaquilero(l.maquilero_id) : l.tipo_produccion === "interna" ? "interna" : "sin asignar"}`.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, items, busqueda, estatus, asignacion]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, producto o maquilero..."
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
        <Select items={OPCIONES_ASIGNACION} value={asignacion} onValueChange={(v) => setAsignacion(v ?? "todas")}>
          <SelectTrigger className="w-56" aria-label="Asignación">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ASIGNACION.map((o) => (
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
            <TableHead>Quién la hace</TableHead>
            <TableHead>Entregado</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((lote) => {
            const itemsLote = itemsDe(lote.id);
            const pedido = itemsLote.reduce((acc, i) => acc + i.cantidad_planeada, 0);
            const entregado = itemsLote.reduce((acc, i) => acc + Math.min(entregadoPorItem[i.id] ?? 0, i.cantidad_planeada), 0);
            return (
              <TableRow key={lote.id}>
                <TableCell>
                  <Link href={`/produccion/${lote.id}`} className="font-medium hover:underline">
                    {lote.folio}
                  </Link>
                </TableCell>
                <TableCell className="min-w-64 whitespace-normal text-muted-foreground">
                  {descripcionProductos(lote.id) || "—"}
                </TableCell>
                <TableCell>
                  {lote.tipo_produccion === "maquila" ? (
                    <span>
                      <Badge variant="secondary">Maquila</Badge> <span className="ml-1 text-sm">{nombreMaquilero(lote.maquilero_id)}</span>
                    </span>
                  ) : lote.tipo_produccion === "interna" ? (
                    <Badge variant="outline">Interna</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">Sin asignar</Badge>
                  )}
                </TableCell>
                <TableCell className="min-w-40">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pedido ? Math.round((entregado / pedido) * 100) : 0}%` }} />
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {entregado}/{pedido}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={CLASE_ESTATUS_ORDEN[lote.estatus]}>{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
                  {lote.cerrada_con_faltantes && <span className="ml-1.5 text-xs text-amber-600">con faltantes</span>}
                </TableCell>
              </TableRow>
            );
          })}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={5}>
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
