"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { actualizarCostoModelo, eliminarModelo, guardarTallasModelo } from "@/actions/catalogos.actions";
import { crearMovimientoStockProducto, traspasarStockProducto } from "@/actions/stockProductos.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { TipoMovimiento } from "@/types/database.types";

export type DetalleModelo = Awaited<ReturnType<typeof obtenerDetalleModelo>>;

export function DetalleProducto({ detalle }: { detalle: DetalleModelo }) {
  const router = useRouter();
  const [costo, setCosto] = useState(detalle.modelo?.costo_unitario != null ? String(detalle.modelo.costo_unitario) : "");
  const [precioVenta, setPrecioVenta] = useState(detalle.modelo?.precio_venta != null ? String(detalle.modelo.precio_venta) : "");
  const [categoria, setCategoria] = useState(detalle.modelo?.categoria ?? "");
  const [tallaIds, setTallaIds] = useState<string[]>(detalle.tallaIdsAsignadas);
  const [preciosPorTalla, setPreciosPorTalla] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(detalle.preciosPorTalla).map(([tallaId, precio]) => [tallaId, precio != null ? String(precio) : ""])
    )
  );
  const [pendiente, startTransition] = useTransition();
  const [guardandoTallas, startTransitionTallas] = useTransition();
  const [eliminando, startTransitionEliminar] = useTransition();
  const [editandoPrecio, setEditandoPrecio] = useState(false);

  const [tallaAjuste, setTallaAjuste] = useState<{ id: string; codigo: string } | null>(null);
  const [tipoAjuste, setTipoAjuste] = useState<TipoMovimiento>("entrada");
  const [cantidadAjuste, setCantidadAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [ubicacionAjusteId, setUbicacionAjusteId] = useState("");
  const [ajustando, startTransitionAjuste] = useTransition();

  const [tallaTraspaso, setTallaTraspaso] = useState<{ id: string; codigo: string } | null>(null);
  const [origenTraspasoId, setOrigenTraspasoId] = useState("");
  const [destinoTraspasoId, setDestinoTraspasoId] = useState("");
  const [cantidadTraspaso, setCantidadTraspaso] = useState("");
  const [motivoTraspaso, setMotivoTraspaso] = useState("");
  const [traspasando, startTransitionTraspaso] = useTransition();

  const modelo = detalle.modelo;
  if (!modelo) return null;

  const ubicacionesActivas = detalle.ubicaciones.filter((u) => u.activa);
  const nombreUbicacion = (id: string) => detalle.ubicaciones.find((u) => u.id === id)?.nombre ?? "—";
  const stockDe = (tallaId: string, ubicacionId: string) =>
    detalle.existencias.find((e) => e.talla_id === tallaId && e.ubicacion_id === ubicacionId)?.cantidad_actual ?? 0;
  const totalUbicacion = (ubicacionId: string) =>
    detalle.existencias.filter((e) => e.ubicacion_id === ubicacionId).reduce((acc, e) => acc + e.cantidad_actual, 0);
  // Tallas que ya tienen algún registro de existencias (en cualquier ubicación),
  // en el orden del catálogo de tallas.
  const tallasConStock = detalle.tallas.filter((t) => detalle.existencias.some((e) => e.talla_id === t.id));

  function guardarCosto() {
    startTransition(async () => {
      const res = await actualizarCostoModelo(modelo!.id, Number(costo) || 0, Number(precioVenta) || 0, categoria);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Costo y precio actualizados");
      setEditandoPrecio(false);
      router.refresh();
    });
  }

  function cancelarEdicionPrecio() {
    setCosto(modelo!.costo_unitario != null ? String(modelo!.costo_unitario) : "");
    setPrecioVenta(modelo!.precio_venta != null ? String(modelo!.precio_venta) : "");
    setCategoria(modelo!.categoria ?? "");
    setTallaIds(detalle.tallaIdsAsignadas);
    setPreciosPorTalla(
      Object.fromEntries(
        Object.entries(detalle.preciosPorTalla).map(([tallaId, precio]) => [tallaId, precio != null ? String(precio) : ""])
      )
    );
    setEditandoPrecio(false);
  }

  function alternarTalla(id: string) {
    setTallaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function actualizarPrecioTalla(id: string, valor: string) {
    setPreciosPorTalla((prev) => ({ ...prev, [id]: valor }));
  }

  function guardarTallas() {
    startTransitionTallas(async () => {
      const res = await guardarTallasModelo(
        modelo!.id,
        tallaIds.map((tallaId) => ({
          tallaId,
          precioVenta: preciosPorTalla[tallaId] ? Number(preciosPorTalla[tallaId]) : undefined,
        }))
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tallas actualizadas");
      setEditandoPrecio(false);
      router.refresh();
    });
  }

  // Precio a mostrar cuando hay precios distintos por talla: si varían,
  // muestra el rango (ej. "$625.00 - $640.00") en vez de un solo precio
  // (que podría no reflejar ninguna talla real si el precio general del
  // modelo se dejó en blanco).
  function precioVentaMostrar(): string {
    if (!detalle.tallaIdsAsignadas.length) {
      return modelo!.precio_venta != null ? formatearMoneda(modelo!.precio_venta) : "—";
    }
    const precios = detalle.tallaIdsAsignadas
      .map((id) => detalle.preciosPorTalla[id] ?? modelo!.precio_venta)
      .filter((p): p is number => p != null);
    if (!precios.length) return "—";
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? formatearMoneda(min) : `${formatearMoneda(min)} - ${formatearMoneda(max)}`;
  }

  function eliminar() {
    startTransitionEliminar(async () => {
      const res = await eliminarModelo(modelo!.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Producto eliminado");
      router.push("/inventario");
    });
  }

  function abrirAjuste(tallaId: string, codigo: string) {
    setTallaAjuste({ id: tallaId, codigo });
    setUbicacionAjusteId(ubicacionesActivas[0]?.id ?? "");
    setTipoAjuste("entrada");
    setCantidadAjuste("");
    setMotivoAjuste("");
  }

  function registrarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!tallaAjuste) return;
    if (!ubicacionAjusteId) {
      toast.error("Selecciona una ubicación");
      return;
    }
    startTransitionAjuste(async () => {
      const res = await crearMovimientoStockProducto({
        modeloId: modelo!.id,
        tallaId: tallaAjuste.id,
        ubicacionId: ubicacionAjusteId,
        tipo: tipoAjuste,
        cantidad: Number(cantidadAjuste),
        motivo: motivoAjuste,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Movimiento registrado");
      setTallaAjuste(null);
      router.refresh();
    });
  }

  function abrirTraspaso(tallaId: string, codigo: string) {
    // Origen sugerido: la ubicación con más piezas de esa talla; destino: otra.
    const conMasStock = [...ubicacionesActivas].sort((a, b) => stockDe(tallaId, b.id) - stockDe(tallaId, a.id))[0];
    const otra = ubicacionesActivas.find((u) => u.id !== conMasStock?.id);
    setTallaTraspaso({ id: tallaId, codigo });
    setOrigenTraspasoId(conMasStock?.id ?? "");
    setDestinoTraspasoId(otra?.id ?? "");
    setCantidadTraspaso("");
    setMotivoTraspaso("");
  }

  function registrarTraspaso(e: React.FormEvent) {
    e.preventDefault();
    if (!tallaTraspaso) return;
    if (!origenTraspasoId || !destinoTraspasoId) {
      toast.error("Selecciona el origen y el destino");
      return;
    }
    startTransitionTraspaso(async () => {
      const res = await traspasarStockProducto({
        modeloId: modelo!.id,
        tallaId: tallaTraspaso.id,
        origenId: origenTraspasoId,
        destinoId: destinoTraspasoId,
        cantidad: Number(cantidadTraspaso),
        motivo: motivoTraspaso,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Traspaso registrado");
      setTallaTraspaso(null);
      router.refresh();
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
                <AlertDialogTitle>¿Deseas eliminar este producto?</AlertDialogTitle>
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
          <p className="text-2xl font-semibold">{precioVentaMostrar()}</p>
        </div>
      </div>

      {ubicacionesActivas.length > 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ubicacionesActivas.map((u) => (
            <div key={u.id} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Existencias en {u.nombre}</p>
              <p className="text-2xl font-semibold">{totalUbicacion(u.id)}</p>
            </div>
          ))}
        </div>
      )}

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
              <p className="text-sm">{precioVentaMostrar()}</p>
              {precioVentaMostrar().includes(" - ") && (
                <p className="text-xs text-muted-foreground">Varía según la talla</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Tallas disponibles y precio por talla</h2>
        {editandoPrecio ? (
          <>
            <p className="text-xs text-muted-foreground">
              Si no eliges ninguna, se podrá usar cualquier talla del catálogo al crear pedidos u órdenes. Si dejas el
              precio en blanco, se usa el precio de venta general del producto.
            </p>
            <div className="flex flex-wrap gap-3">
              {detalle.tallas.map((talla) => {
                const activa = tallaIds.includes(talla.id);
                return (
                  <div
                    key={talla.id}
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                  >
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={activa}
                        onChange={() => alternarTalla(talla.id)}
                        className="size-4"
                      />
                      {talla.codigo}
                    </label>
                    {activa && (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={modelo.precio_venta != null ? String(modelo.precio_venta) : "Precio"}
                        className="h-7 w-24"
                        value={preciosPorTalla[talla.id] ?? ""}
                        onChange={(e) => actualizarPrecioTalla(talla.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <Button onClick={guardarTallas} disabled={guardandoTallas} size="sm" variant="outline">
              {guardandoTallas ? "Guardando..." : "Guardar tallas"}
            </Button>
          </>
        ) : detalle.tallaIdsAsignadas.length ? (
          <div className="flex flex-wrap gap-2">
            {detalle.tallaIdsAsignadas.map((tallaId) => {
              const codigo = detalle.tallas.find((t) => t.id === tallaId)?.codigo ?? "—";
              const precio = detalle.preciosPorTalla[tallaId];
              return (
                <Badge key={tallaId} variant="secondary">
                  {codigo}
                  {precio != null && ` · ${formatearMoneda(precio)}`}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin restricción de tallas — se puede usar cualquier talla del catálogo.
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Existencias por talla</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Talla</TableHead>
              {ubicacionesActivas.map((u) => (
                <TableHead key={u.id}>{u.nombre}</TableHead>
              ))}
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tallasConStock.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.codigo}</TableCell>
                {ubicacionesActivas.map((u) => (
                  <TableCell key={u.id}>{stockDe(t.id, u.id)}</TableCell>
                ))}
                <TableCell className="font-medium">
                  {detalle.existencias.filter((e) => e.talla_id === t.id).reduce((acc, e) => acc + e.cantidad_actual, 0)}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {ubicacionesActivas.length > 1 && (
                    <Button variant="outline" size="sm" onClick={() => abrirTraspaso(t.id, t.codigo)}>
                      <ArrowRightLeft className="size-3.5" />
                      Traspasar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => abrirAjuste(t.id, t.codigo)}>
                    Ajustar stock
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!tallasConStock.length && (
              <TableRow>
                <TableCell colSpan={ubicacionesActivas.length + 3} className="text-center text-muted-foreground">
                  Sin existencias todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {(() => {
          const tallasSinStock = detalle.tallas
            .filter((t) => !detalle.existencias.some((e) => e.talla_id === t.id))
            .filter((t) => !detalle.tallaIdsAsignadas.length || detalle.tallaIdsAsignadas.includes(t.id));
          if (!tallasSinStock.length) return null;
          return (
            <div className="mt-3 flex flex-wrap gap-2">
              {tallasSinStock.map((t) => (
                <Button key={t.id} variant="ghost" size="sm" onClick={() => abrirAjuste(t.id, t.codigo)}>
                  + Registrar stock en talla {t.codigo}
                </Button>
              ))}
            </div>
          );
        })()}
      </div>

      <Dialog open={!!tallaAjuste} onOpenChange={(v) => !v && setTallaAjuste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock · Talla {tallaAjuste?.codigo}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={registrarAjuste}>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Select
                items={ubicacionesActivas.map((u) => ({ value: u.id, label: u.nombre }))}
                value={ubicacionAjusteId}
                onValueChange={(v) => setUbicacionAjusteId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {ubicacionesActivas.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                items={[
                  { value: "entrada", label: "Entrada" },
                  { value: "salida", label: "Salida" },
                  { value: "ajuste", label: "Ajuste" },
                ]}
                value={tipoAjuste}
                onValueChange={(v) => setTipoAjuste((v ?? "entrada") as TipoMovimiento)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="salida">Salida</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidadAjuste">
                Cantidad {tipoAjuste === "ajuste" && "(negativa para restar)"}
              </Label>
              <Input
                id="cantidadAjuste"
                type="number"
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivoAjuste">Motivo (opcional)</Label>
              <Input id="motivoAjuste" value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={ajustando}>
              {ajustando ? "Guardando..." : "Registrar movimiento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tallaTraspaso} onOpenChange={(v) => !v && setTallaTraspaso(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traspasar existencias · Talla {tallaTraspaso?.codigo}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={registrarTraspaso}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Select
                  items={ubicacionesActivas.map((u) => ({ value: u.id, label: u.nombre }))}
                  value={origenTraspasoId}
                  onValueChange={(v) => setOrigenTraspasoId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ubicacionesActivas.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hacia</Label>
                <Select
                  items={ubicacionesActivas.map((u) => ({ value: u.id, label: u.nombre }))}
                  value={destinoTraspasoId}
                  onValueChange={(v) => setDestinoTraspasoId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {ubicacionesActivas.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidadTraspaso">
                Cantidad
                {tallaTraspaso && origenTraspasoId && (
                  <span className="font-normal text-muted-foreground">
                    {" "}(disponibles en {nombreUbicacion(origenTraspasoId)}: {stockDe(tallaTraspaso.id, origenTraspasoId)})
                  </span>
                )}
              </Label>
              <Input
                id="cantidadTraspaso"
                type="number"
                min={1}
                value={cantidadTraspaso}
                onChange={(e) => setCantidadTraspaso(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivoTraspaso">Motivo (opcional)</Label>
              <Input id="motivoTraspaso" value={motivoTraspaso} onChange={(e) => setMotivoTraspaso(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={traspasando}>
              {traspasando ? "Traspasando..." : "Registrar traspaso"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
                {` · ${nombreUbicacion(m.ubicacion_id)}`}
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
