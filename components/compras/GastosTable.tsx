"use client";

import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORIAS_GASTO } from "@/lib/validaciones/compras.schema";
import type { Database } from "@/types/database.types";

type Gasto = Database["public"]["Tables"]["gastos"]["Row"];

const ETIQUETA_CATEGORIA: Record<string, string> = {
  renta: "Renta",
  servicios: "Servicios",
  nomina: "Nómina",
  transporte: "Transporte",
  mantenimiento: "Mantenimiento",
  otro: "Otro",
};

const OPCIONES_CATEGORIA = [
  { value: "todas", label: "Todas las categorías" },
  ...CATEGORIAS_GASTO.map((c) => ({ value: c, label: ETIQUETA_CATEGORIA[c] })),
];

export function GastosTable({ gastos }: { gastos: Gasto[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [seleccionado, setSeleccionado] = useState<Gasto | null>(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return gastos.filter((g) => {
      if (categoria !== "todas" && g.categoria !== categoria) return false;
      if (!q) return true;
      return g.concepto.toLowerCase().includes(q);
    });
  }, [gastos, busqueda, categoria]);

  const total = filtrados.reduce((acc, g) => acc + g.monto, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por concepto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select items={OPCIONES_CATEGORIA} value={categoria} onValueChange={(v) => setCategoria(v ?? "todas")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_CATEGORIA.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((g) => (
            <TableRow key={g.id} className="cursor-pointer" onClick={() => setSeleccionado(g)}>
              <TableCell className="text-muted-foreground">{g.fecha}</TableCell>
              <TableCell className="font-medium">{g.concepto}</TableCell>
              <TableCell><Badge variant="secondary">{ETIQUETA_CATEGORIA[g.categoria] ?? g.categoria}</Badge></TableCell>
              <TableCell>${g.monto.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {gastos.length ? "Sin resultados." : "Sin gastos registrados todavía."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {!!filtrados.length && (
        <p className="text-right text-sm font-medium">Total: ${total.toFixed(2)}</p>
      )}

      <Dialog open={!!seleccionado} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <DialogContent>
          {seleccionado && (
            <>
              <DialogHeader>
                <DialogTitle>{seleccionado.concepto}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={`/api/pdf/gastos/${seleccionado.id}`} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  <Download className="size-4" />
                  Descargar PDF
                </Button>
                <p><span className="text-muted-foreground">Fecha:</span> {seleccionado.fecha}</p>
                <p><span className="text-muted-foreground">Categoría:</span> {ETIQUETA_CATEGORIA[seleccionado.categoria] ?? seleccionado.categoria}</p>
                <p><span className="text-muted-foreground">Monto:</span> ${seleccionado.monto.toFixed(2)}</p>
                {seleccionado.notas && <p><span className="text-muted-foreground">Notas:</span> {seleccionado.notas}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
