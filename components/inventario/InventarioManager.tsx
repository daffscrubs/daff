"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Boxes, Shirt, Barcode } from "lucide-react";
import { toast } from "sonner";
import { crearModelo } from "@/actions/catalogos.actions";
import { Badge } from "@/components/ui/badge";
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
import { ImportarProductosDialog } from "@/components/inventario/ImportarProductosDialog";
import { CrearEtiquetasDialog, type ProductoEtiquetable } from "@/components/inventario/CrearEtiquetasDialog";
import { TALLA_SIN_TALLAS } from "@/lib/inventario/etiquetas";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { formatearMoneda } from "@/lib/dinero";
import { normalizarTexto } from "@/lib/texto";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type ModeloTalla = Pick<Database["public"]["Tables"]["modelo_tallas"]["Row"], "modelo_id" | "talla_id" | "precio_venta" | "codigo_barras" | "sku">;
type StockProducto = Pick<Database["public"]["Tables"]["stock_productos"]["Row"], "modelo_id" | "talla_id" | "ubicacion_id" | "cantidad_actual">;
type Ubicacion = Database["public"]["Tables"]["ubicaciones"]["Row"];

const OPCIONES_ORDEN = [
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "stock_desc", label: "Más existencias" },
  { value: "stock_asc", label: "Menos existencias" },
];

