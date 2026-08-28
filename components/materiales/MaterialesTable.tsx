"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Boxes } from "lucide-react";
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
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetalleMaterialSheet, type DetalleMaterial } from "@/components/detalle/DetalleMaterialSheet";
import { obtenerDetalleMaterial } from "@/actions/detalle.actions";
import type { Database } from "@/types/database.types";

type Material = Database["public"]["Tables"]["materiales"]["Row"];

export function MaterialesTable({
  materiales,
  stockPorUnidades,
}: {
  materiales: Material[];
  /** material_id -> suma de unidades disponibles, para los materiales con
   * seguimiento_por_unidad (su stock_actual de bulto nunca se actualiza). */
  stockPorUnidades: Record<string, number>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleMaterial | null>(null);
  const [cargando, startTransition] = useTransition();

  const categorias = useMemo(
    () => [...new Set(materiales.map((m) => m.categoria).filter((c): c is string => !!c))].sort(),
    [materiales]
  );
  const opcionesCategoria = useMemo(
    () => [{ value: "todas", label: "Todas las categorías" }, ...categorias.map((c) => ({ value: c, label: c }))],
    [categorias]
  );

  // Un material por unidad nunca recibe movimientos_inventario -- su
  // stock_actual de bulto queda congelado en 0. El stock real es la suma de
  // sus unidades (calculada en el servidor y pasada como prop).
  function stock(m: Material) {
    return m.seguimiento_por_unidad ? stockPorUnidades[m.id] ?? 0 : m.stock_actual;
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return materiales.filter((m) => {
      if (soloStockBajo && stock(m) > m.stock_minimo) return false;
      if (categoriaFiltro !== "todas" && m.categoria !== categoriaFiltro) return false;
      if (!q) return true;
      return [m.nombre, m.categoria].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stock() ya lee stockPorUnidades, que sí está en las deps
  }, [materiales, busqueda, soloStockBajo, categoriaFiltro, stockPorUnidades]);

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
        <Select
          items={opcionesCategoria}
          value={categoriaFiltro}
          onValueChange={(v) => setCategoriaFiltro((v as string) ?? "todas")}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcionesCategoria.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableCell>{stock(m)} {m.unidad_medida}</TableCell>
              <TableCell className="text-muted-foreground">{m.stock_minimo} {m.unidad_medida}</TableCell>
              <TableCell>
                {stock(m) <= m.stock_minimo && <Badge variant="destructive">Stock bajo</Badge>}
              </TableCell>
            </TableRow>
          ))}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={5}>
                <EstadoVacio
                  icon={Boxes}
                  titulo={materiales.length ? "Sin resultados" : "Sin materiales todavía"}
                  descripcion={materiales.length ? "Prueba con otra búsqueda o filtro." : "Los materiales que agregues van a aparecer aquí."}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DetalleMaterialSheet open={abierto} onOpenChange={setAbierto} detalle={detalle} cargando={cargando} />
    </div>
  );
}
