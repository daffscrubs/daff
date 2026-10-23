"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Barcode, Check, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";
import { registrarVenta } from "@/actions/ventas.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatearMoneda } from "@/lib/dinero";
import { formatearHoraMexico } from "@/lib/fechas";
import { normalizarTexto } from "@/lib/texto";
import { cn } from "@/lib/utils";

export interface VarianteVenta {
  modeloId: string;
  tallaId: string;
  nombre: string;
  categoria: string | null;
  /** null cuando el producto no maneja tallas. */
  talla: string | null;
  ordenTalla: number;
  precio: number | null;
  codigoBarras: string | null;
  sku: string | null;
  /** Existencias por ubicación. */
  stock: Record<string, number>;
}

interface CajaAbierta {
  sesionId: string;
  ubicacionId: string;
  desde: string;
  abiertaPor: string;
}

type Metodo = "efectivo" | "transferencia" | "tarjeta";
const METODOS: { valor: Metodo; etiqueta: string }[] = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "transferencia", etiqueta: "Transferencia" },
  { valor: "tarjeta", etiqueta: "Tarjeta" },
];

// Todo el dinero se calcula en centavos enteros: con decimales de punto flotante $0.10 + $0.20 no es $0.30.
const aCentavos = (pesos: number) => Math.round(pesos * 100);
const aPesos = (centavos: number) => centavos / 100;
function leerCentavos(texto: string): number {
  const limpio = texto.replace(/[$,\s]/g, "");
  if (!limpio) return 0;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? aCentavos(n) : NaN;
}

const MAX_RESULTADOS = 48;
const CLAVE_UBICACION = "pos-ubicacion";

