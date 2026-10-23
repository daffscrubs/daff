"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Calculator, Check, CornerDownLeft, Landmark, Minus, Percent, Plus, Printer, ScanBarcode, Search, ShoppingBag, Trash2, User, UserPlus, Users, X, type LucideIcon } from "lucide-react";
import { crearCliente } from "@/actions/clientes.actions";
import { registrarVenta } from "@/actions/ventas.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatearMoneda } from "@/lib/dinero";
import { formatearHoraMexico } from "@/lib/fechas";
import { normalizarTexto } from "@/lib/texto";
import { TASAS_IEPS, TASAS_IVA, UNIDADES_VENTA } from "@/lib/validaciones/ventas.schema";
import { cn } from "@/lib/utils";

export interface ClienteVenta {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  telefono: string | null;
  email: string | null;
}

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

const MAX_RESULTADOS = 30;
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

// Datos de una partida de "entrada manual" (no está en el inventario).
interface DatosManual {
  unidad: string;
  costo: number | null;
  iva: number;
  ieps: number;
}
interface LineaCarrito {
  variante: VarianteVenta;
  cantidad: number;
  /** Solo en las partidas de entrada manual; la "variante" es entonces un reflejo del nombre y precio capturados. */
  manual?: DatosManual;
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

// Colores suaves para las "fotos" de producto (ninguno tiene imagen todavía): cada categoría conserva siempre el suyo.
const COLORES_PRODUCTO = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
];
function colorDe(texto: string): string {
  let hash = 0;
  for (const c of texto) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_PRODUCTO[hash % COLORES_PRODUCTO.length];
}
function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  return ((palabras[0]?.[0] ?? "?") + (palabras[1]?.[0] ?? "")).toUpperCase();
}

