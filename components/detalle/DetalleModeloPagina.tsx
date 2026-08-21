"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { actualizarCostoModelo, eliminarModelo, guardarTallasModelo } from "@/actions/catalogos.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearMoneda } from "@/lib/dinero";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DetalleModelo = Awaited<ReturnType<typeof obtenerDetalleModelo>>;

export function DetalleModeloPagina({ detalle }: { detalle: DetalleModelo }) {
  const router = useRouter();
  const [costo, setCosto] = useState(detalle.modelo?.costo_unitario != null ? String(detalle.modelo.costo_unitario) : "");
  const [precioVenta, setPrecioVenta] = useState(detalle.modelo?.precio_venta != null ? String(detalle.modelo.precio_venta) : "");
  const [categoria, setCategoria] = useState(detalle.modelo?.categoria ?? "");
  const [tallaIds, setTallaIds] = useState<string[]>(detalle.tallaIdsAsignadas);
  const [pendiente, startTransition] = useTransition();
  const [guardandoTallas, startTransitionTallas] = useTransition();
  const [eliminando, startTransitionEliminar] = useTransition();
  const [editandoPrecio, setEditandoPrecio] = useState(false);

  const modelo = detalle.modelo;
  if (!modelo) return null;

  function guardarCosto() {
    startTransition(async () => {
      try {
        await actualizarCostoModelo(modelo!.id, Number(costo) || 0, Number(precioVenta) || 0, categoria);
        toast.success("Costo y precio actualizados");
        setEditandoPrecio(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function cancelarEdicionPrecio() {
    setCosto(modelo!.costo_unitario != null ? String(modelo!.costo_unitario) : "");
    setPrecioVenta(modelo!.precio_venta != null ? String(modelo!.precio_venta) : "");
    setCategoria(modelo!.categoria ?? "");
    setEditandoPrecio(false);
  }

  function alternarTalla(id: string) {
    setTallaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function guardarTallas() {
    startTransitionTallas(async () => {
      try {
        await guardarTallasModelo(modelo!.id, tallaIds);
        toast.success("Tallas actualizadas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function eliminar() {
    startTransitionEliminar(async () => {
      try {
        await eliminarModelo(modelo!.id);
        toast.success("Modelo eliminado");
        router.push("/catalogos/modelos");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  const nombreTalla = (id: string) => detalle.tallas.find((t) => t.id === id)?.codigo ?? "—";

  const valorInventario = modelo.costo_unitario ? detalle.existenciasTotal * modelo.costo_unitario : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{modelo.nombre}</h1>
          <p className="text-muted-foreground">{modelo.descripcion || "Sin descripción"}</p>
        </div>
        <div className="flex items-center gap-2">
          {!editandoPrecio && (
            <Button variant="outline" onClick={() => setEditandoPrecio(true)}>
              Editar
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" disabled={eliminando} />}>Eliminar</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Deseas eliminar este modelo?</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription>No podrás deshacer esta acción.</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={eliminando} onClick={eliminar}>
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Existencias totales</p>
          <p className="text-2xl font-semibold">{detalle.existenciasTotal}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Valor en inventario</p>
          <p className="text-2xl font-semibold">{valorInventario != null ? formatearMoneda(valorInventario) : "—"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Precio de venta</p>
          <p className="text-2xl font-semibold">{modelo.precio_venta != null ? formatearMoneda(modelo.precio_venta) : "—"}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Costo, precio y categoría</h2>
        {editandoPrecio ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="categoriaModelo">Categoría</Label>
              <Input
                id="categoriaModelo"
                placeholder="Filipina, pantalón, bata..."
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="costoModelo">Costo de producción</Label>
                <Input
                  id="costoModelo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precioVentaModelo">Precio de venta</Label>
                <Input
                  id="precioVentaModelo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={guardarCosto} disabled={pendiente} size="sm">
                {pendiente ? "Guardando..." : "Guardar costo y precio"}
              </Button>
              <Button onClick={cancelarEdicionPrecio} disabled={pendiente} size="sm" variant="ghost">
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Categoría</p>
              <p className="text-sm">{modelo.categoria ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costo de producción</p>
              <p className="text-sm">{modelo.costo_unitario != null ? formatearMoneda(modelo.costo_unitario) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Precio de venta</p>
              <p className="text-sm">{modelo.precio_venta != null ? formatearMoneda(modelo.precio_venta) : "—"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Tallas disponibles</h2>
        <p className="text-xs text-muted-foreground">
          Si no eliges ninguna, se podrá usar cualquier talla del catálogo al crear pedidos u órdenes.
        </p>
        <div className="flex flex-wrap gap-2">
          {detalle.tallas.map((talla) => (
            <label key={talla.id} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={tallaIds.includes(talla.id)}
                onChange={() => alternarTalla(talla.id)}
                className="size-4"
              />
              {talla.codigo}
            </label>
          ))}
        </div>
        <Button onClick={guardarTallas} disabled={guardandoTallas} size="sm" variant="outline">
          {guardandoTallas ? "Guardando..." : "Guardar tallas"}
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Existencias por talla</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Talla</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalle.existencias.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{nombreTalla(e.talla_id)}</TableCell>
                <TableCell>{e.cantidad_actual}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/materiales/productos/${e.id}`}>
                    <Button variant="outline" size="sm">Más datos</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!detalle.existencias.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin existencias todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial</h2>
        <ul className="space-y-2">
          {detalle.movimientos.map((m) => (
            <li key={m.id} className="rounded-lg border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="capitalize">{m.tipo}</span>
                <Badge variant={m.tipo === "salida" ? "destructive" : "secondary"}>
                  {m.tipo === "salida" ? "-" : "+"}
                  {m.cantidad} · {nombreTalla(m.talla_id)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(m.created_at).toLocaleString("es-MX")}
                {m.lotes_produccion?.folio && ` · Orden ${m.lotes_produccion.folio}`}
                {m.motivo && ` · ${m.motivo}`}
              </p>
            </li>
          ))}
          {!detalle.movimientos.length && <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>}
        </ul>
      </div>
    </div>
  );
}