// Última ubicación usada en este equipo (cada mostrador suele vender desde una sola). Se lee del navegador con
// useSyncExternalStore: en el servidor no existe localStorage, y así la primera imagen coincide y no hay
// "saltos" al cargar. Si el navegador no deja guardar (modo privado), se recuerda en memoria durante la sesión.
let ubicacionElegida: string | null = null;
const oyentesUbicacion = new Set<() => void>();
const suscribirUbicacion = (aviso: () => void) => {
  oyentesUbicacion.add(aviso);
  return () => void oyentesUbicacion.delete(aviso);
};
function leerUbicacionGuardada(): string | null {
  if (ubicacionElegida) return ubicacionElegida;
  try {
    return localStorage.getItem(CLAVE_UBICACION);
  } catch {
    return null;
  }
}
function guardarUbicacion(id: string) {
  ubicacionElegida = id;
  try {
    localStorage.setItem(CLAVE_UBICACION, id);
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
  oyentesUbicacion.forEach((aviso) => aviso());
}

interface LineaCarrito {
  variante: VarianteVenta;
  cantidad: number;
}
const claveDe = (v: { modeloId: string; tallaId: string }) => `${v.modeloId}|${v.tallaId}`;

export function PuntoDeVenta({
  ubicaciones,
  cajasAbiertas,
  catalogo,
  clientes,
  puedeDescuentos,
  puedeVenderSinExistencias,
  puedeAbrirCaja,
}: {
  ubicaciones: { id: string; nombre: string }[];
  cajasAbiertas: CajaAbierta[];
  catalogo: VarianteVenta[];
  clientes: { id: string; nombre_comercial: string }[];
  puedeDescuentos: boolean;
  puedeVenderSinExistencias: boolean;
  puedeAbrirCaja: boolean;
}) {
  const router = useRouter();
  const inputBusqueda = useRef<HTMLInputElement>(null);
  const ubicacionGuardada = useSyncExternalStore(suscribirUbicacion, leerUbicacionGuardada, () => null);
  const ubicacionId = ubicaciones.some((u) => u.id === ubicacionGuardada)
    ? (ubicacionGuardada as string)
    : (cajasAbiertas[0]?.ubicacionId ?? ubicaciones[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [carrito, setCarritoEstado] = useState<Record<string, LineaCarrito>>({});
  // Copia siempre al día del carrito: un lector de código de barras puede mandar dos escaneos antes de que
  // React vuelva a dibujar, y cada uno debe sumar sobre el anterior, no sobre una imagen vieja del carrito.
  const carritoActual = useRef(carrito);
  const setCarrito = (siguiente: Record<string, LineaCarrito> | ((prev: Record<string, LineaCarrito>) => Record<string, LineaCarrito>)) => {
    const valor = typeof siguiente === "function" ? siguiente(carritoActual.current) : siguiente;
    carritoActual.current = valor;
    setCarritoEstado(valor);
  };
  const [clienteId, setClienteId] = useState("");
  const [descuentoTipo, setDescuentoTipo] = useState<"monto" | "porcentaje">("monto");
  const [descuentoTexto, setDescuentoTexto] = useState("");
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [venta, setVenta] = useState<{ id: string; folio: string; totalCentavos: number; cambioCentavos: number } | null>(null);

  const ubicacion = ubicaciones.find((u) => u.id === ubicacionId);
  const caja = cajasAbiertas.find((c) => c.ubicacionId === ubicacionId) ?? null;
  const stockEn = (v: VarianteVenta) => v.stock[ubicacionId] ?? 0;
  const maximo = (v: VarianteVenta) => (puedeVenderSinExistencias ? 9999 : Math.max(0, stockEn(v)));

  const categorias = useMemo(() => [...new Set(catalogo.map((v) => v.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "es")), [catalogo]);
  const indice = useMemo(
    () => catalogo.map((v) => ({ v, texto: normalizarTexto(`${v.nombre} ${v.categoria ?? ""} ${v.talla ?? ""} ${v.codigoBarras ?? ""} ${v.sku ?? ""}`) })),
    [catalogo]
  );
  const resultados = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    return indice.filter((x) => (categoria === "todas" || x.v.categoria === categoria) && (!q || x.texto.includes(q))).map((x) => x.v);
  }, [indice, busqueda, categoria]);

  function agregar(v: VarianteVenta) {
    if (!caja) {
      toast.error(`No hay una caja abierta en ${ubicacion?.nombre ?? "esta ubicación"}.`);
      return;
    }
    if (!v.precio || v.precio <= 0) {
      toast.error(`"${v.nombre}" no tiene precio de venta.`);
      return;
    }
    const actual = carritoActual.current[claveDe(v)]?.cantidad ?? 0;
    if (actual + 1 > maximo(v)) {
      toast.error(`Solo hay ${Math.max(0, stockEn(v))} de "${v.nombre}${v.talla ? ` ${v.talla}` : ""}" en ${ubicacion?.nombre}.`);
      return;
    }
    setCarrito((prev) => ({ ...prev, [claveDe(v)]: { variante: v, cantidad: actual + 1 } }));
  }

  function cambiarCantidad(clave: string, cantidad: number) {
    setCarrito((prev) => {
      const linea = prev[clave];
      if (!linea) return prev;
      const siguiente = { ...prev };
      if (!Number.isFinite(cantidad) || cantidad < 1) {
        delete siguiente[clave];
        return siguiente;
      }
      const tope = maximo(linea.variante);
      if (cantidad > tope) {
        toast.error(`Solo hay ${Math.max(0, stockEn(linea.variante))} disponibles en ${ubicacion?.nombre}.`);
        siguiente[clave] = { ...linea, cantidad: Math.max(1, tope) };
      } else {
        siguiente[clave] = { ...linea, cantidad: Math.floor(cantidad) };
      }
      return siguiente;
    });
  }

  function cambiarUbicacion(id: string) {
    guardarUbicacion(id);
    // Las existencias son de cada ubicación: se ajusta lo que ya estaba en el carrito.
    let ajustado = false;
    setCarrito((prev) => {
      const siguiente: Record<string, LineaCarrito> = {};
      for (const [clave, linea] of Object.entries(prev)) {
        const tope = puedeVenderSinExistencias ? 9999 : Math.max(0, linea.variante.stock[id] ?? 0);
        if (tope < 1) {
          ajustado = true;
          continue;
        }
        if (linea.cantidad > tope) ajustado = true;
        siguiente[clave] = { ...linea, cantidad: Math.min(linea.cantidad, tope) };
      }
      return siguiente;
    });
    setTimeout(() => ajustado && toast.info("Se ajustó el carrito a las existencias de esa ubicación."), 0);
  }

  function alEnter() {
    const q = busqueda.trim();
    if (!q) return;
    // Un lector de código de barras "teclea" el código y manda Enter: coincidencia exacta de código o SKU.
    const exacto = catalogo.find((v) => v.codigoBarras === q || (v.sku && v.sku.toLowerCase() === q.toLowerCase()));
    const elegido = exacto ?? (resultados.length === 1 ? resultados[0] : null);
    if (!elegido) {
      toast.info(resultados.length ? "Elige el producto de la lista." : "No se encontró ese código ni ese producto.");
      return;
    }
    agregar(elegido);
    setBusqueda("");
  }

  const lineas = Object.entries(carrito);
  const piezas = lineas.reduce((acc, [, l]) => acc + l.cantidad, 0);
  const subtotalCentavos = lineas.reduce((acc, [, l]) => acc + l.cantidad * aCentavos(l.variante.precio ?? 0), 0);
  const descuentoLeido = leerCentavos(descuentoTexto);
  const descuentoCentavos = !puedeDescuentos || Number.isNaN(descuentoLeido)
    ? 0
    : descuentoTipo === "monto"
      ? descuentoLeido
      : Math.round((subtotalCentavos * Math.min(descuentoLeido / 100, 100)) / 100);
  const descuentoInvalido = Number.isNaN(descuentoLeido) || descuentoCentavos >= subtotalCentavos + (subtotalCentavos ? 0 : 1);
  const totalCentavos = subtotalCentavos - (descuentoInvalido ? 0 : descuentoCentavos);
  const puedeCobrar = !!caja && lineas.length > 0 && !descuentoInvalido && totalCentavos > 0;

  function nuevaVenta() {
    setCarrito({});
    setClienteId("");
    setDescuentoTexto("");
    setVenta(null);
    setCobroAbierto(false);
    setTimeout(() => inputBusqueda.current?.focus(), 50);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Punto de venta</h1>
          <p className="text-muted-foreground">Busca o escanea un producto para agregarlo a la venta.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))}
            value={ubicacionId}
            onValueChange={(v) => v && cambiarUbicacion(v)}
          >
            <SelectTrigger className="h-10 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ubicaciones.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nombre}
                  {cajasAbiertas.some((c) => c.ubicacionId === u.id) ? "" : " (caja cerrada)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {caja ? (
            <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Caja abierta desde las {formatearHoraMexico(caja.desde)}
              {caja.abiertaPor ? ` · ${caja.abiertaPor}` : ""}
            </Badge>
          ) : (
            <Badge className="border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Caja cerrada</Badge>
          )}
        </div>
      </div>

      {!caja && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p>
            No hay una caja abierta en <strong>{ubicacion?.nombre}</strong>. Para vender, primero hay que abrirla con el fondo inicial.
          </p>
          {puedeAbrirCaja ? (
            <Button size="sm" render={<Link href={`/caja?ubicacion=${ubicacionId}`} />} nativeButton={false}>
              Abrir caja
            </Button>
          ) : (
            <span className="text-xs">Pídele a quien tenga permiso que la abra.</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_24rem]">
        {/* Productos */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputBusqueda}
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    alEnter();
                  }
                }}
                placeholder="Buscar por nombre, SKU o escanear código de barras"
                className="h-11 pl-9 text-sm"
              />
            </div>
            <Select
              items={[{ value: "todas", label: "Todas las categorías" }, ...categorias.map((c) => ({ value: c, label: c }))]}
              value={categoria}
              onValueChange={(v) => setCategoria(v ?? "todas")}
            >
              <SelectTrigger className="h-11 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {resultados.slice(0, MAX_RESULTADOS).map((v) => {
              const existencias = stockEn(v);
              const agotado = !puedeVenderSinExistencias && existencias <= 0;
              const sinPrecio = !v.precio || v.precio <= 0;
              return (
                <button
                  key={claveDe(v)}
                  type="button"
                  disabled={!caja || sinPrecio}
                  onClick={() => agregar(v)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
                    agotado && "opacity-70"
                  )}
                >
                  <span className="line-clamp-2 text-sm font-medium">{v.nombre}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {v.talla && <Badge variant="secondary">{v.talla}</Badge>}
                    {v.categoria}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-base font-semibold">{sinPrecio ? "Sin precio" : formatearMoneda(v.precio!)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        existencias > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      )}
                    >
                      {existencias > 0 ? `${existencias} disp.` : "Sin existencias"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!resultados.length && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              <Barcode className="size-8" />
              No se encontró ningún producto con esa búsqueda.
            </div>
          )}
          {resultados.length > MAX_RESULTADOS && (
            <p className="text-center text-xs text-muted-foreground">
              Mostrando {MAX_RESULTADOS} de {resultados.length.toLocaleString("es-MX")}. Escribe más para afinar la búsqueda.
            </p>
          )}
        </div>

        {/* Carrito */}
        <div className="flex h-fit flex-col rounded-xl border bg-card lg:sticky lg:top-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="size-4" />
              Venta actual
            </p>
            {lineas.length > 0 && (
              <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setCarrito({})}>
                Vaciar
              </button>
            )}
          </div>

          <div className="max-h-[42vh] min-h-24 divide-y overflow-y-auto">
            {lineas.map(([clave, l]) => (
              <div key={clave} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight">
                    {l.variante.nombre}
                    {l.variante.talla && <span className="text-muted-foreground"> · {l.variante.talla}</span>}
                  </p>
                  <button type="button" aria-label="Quitar del carrito" className="text-muted-foreground hover:text-destructive" onClick={() => cambiarCantidad(clave, 0)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Menos" onClick={() => cambiarCantidad(clave, l.cantidad - 1)}>
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Cantidad de ${l.variante.nombre}`}
                      className="h-7 w-14 px-1 text-center"
                      value={l.cantidad}
                      onChange={(e) => cambiarCantidad(clave, Number(e.target.value))}
                    />
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Más" onClick={() => cambiarCantidad(clave, l.cantidad + 1)}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatearMoneda(aPesos(l.cantidad * aCentavos(l.variante.precio ?? 0)))}</p>
                    <p className="text-xs text-muted-foreground">{formatearMoneda(l.variante.precio ?? 0)} c/u</p>
                  </div>
                </div>
              </div>
            ))}
            {!lineas.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aún no hay productos en la venta.</p>}
          </div>

          <div className="space-y-3 border-t px-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
              <Select
                items={[{ value: "", label: "Público en general" }, ...clientes.map((c) => ({ value: c.id, label: c.nombre_comercial }))]}
                value={clienteId}
                onValueChange={(v) => setClienteId(v ?? "")}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Público en general" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Público en general</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre_comercial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {puedeDescuentos && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descuento</Label>
                <div className="flex gap-2">
                  <div className="flex rounded-lg border p-0.5">
                    <Button type="button" size="xs" variant={descuentoTipo === "monto" ? "default" : "ghost"} onClick={() => setDescuentoTipo("monto")}>
                      $
                    </Button>
                    <Button type="button" size="xs" variant={descuentoTipo === "porcentaje" ? "default" : "ghost"} onClick={() => setDescuentoTipo("porcentaje")}>
                      %
                    </Button>
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder={descuentoTipo === "monto" ? "0.00" : "0"}
                    className={cn("h-8", descuentoInvalido && descuentoTexto && "border-destructive")}
                    value={descuentoTexto}
                    onChange={(e) => setDescuentoTexto(e.target.value)}
                  />
                </div>
                {descuentoInvalido && descuentoTexto && <p className="text-xs text-destructive">El descuento no puede ser igual o mayor al subtotal.</p>}
              </div>
            )}

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>
                  Subtotal · {piezas} pieza{piezas === 1 ? "" : "s"}
                </span>
                <span>{formatearMoneda(aPesos(subtotalCentavos))}</span>
              </div>
              {descuentoCentavos > 0 && !descuentoInvalido && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento</span>
                  <span>-{formatearMoneda(aPesos(descuentoCentavos))}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold">{formatearMoneda(aPesos(totalCentavos))}</span>
              </div>
            </div>

            <Button type="button" className="h-12 w-full text-base" disabled={!puedeCobrar} onClick={() => setCobroAbierto(true)}>
              Cobrar {lineas.length ? formatearMoneda(aPesos(totalCentavos)) : ""}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={cobroAbierto} onOpenChange={(abierto) => !abierto && !venta && setCobroAbierto(false)}>
        <DialogContent className="sm:max-w-lg">
          {cobroAbierto && (
            <Cobro
              totalCentavos={totalCentavos}
              venta={venta}
              alCancelar={() => setCobroAbierto(false)}
              alNuevaVenta={nuevaVenta}
              alVender={async (pagos) => {
                const res = await registrarVenta({
                  ubicacionId,
                  clienteId: clienteId || null,
                  items: lineas.map(([, l]) => ({ modeloId: l.variante.modeloId, tallaId: l.variante.tallaId, cantidad: l.cantidad })),
                  pagos: pagos.map((p) => ({ metodo: p.metodo, monto: aPesos(p.montoCentavos), recibido: p.recibidoCentavos ? aPesos(p.recibidoCentavos) : undefined, referencia: p.referencia || undefined })),
                  descuento: aPesos(descuentoInvalido ? 0 : descuentoCentavos),
                });
                if (!res.ok) {
                  toast.error(res.error);
                  return false;
                }
                const efectivo = pagos.find((p) => p.metodo === "efectivo");
                setVenta({
                  id: res.data.id,
                  folio: res.data.folio,
                  totalCentavos,
                  cambioCentavos: efectivo?.recibidoCentavos ? efectivo.recibidoCentavos - efectivo.montoCentavos : 0,
                });
                router.refresh();
                return true;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PagoCapturado {
  metodo: Metodo;
  montoCentavos: number;
  recibidoCentavos?: number;
  referencia?: string;
}

function Cobro({
  totalCentavos,
  venta,
  alCancelar,
  alNuevaVenta,
  alVender,
}: {
  totalCentavos: number;
  venta: { id: string; folio: string; totalCentavos: number; cambioCentavos: number } | null;
  alCancelar: () => void;
  alNuevaVenta: () => void;
  alVender: (pagos: PagoCapturado[]) => Promise<boolean>;
}) {
  const [montos, setMontos] = useState<Record<Metodo, string>>({ efectivo: String(aPesos(totalCentavos)), transferencia: "", tarjeta: "" });
  const [recibido, setRecibido] = useState("");
  const [referencia, setReferencia] = useState("");
  const [procesando, startTransition] = useTransition();

  if (venta) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Check className="size-7" />
        </div>
        <div>
          <p className="text-lg font-semibold">Venta registrada</p>
          <p className="font-mono text-sm text-muted-foreground">{venta.folio}</p>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Total cobrado</p>
          <p className="text-3xl font-bold">{formatearMoneda(aPesos(venta.totalCentavos))}</p>
          {venta.cambioCentavos > 0 && (
            <p className="pt-2 text-lg">
              Cambio: <strong>{formatearMoneda(aPesos(venta.cambioCentavos))}</strong>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" render={<a href={`/api/pdf/ventas/${venta.id}`} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
            <Printer className="size-4" />
            Imprimir ticket
          </Button>
          <Button className="flex-1" onClick={alNuevaVenta}>
            Nueva venta
          </Button>
        </div>
      </div>
    );
  }

  const centavos = Object.fromEntries(METODOS.map((m) => [m.valor, leerCentavos(montos[m.valor])])) as Record<Metodo, number>;
  const hayError = METODOS.some((m) => Number.isNaN(centavos[m.valor]));
  const suma = hayError ? 0 : METODOS.reduce((acc, m) => acc + centavos[m.valor], 0);
  const restante = totalCentavos - suma;
  const efectivoCentavos = Number.isNaN(centavos.efectivo) ? 0 : centavos.efectivo;
  const recibidoLeido = recibido.trim() ? leerCentavos(recibido) : efectivoCentavos;
  const recibidoValido = efectivoCentavos === 0 || (!Number.isNaN(recibidoLeido) && recibidoLeido >= efectivoCentavos);
  const cambio = efectivoCentavos > 0 && recibidoValido ? recibidoLeido - efectivoCentavos : 0;
  const puedeConfirmar = !hayError && restante === 0 && recibidoValido && suma > 0;

  const completarCon = (metodo: Metodo) => {
    const otros = METODOS.filter((m) => m.valor !== metodo).reduce((acc, m) => acc + (Number.isNaN(centavos[m.valor]) ? 0 : centavos[m.valor]), 0);
    setMontos((prev) => ({ ...prev, [metodo]: String(aPesos(Math.max(0, totalCentavos - otros))) }));
  };
  const soloCon = (metodo: Metodo) =>
    setMontos({ efectivo: "", transferencia: "", tarjeta: "", [metodo]: String(aPesos(totalCentavos)) } as Record<Metodo, string>);

  function confirmar() {
    const pagos: PagoCapturado[] = METODOS.filter((m) => centavos[m.valor] > 0).map((m) => ({
      metodo: m.valor,
      montoCentavos: centavos[m.valor],
      recibidoCentavos: m.valor === "efectivo" ? recibidoLeido : undefined,
      referencia: m.valor !== "efectivo" ? referencia.trim() : undefined,
    }));
    startTransition(async () => {
      await alVender(pagos);
    });
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Cobrar venta</DialogTitle>
      </DialogHeader>
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">Total a cobrar</p>
        <p className="text-4xl font-bold">{formatearMoneda(aPesos(totalCentavos))}</p>
      </div>

      <div className="space-y-2">
        {METODOS.map((m) => (
          <div key={m.valor} className={cn("rounded-lg border p-3", centavos[m.valor] > 0 && "border-primary bg-primary/5")}>
            <div className="flex items-center gap-2">
              <Label className="w-28 shrink-0 text-sm font-medium">{m.etiqueta}</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                aria-label={`Monto en ${m.etiqueta.toLowerCase()}`}
                className={cn("h-9", Number.isNaN(centavos[m.valor]) && "border-destructive")}
                value={montos[m.valor]}
                onChange={(e) => setMontos((prev) => ({ ...prev, [m.valor]: e.target.value }))}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => soloCon(m.valor)}>
                Todo
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={restante <= 0} onClick={() => completarCon(m.valor)}>
                Resto
              </Button>
            </div>
            {m.valor === "efectivo" && efectivoCentavos > 0 && (
              <div className="mt-3 space-y-2 pl-0.5">
                <div className="flex items-center gap-2">
                  <Label className="w-28 shrink-0 text-xs text-muted-foreground">Recibido</Label>
                  <Input
                    inputMode="decimal"
                    placeholder={String(aPesos(efectivoCentavos))}
                    aria-label="Efectivo recibido"
                    className={cn("h-9", !recibidoValido && "border-destructive")}
                    value={recibido}
                    onChange={(e) => setRecibido(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pl-[7.5rem]">
                  {[20, 50, 100, 200, 500, 1000].map((b) => (
                    <Button key={b} type="button" variant="outline" size="xs" onClick={() => setRecibido(String(b))}>
                      ${b}
                    </Button>
                  ))}
                  <Button type="button" variant="outline" size="xs" onClick={() => setRecibido(String(aPesos(efectivoCentavos)))}>
                    Exacto
                  </Button>
                </div>
                {!recibidoValido && <p className="pl-[7.5rem] text-xs text-destructive">El efectivo recibido no cubre lo que se cobra en efectivo.</p>}
              </div>
            )}
          </div>
        ))}
        {(centavos.transferencia > 0 || centavos.tarjeta > 0) && (
          <Input placeholder="Referencia o últimos dígitos (opcional)" className="h-9" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        )}
      </div>

      <div className="space-y-1 rounded-lg border p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagado</span>
          <span>{formatearMoneda(aPesos(suma))}</span>
        </div>
        <div className={cn("flex justify-between font-medium", restante > 0 && "text-amber-600", restante < 0 && "text-destructive")}>
          <span>{restante < 0 ? "Se pasa por" : "Falta por cobrar"}</span>
          <span>{formatearMoneda(aPesos(Math.abs(restante)))}</span>
        </div>
        {cambio > 0 && (
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>Cambio</span>
            <span>{formatearMoneda(aPesos(cambio))}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={alCancelar} disabled={procesando}>
          Volver
        </Button>
        <Button type="button" className="h-11 flex-[2] text-base" disabled={!puedeConfirmar || procesando} onClick={confirmar}>
          {procesando ? "Registrando..." : "Confirmar venta"}
        </Button>
      </div>
    </div>
  );
}
