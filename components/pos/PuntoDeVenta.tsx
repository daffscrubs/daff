"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Landmark, Minus, PackagePlus, Percent, Plus, Printer, ScanBarcode, Search, Trash2, UserPlus, X, type LucideIcon } from "lucide-react";
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

type TipoDescuento = "monto" | "porcentaje";

// Cada pestaña es una venta en curso: permite atender a otra persona sin perder lo que ya se capturó.
interface VentaAbierta {
  id: string;
  nombre: string;
  carrito: Record<string, LineaCarrito>;
  clienteId: string;
  descuentoTipo: TipoDescuento;
  descuentoTexto: string;
}
const ventaVacia = (id: string, nombre: string): VentaAbierta => ({ id, nombre, carrito: {}, clienteId: "", descuentoTipo: "monto", descuentoTexto: "" });
const MAX_VENTAS = 5;

function Atajo({ icono: Icono, titulo, detalle, color, ...accion }: { icono: LucideIcon; titulo: string; detalle?: string; color: string } & ({ href: string } | { onClick: () => void })) {
  const contenido = (
    <>
      <span className={cn("flex size-11 items-center justify-center rounded-xl", color)}>
        <Icono className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-medium leading-tight">{titulo}</span>
        {detalle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detalle}</span>}
      </span>
    </>
  );
  const clases = "flex flex-col items-start gap-3 bg-card p-5 text-left transition-colors hover:bg-muted/60";
  return "href" in accion ? (
    <Link href={accion.href} className={clases}>
      {contenido}
    </Link>
  ) : (
    <button type="button" onClick={accion.onClick} className={clases}>
      {contenido}
    </button>
  );
}