function Atajo({ icono: Icono, titulo, detalle, color, ...accion }: { icono: LucideIcon; titulo: string; detalle?: string; color: string } & ({ href: string } | { onClick: () => void })) {
  const contenido = (
    <>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", color)}>
        <Icono className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight">{titulo}</span>
        {detalle && <span className="mt-1 block truncate text-sm text-muted-foreground">{detalle}</span>}
      </span>
    </>
  );
  const clases =
    "group flex items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
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

interface GrupoProducto {
  modeloId: string;
  nombre: string;
  categoria: string | null;
  variantes: VarianteVenta[];
}

// Un producto con todas sus tallas: se agrega tocando la talla (como se vende en el mostrador).
function TarjetaProducto({
  grupo,
  stockEn,
  enCarrito,
  puedeSinExistencias,
  caja,
  alAgregar,
}: {
  grupo: GrupoProducto;
  stockEn: (v: VarianteVenta) => number;
  enCarrito: (v: VarianteVenta) => number;
  puedeSinExistencias: boolean;
  caja: boolean;
  alAgregar: (v: VarianteVenta) => void;
}) {
  const precios = grupo.variantes.map((v) => v.precio ?? 0).filter((p) => p > 0);
  const minimo = Math.min(...precios);
  const variaPrecio = precios.length > 0 && Math.max(...precios) !== minimo;
  const total = grupo.variantes.reduce((acc, v) => acc + Math.max(0, stockEn(v)), 0);
  return (
    <div className="flex gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-xl text-lg font-semibold", colorDe(grupo.categoria ?? grupo.nombre))}>{inicialesDe(grupo.nombre)}</span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 font-semibold leading-snug">{grupo.nombre}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {grupo.categoria ?? "Sin categoría"} · {total > 0 ? `${total} en existencia` : "Sin existencias"}
            </p>
          </div>
          <p className="shrink-0 text-right text-base font-semibold tabular-nums">{precios.length ? `${variaPrecio ? "Desde " : ""}${formatearMoneda(minimo)}` : <span className="text-sm font-normal text-muted-foreground">Sin precio</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {grupo.variantes.map((v) => {
            const existencias = stockEn(v);
            const agotado = !puedeSinExistencias && existencias <= 0;
            const sinPrecio = !v.precio || v.precio <= 0;
            const cantidad = enCarrito(v);
            return (
              <button
                key={claveDe(v)}
                type="button"
                disabled={!caja || sinPrecio || agotado}
                onClick={() => alAgregar(v)}
                title={`${v.talla ?? grupo.nombre}${v.precio ? ` · ${formatearMoneda(v.precio)}` : ""} · ${existencias > 0 ? `${existencias} disponibles` : "sin existencias"}`}
                className={cn(
                  "relative flex min-w-16 flex-col items-center rounded-xl border px-3 py-1.5 text-sm leading-tight transition-colors",
                  agotado || sinPrecio ? "cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground/70" : "hover:border-primary hover:bg-primary/5",
                  !caja && "cursor-not-allowed opacity-60",
                  cantidad > 0 && "border-primary bg-primary/10"
                )}
              >
                <span className={cn("font-semibold", agotado && "line-through")}>{v.talla ?? "Agregar"}</span>
                {variaPrecio && v.precio ? <span className="text-[11px] text-muted-foreground">{formatearMoneda(v.precio)}</span> : null}
                <span className={cn("text-[11px]", existencias > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>{existencias > 0 ? `${existencias} disp.` : "Agotado"}</span>
                {cantidad > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{cantidad}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
  puedeEntradaManual,
  puedeCrearClientes,
}: {
  ubicaciones: { id: string; nombre: string }[];
  cajasAbiertas: CajaAbierta[];
  catalogo: VarianteVenta[];
  clientes: ClienteVenta[];
  puedeDescuentos: boolean;
  puedeVenderSinExistencias: boolean;
  puedeAbrirCaja: boolean;
  puedeVerCaja: boolean;
  puedeEntradaManual: boolean;
  puedeCrearClientes: boolean;
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
  const [manualAbierto, setManualAbierto] = useState(false);
  const [resaltada, setResaltada] = useState<string | null>(null);
  const temporizadorResalte = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clientesNuevos, setClientesNuevos] = useState<ClienteVenta[]>([]);
  const contadorManual = useRef(0);
  const [descuentoAbierto, setDescuentoAbierto] = useState(false);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [venta, setVenta] = useState<{ id: string; folio: string; totalCentavos: number; cambioCentavos: number } | null>(null);

  const ubicacion = ubicaciones.find((u) => u.id === ubicacionId);
  const caja = cajasAbiertas.find((c) => c.ubicacionId === ubicacionId) ?? null;
  // Los clientes creados desde esta ventana se suman a la lista sin recargar la página.
  const todosClientes = useMemo(() => {
    const ids = new Set(clientes.map((c) => c.id));
    return [...clientes, ...clientesNuevos.filter((c) => !ids.has(c.id))].sort((a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial, "es"));
  }, [clientes, clientesNuevos]);
  const cliente = todosClientes.find((c) => c.id === clienteId) ?? null;
  const stockEn = (v: VarianteVenta) => v.stock[ubicacionId] ?? 0;
  const maximo = (v: VarianteVenta) => (puedeVenderSinExistencias ? 9999 : Math.max(0, stockEn(v)));

  const categorias = useMemo(() => [...new Set(catalogo.map((v) => v.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "es")), [catalogo]);
  const indice = useMemo(
    () => catalogo.map((v) => ({ v, texto: normalizarTexto(`${v.nombre} ${v.categoria ?? ""} ${v.talla ?? ""} ${v.codigoBarras ?? ""} ${v.sku ?? ""}`) })),
    [catalogo]
  );
  const buscando = busqueda.trim() !== "" || categoria !== "todas";
  const cantidadEnCarrito = (v: VarianteVenta) => carrito[claveDe(v)]?.cantidad ?? 0;
  const resultados = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    return indice.filter((x) => (categoria === "todas" || x.v.categoria === categoria) && (!q || x.texto.includes(q))).map((x) => x.v);
  }, [indice, busqueda, categoria]);

  // Un destello breve en la línea que acaba de cambiar, para ver que el producto sí entró.
  function resaltar(clave: string) {
    setResaltada(clave);
    if (temporizadorResalte.current) clearTimeout(temporizadorResalte.current);
    temporizadorResalte.current = setTimeout(() => setResaltada(null), 700);
  }

  // Los resultados se agrupan por producto: una tarjeta con todas sus tallas.
  const grupos = useMemo(() => {
    const porModelo = new Map<string, GrupoProducto>();
    for (const v of resultados) {
      const g = porModelo.get(v.modeloId) ?? { modeloId: v.modeloId, nombre: v.nombre, categoria: v.categoria, variantes: [] };
      g.variantes.push(v);
      porModelo.set(v.modeloId, g);
    }
    return [...porModelo.values()];
  }, [resultados]);

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
    resaltar(claveDe(v));
  }

  function cambiarCantidad(clave: string, cantidad: number) {
    setCarrito((prev) => {
      const linea = prev[clave];
      if (!linea) return prev;
      const siguiente = { ...prev };
      if (linea.manual) {
        // Partida de entrada manual: sin existencias que respetar y con hasta 3 decimales (metros, kilos...).
        if (!Number.isFinite(cantidad) || cantidad <= 0) delete siguiente[clave];
        else siguiente[clave] = { ...linea, cantidad: Math.min(999_999, Math.round(cantidad * 1000) / 1000) };
        return siguiente;
      }
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

  function agregarManual(d: { nombre: string; cantidad: number; unidad: string; precio: number; costo: number | null; iva: number; ieps: number }) {
    if (!caja) {
      toast.error(`No hay una caja abierta en ${ubicacion?.nombre ?? "esta ubicación"}.`);
      return false;
    }
    contadorManual.current += 1;
    const clave = `manual-${contadorManual.current}`;
    const variante: VarianteVenta = {
      modeloId: "",
      tallaId: "",
      nombre: d.nombre,
      categoria: null,
      talla: null,
      ordenTalla: 0,
      precio: d.precio,
      codigoBarras: null,
      sku: null,
      stock: {},
    };
    setCarrito((prev) => ({ ...prev, [clave]: { variante, cantidad: d.cantidad, manual: { unidad: d.unidad, costo: d.costo, iva: d.iva, ieps: d.ieps } } }));
    return true;
  }

  function cambiarUbicacion(id: string) {
    guardarUbicacion(id);
    // Las existencias son de cada ubicación: se ajusta lo que ya estaba en todas las ventas abiertas.
    let ajustado = false;
    setVentas(
      ventasActual.current.map((v) => {
        const carritoAjustado: Record<string, LineaCarrito> = {};
        for (const [clave, linea] of Object.entries(v.carrito)) {
          if (linea.manual) {
            carritoAjustado[clave] = linea;
            continue;
          }
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
  const piezas = Number(lineas.reduce((acc, [, l]) => acc + l.cantidad, 0).toFixed(3));
  const subtotalCentavos = lineas.reduce((acc, [, l]) => acc + Math.round(l.cantidad * aCentavos(l.variante.precio ?? 0)), 0);
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Buscar productos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Escribe el nombre o el SKU, o escanea el código de barras.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))}
              value={ubicacionId}
              onValueChange={(v) => v && cambiarUbicacion(v)}
            >
              <SelectTrigger className="h-10 w-48 rounded-full bg-background" aria-label="Ubicación de la venta">
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
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300" title={caja.abiertaPor ? `Abierta por ${caja.abiertaPor}` : undefined}>
                <span className="size-2 rounded-full bg-emerald-500" />
                Caja abierta · {formatearHoraMexico(caja.desde)}
              </span>
            ) : (
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <span className="size-2 rounded-full bg-red-500" />
                Caja cerrada
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
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
            className="h-14 rounded-2xl bg-background pl-13 pr-24 text-base shadow-sm"
          />
          <span className="pointer-events-none absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-2 text-muted-foreground">
            {busqueda.trim() !== "" && <kbd className="flex h-6 items-center gap-1 rounded border bg-muted px-1.5 text-xs">Enter</kbd>}
            <ScanBarcode className="size-6" />
          </span>
        </div>

        <div className="-mt-1 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categorías">
          {["todas", ...categorias].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
                categoria === c ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              )}
            >
              {c === "todas" ? "Todas" : c}
            </button>
          ))}
        </div>

        {!caja && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {grupos.length.toLocaleString("es-MX")} producto{grupos.length === 1 ? "" : "s"}
              {resultados.length !== grupos.length && ` · ${resultados.length.toLocaleString("es-MX")} tallas`}
            </p>
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {grupos.slice(0, MAX_RESULTADOS).map((g) => (
                <TarjetaProducto
                  key={g.modeloId}
                  grupo={g}
                  stockEn={stockEn}
                  enCarrito={cantidadEnCarrito}
                  puedeSinExistencias={puedeVenderSinExistencias}
                  caja={!!caja}
                  alAgregar={agregar}
                />
              ))}
            </div>
            {!grupos.length && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card py-14 text-center text-sm text-muted-foreground">
                <ScanBarcode className="size-8" />
                No se encontró ningún producto con esa búsqueda.
              </div>
            )}
            {grupos.length > MAX_RESULTADOS && (
              <p className="text-center text-xs text-muted-foreground">
                Mostrando {MAX_RESULTADOS} de {grupos.length.toLocaleString("es-MX")}. Escribe más para afinar la búsqueda.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {puedeEntradaManual && (
              <Atajo
                icono={Calculator}
                titulo="Entrada manual"
                detalle="Cobra algo que no está en el inventario"
                color="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300"
                onClick={() => setManualAbierto(true)}
              />
            )}
            <Atajo
              icono={UserPlus}
              titulo={cliente ? "Cambiar cliente" : "Añadir cliente"}
              detalle={cliente?.nombre_comercial ?? "Asigna la venta a un cliente"}
              color="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
              onClick={() => setClienteAbierto(true)}
            />
            {puedeDescuentos && (
              <Atajo
                icono={Percent}
                titulo="Añadir descuento"
                detalle={descuentoCentavos > 0 && !descuentoInvalido ? `Descuento de ${formatearMoneda(aPesos(descuentoCentavos))}` : "En pesos o en porcentaje"}
                color="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                onClick={() => setDescuentoAbierto(true)}
              />
            )}
            {puedeVerCaja && (
              <Atajo
                icono={Landmark}
                titulo="Caja y ventas del día"
                detalle="Ingresos, retiros y corte de caja"
                color="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
                href={`/caja?ubicacion=${ubicacionId}`}
              />
            )}
          </div>
        )}
      </section>

      {/* Derecha: venta en curso */}
      <aside className="flex min-h-[32rem] w-full shrink-0 flex-col border-t bg-background shadow-[-8px_0_24px_-16px_rgba(0,0,0,0.15)] lg:min-h-0 lg:w-[26rem] lg:border-l lg:border-t-0 xl:w-[32rem]">
        <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-3" role="tablist" aria-label="Ventas abiertas">
          {ventas.map((v) => {
            const esActiva = v.id === activa.id;
            const articulos = Object.keys(v.carrito).length;
            return (
              <div
                key={v.id}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border py-1 pl-3.5 pr-1.5 text-sm transition-colors",
                  esActiva ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                <button type="button" role="tab" aria-selected={esActiva} onClick={() => setActivaId(v.id)} className="flex items-center gap-2 font-medium">
                  {v.nombre}
                  {articulos > 0 && (
                    <span className={cn("rounded-full px-1.5 text-xs font-semibold", esActiva ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground")}>{articulos}</span>
                  )}
                </button>
                {(ventas.length > 1 || articulos > 0) ? (
                  <button
                    type="button"
                    aria-label={`Cerrar ${v.nombre}`}
                    className={cn("rounded-full p-1 transition-colors", esActiva ? "hover:bg-primary-foreground/20" : "text-muted-foreground hover:bg-background hover:text-destructive")}
                    onClick={() => cerrarPestana(v.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <span className="w-2" />
                )}
              </div>
            );
          })}
          <button
            type="button"
            aria-label="Nueva venta"
            title="Abrir otra venta"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-foreground"
            onClick={nuevaPestana}
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {lineas.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <span className="mb-2 flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ShoppingBag className="size-9" />
              </span>
              <p className="text-2xl font-semibold">Tu carrito está vacío</p>
              <p className="text-muted-foreground">Agrega productos a tu venta</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button type="button" variant="outline" className="h-11 gap-2 rounded-xl px-4" onClick={() => inputBusqueda.current?.focus()}>
                  <Search className="size-4" />
                  Buscar productos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 rounded-xl px-4"
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
                <div key={clave} className={cn("px-5 py-4 transition-colors duration-500", resaltada === clave && "bg-primary/10")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold", colorDe(l.variante.categoria ?? l.variante.nombre))}>{inicialesDe(l.variante.nombre)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug">{l.variante.nombre}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {l.variante.talla && <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{l.variante.talla}</span>}
                            {l.manual && <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{l.manual.unidad}</span>}
                            {formatearMoneda(l.variante.precio ?? 0)} c/u
                          </p>
                        </div>
                        <button type="button" aria-label="Quitar del carrito" className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => cambiarCantidad(clave, 0)}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border bg-background">
                          <button type="button" aria-label="Menos" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => cambiarCantidad(clave, l.cantidad - 1)}>
                            <Minus className="size-3.5" />
                          </button>
                          <Input
                            type="number"
                            min={l.manual ? 0.001 : 1}
                            step={l.manual ? "any" : 1}
                            aria-label={`Cantidad de ${l.variante.nombre}`}
                            className="h-8 w-12 border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
                            value={l.cantidad}
                            onChange={(e) => cambiarCantidad(clave, Number(e.target.value))}
                          />
                          <button type="button" aria-label="Más" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => cambiarCantidad(clave, l.cantidad + 1)}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-base font-semibold tabular-nums">{formatearMoneda(aPesos(Math.round(l.cantidad * aCentavos(l.variante.precio ?? 0))))}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 border-t bg-muted/20 px-5 py-4">
          {(cliente || lineas.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted" onClick={() => setClienteAbierto(true)}>
                <UserPlus className="size-3.5" />
                {cliente ? cliente.nombre_comercial : "Público en general"}
              </button>
              {puedeDescuentos && lineas.length > 0 && (
                <button type="button" className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted" onClick={() => setDescuentoAbierto(true)}>
                  <Percent className="size-3.5" />
                  {descuentoCentavos > 0 && !descuentoInvalido ? "Editar descuento" : "Descuento"}
                </button>
              )}
              {lineas.length > 0 && (
                <button type="button" className="ml-auto text-xs text-muted-foreground transition-colors hover:text-destructive" onClick={() => setCarrito(() => ({}))}>
                  Vaciar
                </button>
              )}
            </div>
          )}
          {lineas.length > 0 && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>
                  Subtotal · {piezas} pieza{piezas === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums">{formatearMoneda(aPesos(subtotalCentavos))}</span>
              </div>
              {descuentoCentavos > 0 && !descuentoInvalido && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Descuento</span>
                  <span className="tabular-nums">-{formatearMoneda(aPesos(descuentoCentavos))}</span>
                </div>
              )}
              {descuentoInvalido && descuentoTexto && <p className="text-xs text-destructive">El descuento no puede ser igual o mayor al subtotal.</p>}
              <div className="flex items-baseline justify-between border-t pt-2.5">
                <span className="text-base font-semibold">Total</span>
                <span className="text-3xl font-bold tabular-nums tracking-tight">{formatearMoneda(aPesos(totalCentavos))}</span>
              </div>
            </div>
          )}
          <Button type="button" className="h-14 w-full rounded-2xl text-lg font-semibold shadow-sm" disabled={!puedeCobrar} onClick={() => setCobroAbierto(true)}>
            Cobrar {formatearMoneda(aPesos(lineas.length ? totalCentavos : 0))}
          </Button>
        </div>
      </aside>

      <Dialog open={clienteAbierto} onOpenChange={setClienteAbierto}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          {clienteAbierto && (
            <SelectorCliente
              clientes={todosClientes}
              clienteId={clienteId}
              puedeCrear={puedeCrearClientes}
              alElegir={(id) => {
                editarActiva((v) => ({ ...v, clienteId: id }));
                setClienteAbierto(false);
              }}
              alCrear={(nuevo) => setClientesNuevos((prev) => [...prev, nuevo])}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualAbierto} onOpenChange={setManualAbierto}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {manualAbierto && (
            <EntradaManual
              alAgregar={(datos) => {
                if (agregarManual(datos)) setManualAbierto(false);
              }}
              alCancelar={() => setManualAbierto(false)}
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
                  items: lineas.map(([, l]) =>
                    l.manual
                      ? { manual: true as const, nombre: l.variante.nombre, cantidad: l.cantidad, unidad: l.manual.unidad as (typeof UNIDADES_VENTA)[number], precio: l.variante.precio ?? 0, costo: l.manual.costo, iva: l.manual.iva, ieps: l.manual.ieps }
                      : { modeloId: l.variante.modeloId, tallaId: l.variante.tallaId, cantidad: l.cantidad }
                  ),
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

// Selector de cliente: búsqueda, "Nuevo cliente", "Público en General" y la lista, con navegación por teclado
// (flechas para moverse, Enter para confirmar) como en el resto de las cajas de punto de venta.
function SelectorCliente({
  clientes,
  clienteId,
  puedeCrear,
  alElegir,
  alCrear,
}: {
  clientes: ClienteVenta[];
  clienteId: string;
  puedeCrear: boolean;
  alElegir: (id: string) => void;
  alCrear: (cliente: ClienteVenta) => void;
}) {
  const [vista, setVista] = useState<"lista" | "nuevo">("lista");
  const [texto, setTexto] = useState("");
  const [resaltado, setResaltado] = useState(0);
  const lista = useRef<HTMLDivElement>(null);

  const q = normalizarTexto(texto.trim());
  const filtrados = useMemo(
    () =>
      clientes
        .filter((c) => !q || normalizarTexto(`${c.nombre_comercial} ${c.razon_social ?? ""} ${c.telefono ?? ""} ${c.email ?? ""}`).includes(q))
        .slice(0, 100),
    [clientes, q]
  );
  // "Público en General" va siempre primero (si la búsqueda está vacía o lo menciona).
  const mostrarPublico = !q || normalizarTexto("Público en General").includes(q);
  const opciones: { id: string; titulo: string; detalle: string | null }[] = [
    ...(mostrarPublico ? [{ id: "", titulo: "Público en General", detalle: null }] : []),
    ...filtrados.map((c) => ({ id: c.id, titulo: c.nombre_comercial, detalle: c.telefono || c.email || c.razon_social })),
  ];
  const posicion = Math.min(resaltado, Math.max(0, opciones.length - 1));

  function moverA(nueva: number) {
    const destino = Math.max(0, Math.min(opciones.length - 1, nueva));
    setResaltado(destino);
    lista.current?.querySelector<HTMLElement>(`[data-indice="${destino}"]`)?.scrollIntoView({ block: "nearest" });
  }

  if (vista === "nuevo") {
    return <NuevoCliente alVolver={() => setVista("lista")} alGuardar={(c) => { alCrear(c); alElegir(c.id); }} />;
  }

  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="border-b px-6 py-5">
        <DialogTitle className="text-xl font-semibold">Añadir Cliente</DialogTitle>
      </div>
      <div className="space-y-3 px-6 pt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setResaltado(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                moverA(posicion + 1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                moverA(posicion - 1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (opciones[posicion]) alElegir(opciones[posicion].id);
              }
            }}
            placeholder="Buscar por nombre, teléfono, email o razón social"
            aria-label="Buscar cliente"
            className="h-12 rounded-lg pl-11 text-base"
          />
        </div>
        {puedeCrear && (
          <button type="button" onClick={() => setVista("nuevo")} className="flex w-full items-center gap-3 border-b px-2 py-3 text-left text-base font-medium text-sky-600 hover:text-sky-700">
            <Plus className="size-5" />
            Nuevo cliente
          </button>
        )}
      </div>
      <div ref={lista} className="min-h-40 flex-1 overflow-y-auto px-4 py-3" role="listbox" aria-label="Clientes">
        {opciones.map((o, i) => (
          <button
            key={o.id || "publico"}
            type="button"
            role="option"
            aria-selected={o.id === clienteId}
            data-indice={i}
            onMouseMove={() => setResaltado(i)}
            onClick={() => alElegir(o.id)}
            className={cn("flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left transition-colors", i === posicion ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-muted/50")}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
              {o.id ? <User className="size-5" /> : <Users className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium">{o.titulo}</span>
              {o.detalle && <span className="block truncate text-sm text-muted-foreground">{o.detalle}</span>}
            </span>
            {o.id === clienteId && <Check className="size-5 shrink-0 text-sky-600" />}
          </button>
        ))}
        {!opciones.length && <p className="py-10 text-center text-sm text-muted-foreground">Ningún cliente coincide con la búsqueda.</p>}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <kbd className="flex size-6 items-center justify-center rounded border bg-background">
            <ArrowUp className="size-3.5" />
          </kbd>
          <kbd className="flex size-6 items-center justify-center rounded border bg-background">
            <ArrowDown className="size-3.5" />
          </kbd>
          Navegar
        </span>
        <span className="flex items-center gap-2">
          <kbd className="flex h-6 items-center justify-center rounded border bg-background px-2">
            <CornerDownLeft className="size-3.5" />
          </kbd>
          Confirmar
        </span>
      </div>
    </div>
  );
}

function NuevoCliente({ alVolver, alGuardar }: { alVolver: () => void; alGuardar: (cliente: ClienteVenta) => void }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [guardando, startTransition] = useTransition();
  const valido = nombre.trim().length >= 2;

  function guardar() {
    startTransition(async () => {
      const res = await crearCliente({ nombreComercial: nombre.trim(), telefono: telefono.trim(), email: email.trim(), razonSocial: razonSocial.trim() });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cliente "${nombre.trim()}" creado`);
      alGuardar({ id: res.data, nombre_comercial: nombre.trim(), telefono: telefono.trim() || null, email: email.trim() || null, razon_social: razonSocial.trim() || null });
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido && !guardando) guardar();
      }}
    >
      <div className="border-b px-6 py-5">
        <DialogTitle className="text-xl font-semibold">Nuevo cliente</DialogTitle>
      </div>
      <div className="space-y-4 px-6 py-5">
        <div className="space-y-1.5">
          <Label htmlFor="nc-nombre">Nombre</Label>
          <Input id="nc-nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente o negocio" className="h-11" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nc-tel">Teléfono (opcional)</Label>
            <Input id="nc-tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-mail">Email (opcional)</Label>
            <Input id="nc-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nc-razon">Razón social (opcional)</Label>
          <Input id="nc-razon" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="h-11" />
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t bg-muted/40 px-6 py-4">
        <Button type="button" variant="outline" className="h-10 px-5" onClick={alVolver} disabled={guardando}>
          Volver
        </Button>
        <Button type="submit" className="h-10 px-5" disabled={!valido || guardando}>
          {guardando ? "Guardando..." : "Guardar y seleccionar"}
        </Button>
      </div>
    </form>
  );
}

// Entrada manual: agrega al carrito algo que no está en el inventario (servicios, productos sueltos, cobros varios).
// No mueve existencias. El precio capturado es el precio final: el IVA/IEPS se guardan para el desglose y no se
// suman otra vez al total.
function EntradaManual({
  alAgregar,
  alCancelar,
}: {
  alAgregar: (datos: { nombre: string; cantidad: number; unidad: string; precio: number; costo: number | null; iva: number; ieps: number }) => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [unidad, setUnidad] = useState<string>("Unidad");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [conImpuestos, setConImpuestos] = useState(true);
  const [iva, setIva] = useState("16");
  const [ieps, setIeps] = useState("0");

  const cantidadNum = Number(cantidad.replace(/,/g, ""));
  const precioCentavos = leerCentavos(precio);
  const costoCentavos = costo.trim() ? leerCentavos(costo) : 0;
  const cantidadValida = Number.isFinite(cantidadNum) && cantidadNum > 0 && cantidadNum <= 999_999 && Math.abs(Math.round(cantidadNum * 1000) - cantidadNum * 1000) < 1e-6;
  const valido = nombre.trim().length > 0 && cantidadValida && !Number.isNaN(precioCentavos) && precioCentavos > 0 && !Number.isNaN(costoCentavos);

  function agregar() {
    if (!valido) return;
    alAgregar({
      nombre: nombre.trim(),
      cantidad: Math.round(cantidadNum * 1000) / 1000,
      unidad,
      precio: aPesos(precioCentavos),
      costo: costo.trim() ? aPesos(costoCentavos) : null,
      iva: conImpuestos ? Number(iva) : 0,
      ieps: conImpuestos ? Number(ieps) : 0,
    });
  }

  const tarjeta = "space-y-5 rounded-xl border bg-card p-5 shadow-sm";
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        agregar();
      }}
    >
      <div className="shrink-0 border-b px-7 py-6 pr-14">
        <DialogTitle className="text-2xl font-semibold">Entrada Manual de Producto</DialogTitle>
        <p className="mt-1.5 text-muted-foreground">Añade un producto al carrito sin agregarlo a tu inventario</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/40 px-7 py-6">
        <div className={tarjeta}>
          <div className="space-y-1.5">
            <Label htmlFor="em-nombre" className="text-base font-medium">
              Nombre del producto
            </Label>
            <Input id="em-nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Bordado de nombre" className="h-11 text-base" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="em-cantidad" className="text-base font-medium">
                Cantidad
              </Label>
              <Input
                id="em-cantidad"
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                className={cn("h-11 text-base", cantidad && !cantidadValida && "border-destructive")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base font-medium">Unidad de Venta</Label>
              <Select items={UNIDADES_VENTA.map((u) => ({ value: u, label: u }))} value={unidad} onValueChange={(v) => v && setUnidad(v)}>
                <SelectTrigger className="h-11 w-full text-base" aria-label="Unidad de venta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_VENTA.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-precio" className="text-base font-medium">
                Precio de Venta
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="em-precio"
                  inputMode="decimal"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="0.00"
                  className={cn("h-11 pl-8 pr-24 text-base", precio && (Number.isNaN(precioCentavos) || precioCentavos <= 0) && "border-destructive")}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">por {unidad}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-costo" className="text-base font-medium">
                Costo (opcional)
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="em-costo"
                  inputMode="decimal"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  placeholder="0.00"
                  className={cn("h-11 pl-8 pr-24 text-base", Number.isNaN(costoCentavos) && "border-destructive")}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">por {unidad}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={tarjeta}>
          <label className="flex cursor-pointer items-center gap-3 text-base font-medium">
            <input type="checkbox" className="size-5 cursor-pointer accent-sky-600" checked={conImpuestos} onChange={(e) => setConImpuestos(e.target.checked)} />
            Cobrar impuestos del producto
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-base font-medium">IVA</Label>
              <Select items={TASAS_IVA.map((t) => ({ value: String(t), label: `${t}%` }))} value={iva} onValueChange={(v) => v && setIva(v)} disabled={!conImpuestos}>
                <SelectTrigger className="h-11 w-full text-base" aria-label="IVA">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASAS_IVA.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-base font-medium">IEPS</Label>
              <Select
                items={TASAS_IEPS.map((t) => ({ value: String(t), label: t === 0 ? "No aplica" : `${t}%` }))}
                value={ieps}
                onValueChange={(v) => v && setIeps(v)}
                disabled={!conImpuestos}
              >
                <SelectTrigger className="h-11 w-full text-base" aria-label="IEPS">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASAS_IEPS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t === 0 ? "No aplica" : `${t}%`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">El precio que captures es el precio final: los impuestos se registran con la partida y no se suman otra vez al total.</p>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-3 border-t px-7 py-5">
        <Button type="button" variant="outline" className="h-11 px-6 text-base" onClick={alCancelar}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11 px-6 text-base" disabled={!valido}>
          Crear y Agregar
        </Button>
      </div>
    </form>
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