export function InventarioManager({
  modelos,
  tallas,
  modeloTallas,
  stock,
  ubicaciones,
}: {
  modelos: Modelo[];
  tallas: Talla[];
  modeloTallas: ModeloTalla[];
  stock: StockProducto[];
  ubicaciones: Ubicacion[];
}) {
  function precioVentaDe(modelo: Modelo): string {
    const precios = modeloTallas
      .filter((mt) => mt.modelo_id === modelo.id)
      .map((mt) => mt.precio_venta ?? modelo.precio_venta)
      .filter((p): p is number => p != null);
    if (!precios.length) return modelo.precio_venta != null ? formatearMoneda(modelo.precio_venta) : "—";
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? formatearMoneda(min) : `${formatearMoneda(min)} - ${formatearMoneda(max)}`;
  }
  // Con una ubicación elegida en el filtro, solo cuenta lo que hay ahí; con
  // "Todas", la suma de todas las ubicaciones.
  function existenciasDe(modelo: Modelo, ubicacionId = ubicacionFiltro): number {
    return stock
      .filter((s) => s.modelo_id === modelo.id && (ubicacionId === "todas" || s.ubicacion_id === ubicacionId))
      .reduce((acc, s) => acc + s.cantidad_actual, 0);
  }
  // Tallas del producto: las asignadas en el catálogo o, si no tiene, las que
  // ya tienen un registro de existencias.
  function tallasDe(modelo: Modelo): number {
    const asignadas = modeloTallas.filter((mt) => mt.modelo_id === modelo.id).length;
    return asignadas || stock.filter((s) => s.modelo_id === modelo.id).length;
  }
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [tallaIds, setTallaIds] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [orden, setOrden] = useState("nombre");
  const [ubicacionFiltro, setUbicacionFiltro] = useState("todas");
  // La selección es independiente de la búsqueda: se puede seleccionar, cambiar el filtro y seguir seleccionando.
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [etiquetasAbierto, setEtiquetasAbierto] = useState(false);
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

  const opcionesUbicacion = useMemo(
    () => [{ value: "todas", label: "Todas las ubicaciones" }, ...ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))],
    [ubicaciones]
  );

  const filtrados = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    const existencias = new Map<string, number>();
    for (const s of stock) {
      if (ubicacionFiltro !== "todas" && s.ubicacion_id !== ubicacionFiltro) continue;
      existencias.set(s.modelo_id, (existencias.get(s.modelo_id) ?? 0) + s.cantidad_actual);
    }

    // Códigos de barras y SKU de todas las tallas de cada producto, para poder buscar por ellos.
    const codigos = new Map<string, string>();
    for (const mt of modeloTallas) {
      if (mt.codigo_barras || mt.sku) {
        codigos.set(mt.modelo_id, `${codigos.get(mt.modelo_id) ?? ""} ${mt.codigo_barras ?? ""} ${mt.sku ?? ""}`);
      }
    }

    const lista = modelos.filter((m) => {
      if (categoriaFiltro !== "todas" && m.categoria !== categoriaFiltro) return false;
      if (!q) return true;
      return normalizarTexto(`${m.nombre} ${m.categoria ?? ""} ${codigos.get(m.id) ?? ""}`).includes(q);
    });
    if (orden === "stock_desc") lista.sort((a, b) => (existencias.get(b.id) ?? 0) - (existencias.get(a.id) ?? 0));
    if (orden === "stock_asc") lista.sort((a, b) => (existencias.get(a.id) ?? 0) - (existencias.get(b.id) ?? 0));
    return lista;
  }, [modelos, modeloTallas, stock, busqueda, categoriaFiltro, orden, ubicacionFiltro]);

  const todosFiltradosSeleccionados = filtrados.length > 0 && filtrados.every((m) => seleccion.has(m.id));
  const algunoFiltradoSeleccionado = filtrados.some((m) => seleccion.has(m.id));

  function alternarSeleccion(id: string) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function alternarTodosLosFiltrados() {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (todosFiltradosSeleccionados) filtrados.forEach((m) => siguiente.delete(m.id));
      else filtrados.forEach((m) => siguiente.add(m.id));
      return siguiente;
    });
  }

  // Cada producto con sus tallas, el código de barras de cada una y sus existencias, para elegir
  // cuántas etiquetas se quieren de cada talla.
  const productosEtiquetables = useMemo<ProductoEtiquetable[]>(() => {
    const ordenTalla = new Map(tallas.map((t) => [t.id, t.orden]));
    const codigoTalla = new Map(tallas.map((t) => [t.id, t.codigo.trim()]));
    const stockPorTalla = new Map<string, number>();
    for (const s of stock) {
      const clave = `${s.modelo_id}|${s.talla_id}`;
      stockPorTalla.set(clave, (stockPorTalla.get(clave) ?? 0) + s.cantidad_actual);
    }
    const variantesPorModelo = new Map<string, ProductoEtiquetable["variantes"]>();
    for (const mt of modeloTallas) {
      const talla = codigoTalla.get(mt.talla_id) ?? "";
      const lista = variantesPorModelo.get(mt.modelo_id) ?? [];
      lista.push({
        tallaId: mt.talla_id,
        // Los productos sin tallas se guardan internamente en UNITALLA; no se muestra ni se imprime.
        talla: talla && talla.toUpperCase() !== TALLA_SIN_TALLAS ? talla : null,
        codigoBarras: mt.codigo_barras?.trim() || null,
        stock: stockPorTalla.get(`${mt.modelo_id}|${mt.talla_id}`) ?? 0,
      });
      variantesPorModelo.set(mt.modelo_id, lista);
    }
    return modelos.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      variantes: (variantesPorModelo.get(m.id) ?? []).sort((a, b) => (ordenTalla.get(a.tallaId) ?? 0) - (ordenTalla.get(b.tallaId) ?? 0)),
    }));
  }, [modelos, modeloTallas, tallas, stock]);

  function alternarTalla(id: string) {
    setTallaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearModelo({
        nombre,
        descripcion,
        categoria,
        costoUnitario: costoUnitario ? Number(costoUnitario) : undefined,
        precioVenta: precioVenta ? Number(precioVenta) : undefined,
        tallaIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Producto creado");
      setNombre("");
      setDescripcion("");
      setCategoria("");
      setCostoUnitario("");
      setPrecioVenta("");
      setTallaIds([]);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEtiquetasAbierto(true)}>
            <Barcode className="size-4" />
            Crear etiquetas
          </Button>
          <ImportarProductosDialog />
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger render={<Button />}>Nuevo producto</DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo producto</DialogTitle>
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
                <Label>Tallas disponibles para este producto</Label>
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
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, categoría, SKU o código de barras"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-10 pl-9 text-sm"
            />
          </div>
          <Select
            items={opcionesCategoria}
            value={categoriaFiltro}
            onValueChange={(v) => setCategoriaFiltro((v as string) ?? "todas")}
          >
            <SelectTrigger className="h-10 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcionesCategoria.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ubicaciones.length > 1 && (
            <Select
              items={opcionesUbicacion}
              value={ubicacionFiltro}
              onValueChange={(v) => setUbicacionFiltro((v as string) ?? "todas")}
            >
              <SelectTrigger className="h-10 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcionesUbicacion.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select items={OPCIONES_ORDEN} value={orden} onValueChange={(v) => setOrden((v as string) ?? "nombre")}>
            <SelectTrigger className="h-10 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_ORDEN.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {seleccion.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-y bg-primary/5 px-4 py-2 text-sm">
            <span className="font-medium">
              {seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}
            </span>
            <Button size="sm" onClick={() => setEtiquetasAbierto(true)}>
              <Barcode className="size-4" />
              Crear etiquetas ({seleccion.size})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSeleccion(new Set())}>
              Quitar selección
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer"
                  aria-label="Seleccionar todos los productos de la lista"
                  checked={todosFiltradosSeleccionados}
                  ref={(el) => {
                    if (el) el.indeterminate = algunoFiltradoSeleccionado && !todosFiltradosSeleccionados;
                  }}
                  onChange={alternarTodosLosFiltrados}
                />
              </TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Existencias</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead>Precio de venta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((modelo) => {
              const existencias = existenciasDe(modelo);
              const tallas = tallasDe(modelo);
              return (
                <TableRow
                  key={modelo.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/inventario/${modelo.id}`)}
                >
                  <TableCell className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer"
                      aria-label={`Seleccionar ${modelo.nombre}`}
                      checked={seleccion.has(modelo.id)}
                      onChange={() => alternarSeleccion(modelo.id)}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                        {modelo.imagen_url?.startsWith("http") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={modelo.imagen_url} alt="" className="size-full object-cover" />
                        ) : (
                          <Shirt className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{modelo.nombre}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent",
                        existencias > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      )}
                    >
                      {existencias === 0
                        ? "Sin existencias"
                        : `${existencias} ${Math.abs(existencias) === 1 ? "unidad" : "unidades"}${
                            tallas ? ` en ${tallas} ${tallas === 1 ? "talla" : "tallas"}` : ""
                          }`}
                    </Badge>
                    {ubicacionFiltro === "todas" && ubicaciones.length > 1 && existencias !== 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ubicaciones.map((u) => `${u.nombre} ${existenciasDe(modelo, u.id)}`).join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{modelo.categoria ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {modelo.costo_unitario != null ? formatearMoneda(modelo.costo_unitario) : "—"}
                  </TableCell>
                  <TableCell className="pr-4 text-muted-foreground">{precioVentaDe(modelo)}</TableCell>
                </TableRow>
              );
            })}
            {!filtrados.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EstadoVacio
                    icon={Boxes}
                    titulo={modelos.length ? "Sin resultados" : "Sin productos todavía"}
                    descripcion={modelos.length ? "Prueba con otra búsqueda o filtro." : "Los productos que agregues van a aparecer aquí."}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CrearEtiquetasDialog
        abierto={etiquetasAbierto}
        onOpenChange={setEtiquetasAbierto}
        productos={productosEtiquetables}
        idsSeleccionados={[...seleccion].filter((id) => modelos.some((m) => m.id === id))}
        idsBusqueda={filtrados.map((m) => m.id)}
      />
    </div>
  );
}