export function PuntoDeVenta({
  ubicaciones,
  cajasAbiertas,
  catalogo,
  clientes,
  puedeDescuentos,
  puedeVenderSinExistencias,
  puedeAbrirCaja,
  puedeVerCaja,
  puedeCrearProductos,
}: {
  ubicaciones: { id: string; nombre: string }[];
  cajasAbiertas: CajaAbierta[];
  catalogo: VarianteVenta[];
  clientes: { id: string; nombre_comercial: string }[];
  puedeDescuentos: boolean;
  puedeVenderSinExistencias: boolean;
  puedeAbrirCaja: boolean;
  puedeVerCaja: boolean;
  puedeCrearProductos: boolean;
}) {
  const router = useRouter();
  const inputBusqueda = useRef<HTMLInputElement>(null);
  const ubicacionGuardada = useSyncExternalStore(suscribirUbicacion, leerUbicacionGuardada, () => null);
  const ubicacionId = ubicaciones.some((u) => u.id === ubicacionGuardada)
    ? (ubicacionGuardada as string)
    : (cajasAbiertas[0]?.ubicacionId ?? ubicaciones[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");

  const [ventas, setVentasEstado] = useState<VentaAbierta[]>(() => [ventaVacia("v1", "Venta 1")]);
  const [activaId, setActivaIdEstado] = useState("v1");
  // Copias siempre al día: un lector de código de barras puede mandar dos escaneos antes de que React vuelva a
  // dibujar, y cada uno debe sumar sobre el anterior, no sobre una imagen vieja del carrito.
  const ventasActual = useRef(ventas);
  const activaActual = useRef(activaId);
  const contadorVentas = useRef(1);
  const setVentas = (siguiente: VentaAbierta[]) => {
    ventasActual.current = siguiente;
    setVentasEstado(siguiente);
  };
  const setActivaId = (id: string) => {
    activaActual.current = id;
    setActivaIdEstado(id);
  };
  const editarActiva = (cambio: (v: VentaAbierta) => VentaAbierta) =>
    setVentas(ventasActual.current.map((v) => (v.id === activaActual.current ? cambio(v) : v)));
  const carritoActual = () => ventasActual.current.find((v) => v.id === activaActual.current)?.carrito ?? {};
  const setCarrito = (cambio: (prev: Record<string, LineaCarrito>) => Record<string, LineaCarrito>) =>
    editarActiva((v) => ({ ...v, carrito: cambio(v.carrito) }));

  const activa = ventas.find((v) => v.id === activaId) ?? ventas[0];
  const { carrito, clienteId, descuentoTipo, descuentoTexto } = activa;
  const [clienteAbierto, setClienteAbierto] = useState(false);
  const [descuentoAbierto, setDescuentoAbierto] = useState(false);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [venta, setVenta] = useState<{ id: string; folio: string; totalCentavos: number; cambioCentavos: number } | null>(null);

  const ubicacion = ubicaciones.find((u) => u.id === ubicacionId);
  const caja = cajasAbiertas.find((c) => c.ubicacionId === ubicacionId) ?? null;
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const stockEn = (v: VarianteVenta) => v.stock[ubicacionId] ?? 0;
  const maximo = (v: VarianteVenta) => (puedeVenderSinExistencias ? 9999 : Math.max(0, stockEn(v)));

  const categorias = useMemo(() => [...new Set(catalogo.map((v) => v.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "es")), [catalogo]);
  const indice = useMemo(
    () => catalogo.map((v) => ({ v, texto: normalizarTexto(`${v.nombre} ${v.categoria ?? ""} ${v.talla ?? ""} ${v.codigoBarras ?? ""} ${v.sku ?? ""}`) })),
    [catalogo]
  );
  const buscando = busqueda.trim() !== "" || categoria !== "todas";
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
    const actual = carritoActual()[claveDe(v)]?.cantidad ?? 0;
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
    // Las existencias son de cada ubicación: se ajusta lo que ya estaba en todas las ventas abiertas.
    let ajustado = false;
    setVentas(
      ventasActual.current.map((v) => {
        const carritoAjustado: Record<string, LineaCarrito> = {};
        for (const [clave, linea] of Object.entries(v.carrito)) {
          const tope = puedeVenderSinExistencias ? 9999 : Math.max(0, linea.variante.stock[id] ?? 0);
          if (tope < 1) {
            ajustado = true;
            continue;
          }
          if (linea.cantidad > tope) ajustado = true;
          carritoAjustado[clave] = { ...linea, cantidad: Math.min(linea.cantidad, tope) };
        }
        return { ...v, carrito: carritoAjustado };
      })
    );
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

  function nuevaPestana() {
    if (ventasActual.current.length >= MAX_VENTAS) {
      toast.info(`Máximo ${MAX_VENTAS} ventas abiertas a la vez.`);
      return;
    }
    contadorVentas.current += 1;
    const id = `v${contadorVentas.current}`;
    setVentas([...ventasActual.current, ventaVacia(id, `Venta ${contadorVentas.current}`)]);
    setActivaId(id);
    setTimeout(() => inputBusqueda.current?.focus(), 50);
  }

  function cerrarPestana(id: string) {
    const lista = ventasActual.current;
    const objetivo = lista.find((v) => v.id === id);
    if (!objetivo) return;
    if (Object.keys(objetivo.carrito).length > 0 && !window.confirm(`¿Descartar "${objetivo.nombre}"? Se perderán los productos capturados.`)) return;
    if (lista.length === 1) {
      setVentas([ventaVacia(objetivo.id, objetivo.nombre)]);
      return;
    }
    const posicion = lista.findIndex((v) => v.id === id);
    const restantes = lista.filter((v) => v.id !== id);
    setVentas(restantes);
    if (activaActual.current === id) setActivaId(restantes[Math.max(0, posicion - 1)].id);
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
    editarActiva((v) => ventaVacia(v.id, v.nombre));
    setVenta(null);
    setCobroAbierto(false);
    setTimeout(() => inputBusqueda.current?.focus(), 50);
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-57px)] flex-col lg:h-[calc(100vh-57px)] lg:flex-row">
      {/* Izquierda: buscar productos y atajos */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Buscar productos</h1>
          <Select
            items={ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))}
            value={ubicacionId}
            onValueChange={(v) => v && cambiarUbicacion(v)}
          >
            <SelectTrigger className="h-10 w-52 bg-background" aria-label="Ubicación de la venta">
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
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
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
              placeholder="Buscar productos"
              aria-label="Buscar productos o escanear código de barras"
              className="h-14 rounded-xl bg-background pl-12 pr-12 text-base"
            />
            <ScanBarcode className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Select
            items={[{ value: "todas", label: "Todas las categorías" }, ...categorias.map((c) => ({ value: c, label: c }))]}
            value={categoria}
            onValueChange={(v) => setCategoria(v ?? "todas")}
          >
            <SelectTrigger className="h-14 w-52 rounded-xl bg-background" aria-label="Categoría">
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

        {buscando ? (
          <div className="space-y-2">
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
                    "flex w-full items-center gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
                    agotado && "opacity-70"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium">{v.nombre}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {v.talla && <Badge variant="secondary">{v.talla}</Badge>}
                      {v.categoria}
                      {v.sku && <span className="font-mono">{v.sku}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-base font-semibold">{sinPrecio ? "Sin precio" : formatearMoneda(v.precio!)}</span>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
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
            {!resultados.length && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-12 text-center text-sm text-muted-foreground">
                <ScanBarcode className="size-8" />
                No se encontró ningún producto con esa búsqueda.
              </div>
            )}
            {resultados.length > MAX_RESULTADOS && (
              <p className="text-center text-xs text-muted-foreground">
                Mostrando {MAX_RESULTADOS} de {resultados.length.toLocaleString("es-MX")}. Escribe más para afinar la búsqueda.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border shadow-sm sm:grid-cols-2">
            {puedeCrearProductos && <Atajo icono={PackagePlus} titulo="Crear producto" color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" href="/inventario" />}
            <Atajo
              icono={UserPlus}
              titulo={cliente ? "Cambiar cliente" : "Añadir cliente"}
              detalle={cliente?.nombre_comercial}
              color="bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
              onClick={() => setClienteAbierto(true)}
            />
            {puedeDescuentos && (
              <Atajo
                icono={Percent}
                titulo="Añadir descuento"
                detalle={descuentoCentavos > 0 && !descuentoInvalido ? `-${formatearMoneda(aPesos(descuentoCentavos))}` : undefined}
                color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                onClick={() => setDescuentoAbierto(true)}
              />
            )}
            {puedeVerCaja && (
              <Atajo icono={Landmark} titulo="Caja y ventas del día" color="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300" href={`/caja?ubicacion=${ubicacionId}`} />
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
          <span className="flex items-center gap-2 font-medium">
            <Landmark className="size-4 text-muted-foreground" />
            Caja de {ubicacion?.nombre ?? "—"}
          </span>
          {caja ? (
            <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Abierta desde las {formatearHoraMexico(caja.desde)}
              {caja.abiertaPor ? ` · ${caja.abiertaPor}` : ""}
            </Badge>
          ) : (
            <Badge className="border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Cerrada</Badge>
          )}
        </div>
      </section>

      {/* Derecha: venta en curso */}
      <aside className="flex min-h-[32rem] w-full shrink-0 flex-col border-t bg-background lg:min-h-0 lg:w-[26rem] lg:border-l lg:border-t-0 xl:w-[32rem]">
        <div className="flex items-end gap-1 overflow-x-auto border-b bg-muted/40 px-4 pt-3" role="tablist" aria-label="Ventas abiertas">
          {ventas.map((v) => {
            const esActiva = v.id === activa.id;
            const articulos = Object.values(v.carrito).reduce((a, l) => a + l.cantidad, 0);
            return (
              <div
                key={v.id}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-t-lg border border-b-0 px-3 py-2 text-sm",
                  esActiva ? "-mb-px bg-background font-medium" : "bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                <button type="button" role="tab" aria-selected={esActiva} onClick={() => setActivaId(v.id)} className="flex items-center gap-2">
                  {v.nombre}
                  {articulos > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">{articulos}</span>}
                </button>
                {(ventas.length > 1 || articulos > 0) && (
                  <button type="button" aria-label={`Cerrar ${v.nombre}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => cerrarPestana(v.id)}>
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" aria-label="Nueva venta" title="Abrir otra venta" className="mb-1 ml-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted" onClick={nuevaPestana}>
            <Plus className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {lineas.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-2xl font-semibold text-muted-foreground">Tu carrito está vacío</p>
              <p className="text-muted-foreground">Agrega productos a tu venta</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button type="button" variant="outline" className="h-11 gap-2 px-4" onClick={() => inputBusqueda.current?.focus()}>
                  <Search className="size-4" />
                  Buscar productos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 px-4"
                  onClick={() => {
                    inputBusqueda.current?.focus();
                    toast.info("Listo para escanear: apunta el lector al código de barras.");
                  }}
                >
                  <ScanBarcode className="size-4 text-violet-600" />
                  ¡Escanea tus productos!
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {lineas.map(([clave, l]) => (
                <div key={clave} className="space-y-2 px-5 py-4">
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
            </div>
          )}
        </div>

        <div className="space-y-3 border-t px-5 py-4">
          {(cliente || lineas.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted" onClick={() => setClienteAbierto(true)}>
                <UserPlus className="size-3.5" />
                {cliente ? cliente.nombre_comercial : "Público en general"}
              </button>
              {puedeDescuentos && lineas.length > 0 && (
                <button type="button" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted" onClick={() => setDescuentoAbierto(true)}>
                  <Percent className="size-3.5" />
                  {descuentoCentavos > 0 && !descuentoInvalido ? "Editar descuento" : "Descuento"}
                </button>
              )}
              {lineas.length > 0 && (
                <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-destructive" onClick={() => setCarrito(() => ({}))}>
                  Vaciar
                </button>
              )}
            </div>
          )}
          {lineas.length > 0 && (
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
              {descuentoInvalido && descuentoTexto && <p className="text-xs text-destructive">El descuento no puede ser igual o mayor al subtotal.</p>}
            </div>
          )}
          <Button type="button" className="h-14 w-full rounded-xl text-lg font-semibold" disabled={!puedeCobrar} onClick={() => setCobroAbierto(true)}>
            Cobrar {formatearMoneda(aPesos(lineas.length ? totalCentavos : 0))}
          </Button>
        </div>
      </aside>

      <Dialog open={clienteAbierto} onOpenChange={setClienteAbierto}>
        <DialogContent className="sm:max-w-md">
          {clienteAbierto && (
            <SelectorCliente
              clientes={clientes}
              clienteId={clienteId}
              alElegir={(id) => {
                editarActiva((v) => ({ ...v, clienteId: id }));
                setClienteAbierto(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={descuentoAbierto} onOpenChange={setDescuentoAbierto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Descuento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex rounded-lg border p-0.5">
                <Button type="button" size="sm" variant={descuentoTipo === "monto" ? "default" : "ghost"} onClick={() => editarActiva((v) => ({ ...v, descuentoTipo: "monto" }))}>
                  $
                </Button>
                <Button type="button" size="sm" variant={descuentoTipo === "porcentaje" ? "default" : "ghost"} onClick={() => editarActiva((v) => ({ ...v, descuentoTipo: "porcentaje" }))}>
                  %
                </Button>
              </div>
              <Input
                autoFocus
                inputMode="decimal"
                aria-label="Valor del descuento"
                placeholder={descuentoTipo === "monto" ? "0.00" : "0"}
                className={cn("h-9", descuentoInvalido && descuentoTexto && "border-destructive")}
                value={descuentoTexto}
                onChange={(e) => editarActiva((v) => ({ ...v, descuentoTexto: e.target.value }))}
              />
            </div>
            {descuentoInvalido && descuentoTexto && <p className="text-xs text-destructive">El descuento no puede ser igual o mayor al subtotal.</p>}
            {!lineas.length && <p className="text-xs text-muted-foreground">Se aplica sobre el subtotal de los productos que agregues.</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => editarActiva((v) => ({ ...v, descuentoTexto: "" }))} disabled={!descuentoTexto}>
                Quitar
              </Button>
              <Button type="button" className="flex-1" onClick={() => setDescuentoAbierto(false)} disabled={descuentoInvalido && !!descuentoTexto}>
                Listo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

function SelectorCliente({
  clientes,
  clienteId,
  alElegir,
}: {
  clientes: { id: string; nombre_comercial: string }[];
  clienteId: string;
  alElegir: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const q = normalizarTexto(texto.trim());
  const filtrados = clientes.filter((c) => !q || normalizarTexto(c.nombre_comercial).includes(q));
  return (
    <div className="space-y-3">
      <DialogHeader>
        <DialogTitle>Cliente de la venta</DialogTitle>
      </DialogHeader>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente" className="h-10 pl-9" />
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => alElegir("")}
          className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted", !clienteId && "border-primary bg-primary/5")}
        >
          Público en general
          {!clienteId && <Check className="size-4 text-primary" />}
        </button>
        {filtrados.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => alElegir(c.id)}
            className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted", c.id === clienteId && "border-primary bg-primary/5")}
          >
            {c.nombre_comercial}
            {c.id === clienteId && <Check className="size-4 text-primary" />}
          </button>
        ))}
        {!filtrados.length && <p className="py-6 text-center text-sm text-muted-foreground">Ningún cliente coincide.</p>}
      </div>
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
