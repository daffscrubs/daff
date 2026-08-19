"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DetalleMaterialSheet, type DetalleMaterial } from "@/components/detalle/DetalleMaterialSheet";
import { obtenerDetalleMaterial } from "@/actions/detalle.actions";
import type { Database } from "@/types/database.types";

type Material = Database["public"]["Tables"]["materiales"]["Row"];

export function MaterialesTable({ materiales }: { materiales: Material[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleMaterial | null>(null);
  const [cargando, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((m) => {
      if (soloStockBajo && m.stock_actual > m.stock_minimo) return false;
      if (!q) return true;
      return [m.nombre, m.categoria].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
    });
  }, [materiales, busqueda, soloStockBajo]);

  function abrirDetalle(id: string) {
    setAbierto(true);
    startTransition(async () => {
      setDetalle(await obtenerDetalleMaterial(id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          type="button"
          variant={soloStockBajo ? "default" : "outline"}
          size="sm"
          onClick={() => setSoloStockBajo((v) => !v)}
        >
          Solo stock bajo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Stock mínimo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((m) => (
            <TableRow key={m.id} className="cursor-pointer" onClick={() => abrirDetalle(m.id)}>
              <TableCell className="font-medium">{m.nombre}</TableCell>
              <TableCell className="text-muted-foreground">{m.categoria ?? "—"}</TableCell>
              <TableCell>{m.stock_actual} {m.unidad_medida}</TableCell>
              <TableCell className="text-muted-foreground">{m.stock_minimo} {m.unidad_medida}</TableCell>
              <TableCell>
                {m.stock_actual <= m.stock_minimo && <Badge variant="destructive">Stock bajo</Badge>}
              </TableCell>
            </TableRow>
          ))}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                {materiales.length ? "Sin resultados." : "Sin materiales todavía."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DetalleMaterialSheet open={abierto} onOpenChange={setAbierto} detalle={detalle} cargando={cargando} />
    </div>
  );
}
