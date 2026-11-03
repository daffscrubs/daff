"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { eliminarModelo, guardarProducto } from "@/actions/catalogos.actions";
import { traspasarStockProducto } from "@/actions/stockProductos.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatearMoneda } from "@/lib/dinero";
import { TALLA_SIN_TALLAS } from "@/lib/inventario/etiquetas";

export type DetalleModelo = Awaited<ReturnType<typeof obtenerDetalleModelo>>;

// Lo que se edita en pantalla. Todo son textos para que escribir sea fluido; se convierten a
// número hasta el momento de guardar.
interface Fila {
  tallaId: string;
  precio: string;
  costo: string;
  codigoBarras: string;
  sku: string;
  existencias: Record<string, string>; // por ubicación
}

interface Borrador {
  nombre: string;
  descripcion: string;
  categoria: string;
  filas: Fila[];
}

const aTexto = (n: number | null | undefined) => (n != null ? String(n) : "");
const aNumero = (t: string) => (t.trim() === "" ? 0 : Number(t));

export function DetalleProducto({ detalle }: { detalle: DetalleModelo }) {
  const router = useRouter();
  const modelo = detalle.modelo;
  const ubicaciones = detalle.ubicaciones.filter((u) => u.activa);
  const varias = ubicaciones.length > 1;

  function armarBorrador(): Borrador {
    const conStock = new Set(detalle.existencias.map((e) => e.talla_id));
    const asignadas = new Map(detalle.variantes.map((v) => [v.tallaId, v]));
    const filas = detalle.tallas
      .filter((t) => asignadas.has(t.id) || conStock.has(t.id))
      .map<Fila>((t) => {
        const v = asignadas.get(t.id);
        return {
          tallaId: t.id,
          precio: aTexto(v?.precioVenta ?? modelo?.precio_venta),
          costo: aTexto(v?.costoUnitario ?? modelo?.costo_unitario),
          codigoBarras: v?.codigoBarras ?? "",
          sku: v?.sku ?? "",
          existencias: Object.fromEntries(
            ubicaciones.map((u) => [
              u.id,
              String(detalle.existencias.find((e) => e.talla_id === t.id && e.ubicacion_id === u.id)?.cantidad_actual ?? 0),
            ])
          ),
        };
      });
    return { nombre: modelo?.nombre ?? "", descripcion: modelo?.descripcion ?? "", categoria: modelo?.categoria ?? "", filas };
  }

  // "base" es lo último guardado; "borrador" lo que hay en pantalla. Tras guardar, la base se
  // iguala al borrador (sin esperar a que lleguen los datos nuevos del servidor).
  const [base, setBase] = useState<Borrador>(armarBorrador);
  const [borrador, setBorrador] = useState<Borrador>(base);
  const [ubicacionVista, setUbicacionVista] = useState(ubicaciones[0]?.id ?? "");
  const [masDatos, setMasDatos] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();
  const [eliminando, startEliminar] = useTransition();

  const [traspasoTalla, setTraspasoTalla] = useState<string | null>(null);
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [cantidadTraspaso, setCantidadTraspaso] = useState("");
  const [motivoTraspaso, setMotivoTraspaso] = useState("");
  const [traspasando, startTraspaso] = useTransition();

  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(base);

  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambios]);

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        document.getElementById("guardar-producto")?.click();
      }
    };
    window.addEventListener("keydown", atajo);
    return () => window.removeEventListener("keydown", atajo);
  }, []);

  if (!modelo) return null;

  const nombreTalla = (id: string) => {
    const codigo = detalle.tallas.find((t) => t.id === id)?.codigo ?? "—";
    return codigo.toUpperCase() === TALLA_SIN_TALLAS ? "Única" : codigo;
  };
  const nombreUbicacion = (id: string) => detalle.ubicaciones.find((u) => u.id === id)?.nombre ?? "—";
  const existenciaGuardada = (tallaId: string, ubicacionId: string) =>
    detalle.existencias.find((e) => e.talla_id === tallaId && e.ubicacion_id === ubicacionId)?.cantidad_actual ?? 0;
  const totalGuardadoTalla = (tallaId: string) =>
    detalle.existencias.filter((e) => e.talla_id === tallaId).reduce((acc, e) => acc + e.cantidad_actual, 0);
  const totalFila = (f: Fila) => ubicaciones.reduce((acc, u) => acc + aNumero(f.existencias[u.id] ?? ""), 0);

  const existenciasTotal = borrador.filas.reduce((acc, f) => acc + totalFila(f), 0);
  const valorInventario = borrador.filas.reduce((acc, f) => acc + totalFila(f) * (Number(f.costo) || 0), 0);
  const precios = borrador.filas.map((f) => Number(f.precio)).filter((p) => precioValido(p));
  const rangoPrecio = precios.length
    ? Math.min(...precios) === Math.max(...precios)
      ? formatearMoneda(precios[0])
      : `${formatearMoneda(Math.min(...precios))} - ${formatearMoneda(Math.max(...precios))}`
    : "—";

  const tallasFaltantes = detalle.tallas.filter((t) => !borrador.filas.some((f) => f.tallaId === t.id));
  const filaEditando = borrador.filas.find((f) => f.tallaId === masDatos) ?? null;

  function cambiarGeneral(parche: Partial<Omit<Borrador, "filas">>) {
    setBorrador((b) => ({ ...b, ...parche }));
  }

  function cambiarFila(tallaId: string, parche: Partial<Omit<Fila, "existencias">>) {
    setBorrador((b) => ({ ...b, filas: b.filas.map((f) => (f.tallaId === tallaId ? { ...f, ...parche } : f)) }));
  }

  function cambiarExistencia(tallaId: string, ubicacionId: string, valor: string) {
    setBorrador((b) => ({
      ...b,
      filas: b.filas.map((f) => (f.tallaId === tallaId ? { ...f, existencias: { ...f.existencias, [ubicacionId]: valor } } : f)),
    }));
  }

  function agregarTalla(tallaId: string) {
    setBorrador((b) => {
      const orden = new Map(detalle.tallas.map((t, i) => [t.id, i]));
      const nueva: Fila = {
        tallaId,
        precio: aTexto(modelo!.precio_venta),
        costo: aTexto(modelo!.costo_unitario),
        codigoBarras: "",
        sku: "",
        existencias: Object.fromEntries(ubicaciones.map((u) => [u.id, "0"])),
      };
      return { ...b, filas: [...b.filas, nueva].sort((a, c) => (orden.get(a.tallaId) ?? 0) - (orden.get(c.tallaId) ?? 0)) };
    });
  }

  function quitarTalla(tallaId: string) {
    setBorrador((b) => ({ ...b, filas: b.filas.filter((f) => f.tallaId !== tallaId) }));
  }

  function guardar() {
    const nombre = borrador.nombre.trim();
    if (nombre.length < 2) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }
    for (const f of borrador.filas) {
      const etiqueta = `Talla ${nombreTalla(f.tallaId)}`;
      if (f.precio.trim() !== "" && !(Number(f.precio) >= 0)) return void toast.error(`${etiqueta}: el precio no es válido`);
      if (f.costo.trim() !== "" && !(Number(f.costo) >= 0)) return void toast.error(`${etiqueta}: el costo no es válido`);
      for (const u of ubicaciones) {
        const n = aNumero(f.existencias[u.id] ?? "");
        if (!Number.isInteger(n) || n < 0) return void toast.error(`${etiqueta}: las existencias en ${u.nombre} deben ser un número entero, 0 o mayor`);
      }
    }

    // Solo viajan las existencias que cambiaron respecto a lo guardado.
    const existencias = borrador.filas.flatMap((f) =>
      ubicaciones
        .filter((u) => aNumero(f.existencias[u.id] ?? "") !== existenciaGuardada(f.tallaId, u.id))
        .map((u) => ({ tallaId: f.tallaId, ubicacionId: u.id, cantidad: aNumero(f.existencias[u.id] ?? "") }))
    );

    startGuardar(async () => {
      const res = await guardarProducto({
        modeloId: modelo!.id,
        nombre,
        descripcion: borrador.descripcion,
        categoria: borrador.categoria,
        variantes: borrador.filas.map((f) => ({
          tallaId: f.tallaId,
          precioVenta: f.precio.trim() === "" ? null : Number(f.precio),
          costoUnitario: f.costo.trim() === "" ? null : Number(f.costo),
          codigoBarras: f.codigoBarras,
          sku: f.sku,
        })),
        existencias,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Producto guardado");
      setBase(borrador);
      router.refresh();
    });
  }

  function eliminar() {
    startEliminar(async () => {
      const res = await eliminarModelo(modelo!.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Producto eliminado");
      router.push("/inventario");
    });
  }

  function abrirTraspaso(tallaId: string) {
    // Origen sugerido: la ubicación con más piezas de esa talla; destino: otra.
    const conMasStock = [...ubicaciones].sort((a, b) => existenciaGuardada(tallaId, b.id) - existenciaGuardada(tallaId, a.id))[0];
    setTraspasoTalla(tallaId);
    setOrigenId(conMasStock?.id ?? "");
    setDestinoId(ubicaciones.find((u) => u.id !== conMasStock?.id)?.id ?? "");
    setCantidadTraspaso("");
    setMotivoTraspaso("");
  }

  function registrarTraspaso(e: React.FormEvent) {
    e.preventDefault();
    if (!traspasoTalla) return;
    if (!origenId || !destinoId) {
      toast.error("Selecciona el origen y el destino");
      return;
    }
    startTraspaso(async () => {
      const res = await traspasarStockProducto({
        modeloId: modelo!.id,
        tallaId: traspasoTalla,
        origenId,
        destinoId,
        cantidad: Number(cantidadTraspaso),
        motivo: motivoTraspaso,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Traspaso registrado");
      setTraspasoTalla(null);
      setMasDatos(null);
      // La página se vuelve a montar con las existencias nuevas (ver la `key` en la página).
      router.refresh();
    });
  }

  const opcionesUbicacion = ubicaciones.map((u) => ({ value: u.id, label: u.nombre }));

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/inventario")} aria-label="Volver al inventario">
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="truncate text-2xl font-semibold">{base.nombre}</h1>
        </div>
        <div className="flex items-center gap-2">
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
          <Button id="guardar-producto" onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Existencias totales</p>
          <p className="text-2xl font-semibold">{existenciasTotal}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Valor en inventario (a costo)</p>
          <p className="text-2xl font-semibold">{valorInventario > 0 ? formatearMoneda(valorInventario) : "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Precio de venta</p>
          <p className="text-2xl font-semibold">{rangoPrecio}</p>
        </div>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Datos del producto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombreProducto">Nombre del producto</Label>
            <Input id="nombreProducto" value={borrador.nombre} onChange={(e) => cambiarGeneral({ nombre: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoriaProducto">Categoría</Label>
            <Input
              id="categoriaProducto"
              placeholder="Filipina, pantalón, bata..."
              value={borrador.categoria}
              onChange={(e) => cambiarGeneral({ categoria: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="descripcionProducto">Descripción</Label>
          <Textarea
            id="descripcionProducto"
            rows={2}
            value={borrador.descripcion}
            onChange={(e) => cambiarGeneral({ descripcion: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Variantes</h2>
          <p className="text-sm text-muted-foreground">
            Cada talla con sus existencias, costo y precio. Cambia lo que necesites y guarda al final.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Variante</th>
                <th className="px-2 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    Existencias
                    {varias && (
                      <Select items={opcionesUbicacion} value={ubicacionVista} onValueChange={(v) => setUbicacionVista(v ?? "")}>
                        <SelectTrigger className="h-7 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {opcionesUbicacion.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </th>
                {varias && <th className="px-2 py-3 font-medium">Total</th>}
                <th className="px-2 py-3 font-medium">Costo</th>
                <th className="px-2 py-3 font-medium">Precio público</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {borrador.filas.map((f) => {
                const guardadaEnBase = totalGuardadoTalla(f.tallaId) !== 0;
                return (
                  <tr key={f.tallaId} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{nombreTalla(f.tallaId)}</td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        className="w-28"
                        aria-label={`Existencias de la talla ${nombreTalla(f.tallaId)}`}
                        value={f.existencias[ubicacionVista] ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => cambiarExistencia(f.tallaId, ubicacionVista, e.target.value)}
                      />
                    </td>
                    {varias && <td className="px-2 py-2 text-muted-foreground">{totalFila(f)}</td>}
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className="w-28"
                        aria-label={`Costo de la talla ${nombreTalla(f.tallaId)}`}
                        value={f.costo}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => cambiarFila(f.tallaId, { costo: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className="w-28"
                        aria-label={`Precio de la talla ${nombreTalla(f.tallaId)}`}
                        value={f.precio}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => cambiarFila(f.tallaId, { precio: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setMasDatos(f.tallaId)}>
                          Más datos
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={guardadaEnBase || borrador.filas.length === 1}
                          title={
                            guardadaEnBase
                              ? "Tiene existencias: déjalas en 0 y guarda antes de quitar la talla"
                              : borrador.filas.length === 1
                                ? "El producto necesita al menos una talla"
                                : "Quitar esta talla"
                          }
                          aria-label={`Quitar la talla ${nombreTalla(f.tallaId)}`}
                          onClick={() => quitarTalla(f.tallaId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tallasFaltantes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Agregar talla:</span>
            {tallasFaltantes.map((t) => (
              <Button key={t.id} variant="outline" size="sm" onClick={() => agregarTalla(t.id)}>
                <Plus className="size-3.5" />
                {nombreTalla(t.id)}
              </Button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Historial</h2>
        <ul className="space-y-2">
          {detalle.movimientos.map((m) => {
            const delta = m.tipo === "salida" ? -m.cantidad : m.cantidad;
            return (
              <li key={m.id} className="rounded-lg border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="capitalize">{m.tipo}</span>
                  <Badge variant={delta < 0 ? "destructive" : "secondary"}>
                    {delta > 0 ? "+" : ""}
                    {delta} · {nombreTalla(m.talla_id)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString("es-MX")}
                  {` · ${nombreUbicacion(m.ubicacion_id)}`}
                  {m.lotes_produccion?.folio && ` · Orden ${m.lotes_produccion.folio}`}
                  {m.motivo && ` · ${m.motivo}`}
                </p>
              </li>
            );
          })}
          {!detalle.movimientos.length && <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>}
        </ul>
      </section>

      {hayCambios && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-6 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm font-medium">Tienes cambios sin guardar</p>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={guardando} onClick={() => setBorrador(base)}>
                Descartar
              </Button>
              <Button disabled={guardando} onClick={guardar}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!filaEditando} onOpenChange={(v) => !v && setMasDatos(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar {borrador.nombre} · {filaEditando ? nombreTalla(filaEditando.tallaId) : ""}
            </DialogTitle>
          </DialogHeader>
          {filaEditando && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="skuVariante">SKU</Label>
                  <Input
                    id="skuVariante"
                    placeholder="Opcional"
                    value={filaEditando.sku}
                    onChange={(e) => cambiarFila(filaEditando.tallaId, { sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barrasVariante">Código de barras</Label>
                  <Input
                    id="barrasVariante"
                    placeholder="Opcional"
                    value={filaEditando.codigoBarras}
                    onChange={(e) => cambiarFila(filaEditando.tallaId, { codigoBarras: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="costoVariante">Costo por unidad</Label>
                  <Input
                    id="costoVariante"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={filaEditando.costo}
                    onChange={(e) => cambiarFila(filaEditando.tallaId, { costo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioVariante">Precio público</Label>
                  <Input
                    id="precioVariante"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={filaEditando.precio}
                    onChange={(e) => cambiarFila(filaEditando.tallaId, { precio: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Existencias por ubicación</Label>
                <div className="divide-y rounded-lg border">
                  {ubicaciones.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm">{u.nombre}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        className="w-28"
                        aria-label={`Existencias en ${u.nombre}`}
                        value={filaEditando.existencias[u.id] ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => cambiarExistencia(filaEditando.tallaId, u.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {varias && (
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={hayCambios}
                    onClick={() => abrirTraspaso(filaEditando.tallaId)}
                  >
                    <ArrowRightLeft className="size-3.5" />
                    Traspasar entre ubicaciones
                  </Button>
                  {hayCambios && <p className="text-xs text-muted-foreground">Guarda los cambios para poder traspasar.</p>}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setMasDatos(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!traspasoTalla} onOpenChange={(v) => !v && setTraspasoTalla(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traspasar existencias · Talla {traspasoTalla ? nombreTalla(traspasoTalla) : ""}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={registrarTraspaso}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Desde</Label>
                <Select items={opcionesUbicacion} value={origenId} onValueChange={(v) => setOrigenId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcionesUbicacion.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hacia</Label>
                <Select items={opcionesUbicacion} value={destinoId} onValueChange={(v) => setDestinoId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcionesUbicacion.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cantidadTraspaso">
                Cantidad
                {traspasoTalla && origenId && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (disponibles en {nombreUbicacion(origenId)}: {existenciaGuardada(traspasoTalla, origenId)})
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
    </div>
  );
}

function precioValido(n: number) {
  return Number.isFinite(n) && n > 0;
}
