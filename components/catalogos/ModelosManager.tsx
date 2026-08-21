"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { eliminarModelo, crearModelo } from "@/actions/catalogos.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BotonEliminarConfirmacion } from "@/components/forms/BotonEliminarConfirmacion";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { formatearMoneda } from "@/lib/dinero";
import type { Database } from "@/types/database.types";

type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];

export function ModelosManager({ modelos, tallas }: { modelos: Modelo[]; tallas: Talla[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [tallaIds, setTallaIds] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const categorias = useMemo(
    () => [...new Set(modelos.map((m) => m.categoria).filter((c): c is string => !!c))].sort(),
    [modelos]
  );
  const opcionesCategoria = useMemo(
    () => [{ value: "todas", label: "Todas las categorías" }, ...categorias.map((c) => ({ value: c, label: c }))],
    [categorias]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return modelos.filter((m) => {
      if (categoriaFiltro !== "todas" && m.categoria !== categoriaFiltro) return false;
      if (!q) return true;
      return m.nombre.toLowerCase().includes(q);
    });
  }, [modelos, busqueda, categoriaFiltro]);

  function alternarTalla(id: string) {
    setTallaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearModelo({
          nombre,
          descripcion,
          categoria,
          costoUnitario: costoUnitario ? Number(costoUnitario) : undefined,
          precioVenta: precioVenta ? Number(precioVenta) : undefined,
          tallaIds,
        });
        toast.success("Modelo creado");
        setNombre("");
        setDescripcion("");
        setCategoria("");
        setCostoUnitario("");
        setPrecioVenta("");
        setTallaIds([]);
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear el modelo");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo..."
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
        </div>
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button />}>Nuevo modelo</DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo modelo</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={crear}>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <Input
                  id="categoria"
                  placeholder="Filipina, pantalón, bata..."
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costoUnitario">Costo de producción</Label>
                  <Input
                    id="costoUnitario"
                    type="number"
                    min={0}
                    step="0.01"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioVenta">Precio de venta</Label>
                  <Input
                    id="precioVenta"
                    type="number"
                    min={0}
                    step="0.01"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tallas disponibles para este modelo</Label>
                <p className="text-xs text-muted-foreground">
                  Si no eliges ninguna, se podrá usar cualquier talla del catálogo.
                </p>
                <div className="flex flex-wrap gap-2">
                  {tallas.map((talla) => (
                    <label
                      key={talla.id}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={tallaIds.includes(talla.id)}
                        onChange={() => alternarTalla(talla.id)}
                        className="size-4"
                      />
                      {talla.codigo}
                    </label>
                  ))}
                  {!tallas.length && (
                    <p className="text-sm text-muted-foreground">Sin tallas en el catálogo todavía.</p>
                  )}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pendiente}>
                {pendiente ? "Creando..." : "Crear"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Precio de venta</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((modelo) => (
            <TableRow
              key={modelo.id}
              className="cursor-pointer"
              onClick={() => router.push(`/catalogos/modelos/${modelo.id}`)}
            >
              <TableCell className="font-medium">{modelo.nombre}</TableCell>
              <TableCell className="text-muted-foreground">{modelo.categoria ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{modelo.descripcion ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {modelo.costo_unitario != null ? formatearMoneda(modelo.costo_unitario) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {modelo.precio_venta != null ? formatearMoneda(modelo.precio_venta) : "—"}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <BotonEliminarConfirmacion
                  entidad="modelo"
                  onEliminar={() => eliminarModelo(modelo.id)}
                />
              </TableCell>
            </TableRow>
          ))}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={6}>
                <EstadoVacio
                  icon={BookOpen}
                  titulo={modelos.length ? "Sin resultados" : "Sin modelos todavía"}
                  descripcion={modelos.length ? "Prueba con otra búsqueda o filtro." : "Los modelos que agregues van a aparecer aquí."}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
