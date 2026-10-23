"use client";

import { useMemo, useState } from "react";
import { Barcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_POR_VARIANTE, MAX_TOTAL_ETIQUETAS } from "@/lib/inventario/etiquetas";
import { fechaISOLocal } from "@/lib/fechas";
import { cn } from "@/lib/utils";

type Origen = "seleccionados" | "busqueda" | "todos";

export interface VarianteEtiquetable {
  tallaId: string;
  /** Talla a mostrar; null cuando el producto no maneja tallas. */
  talla: string | null;
  codigoBarras: string | null;
  /** Existencias de esta talla (todas las ubicaciones juntas), para "igualar al stock". */
  stock: number;
}

export interface ProductoEtiquetable {
  id: string;
  nombre: string;
  variantes: VarianteEtiquetable[];
}

const clave = (productoId: string, tallaId: string) => `${productoId}|${tallaId}`;

function aEntero(texto: string | undefined): number {
  const n = Math.floor(Number(texto));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_POR_VARIANTE) : 0;
}

// Paso 1: de qué productos. Paso 2: cuántas etiquetas de cada producto y de cada talla. El PDF se
// pide por POST (con muchos productos son demasiados datos para la dirección de una URL) y se
// descarga directamente; si el servidor responde con un error, se muestra aquí en vez de dejar al
// usuario en una pestaña con texto suelto.
function Contenido({
  productos,
  idsSeleccionados,
  idsBusqueda,
  alCerrar,
}: {
  productos: ProductoEtiquetable[];
  idsSeleccionados: string[];
  idsBusqueda: string[];
  alCerrar: () => void;
}) {
  const [paso, setPaso] = useState<"origen" | "cantidades">("origen");
  const [origen, setOrigen] = useState<Origen>(idsSeleccionados.length ? "seleccionados" : "todos");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [creando, setCreando] = useState(false);

  const idsPorOrigen: Record<Origen, string[]> = useMemo(
    () => ({ seleccionados: idsSeleccionados, busqueda: idsBusqueda, todos: productos.map((p) => p.id) }),
    [idsSeleccionados, idsBusqueda, productos]
  );

  // Solo los productos con al menos una talla con código de barras se pueden etiquetar.
  const elegidos = useMemo(() => {
    const ids = new Set(idsPorOrigen[origen]);
    return productos
      .filter((p) => ids.has(p.id) && p.variantes.some((v) => v.codigoBarras))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [productos, idsPorOrigen, origen]);
  const sinCodigo = idsPorOrigen[origen].length - elegidos.length;

  const opciones: { valor: Origen; titulo: string }[] = [
    { valor: "seleccionados", titulo: "Productos seleccionados" },
    { valor: "busqueda", titulo: "Productos en tu búsqueda actual" },
    { valor: "todos", titulo: "Todos los productos" },
  ];

  function continuar() {
    // Cada talla con código arranca con 1 etiqueta.
    const inicial: Record<string, string> = {};
    for (const p of elegidos) for (const v of p.variantes) if (v.codigoBarras) inicial[clave(p.id, v.tallaId)] = "1";
    setCantidades(inicial);
    setPaso("cantidades");
  }

  const poner = (valor: (v: VarianteEtiquetable) => number) => {
    const siguiente: Record<string, string> = {};
    for (const p of elegidos) for (const v of p.variantes) if (v.codigoBarras) siguiente[clave(p.id, v.tallaId)] = String(valor(v));
    setCantidades(siguiente);
  };

  const total = elegidos.reduce(
    (acc, p) => acc + p.variantes.reduce((a, v) => a + (v.codigoBarras ? aEntero(cantidades[clave(p.id, v.tallaId)]) : 0), 0),
    0
  );
  const demasiadas = total > MAX_TOTAL_ETIQUETAS;

  async function crearYDescargar() {
    if (!total || demasiadas || creando) return;
    setCreando(true);
    try {
      const items = elegidos.flatMap((p) =>
        p.variantes
          .filter((v) => v.codigoBarras && aEntero(cantidades[clave(p.id, v.tallaId)]) > 0)
          .map((v) => ({ modelo_id: p.id, talla_id: v.tallaId, cantidad: aEntero(cantidades[clave(p.id, v.tallaId)]) }))
      );
      const datos = new FormData();
      datos.set("items", JSON.stringify(items));
      const respuesta = await fetch("/api/pdf/etiquetas-productos", { method: "POST", body: datos });
      if (!respuesta.ok) {
        toast.error((await respuesta.text()) || "No se pudo crear el PDF de etiquetas.");
        return;
      }
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `etiquetas-productos-${fechaISOLocal(new Date())}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`${total.toLocaleString("es-MX")} etiqueta${total === 1 ? "" : "s"} descargada${total === 1 ? "" : "s"}`);
      alCerrar();
    } catch {
      toast.error("No se pudo conectar para crear las etiquetas. Intenta de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  if (paso === "origen") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {opciones.map((o) => {
            const cuantos = idsPorOrigen[o.valor].length;
            const deshabilitada = !cuantos;
            return (
              <label
                key={o.valor}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
                  origen === o.valor && "border-primary bg-primary/5",
                  deshabilitada && "cursor-not-allowed opacity-50"
                )}
              >
                <input
                  type="radio"
                  name="origen"
                  className="size-4"
                  checked={origen === o.valor}
                  disabled={deshabilitada}
                  onChange={() => setOrigen(o.valor)}
                />
                <span className="font-medium">{o.titulo}</span>
                <span className="text-muted-foreground">({cuantos})</span>
              </label>
            );
          })}
        </div>
        {sinCodigo > 0 && (
          <p className="text-sm text-muted-foreground">
            {sinCodigo.toLocaleString("es-MX")} producto{sinCodigo === 1 ? "" : "s"} no tiene
            {sinCodigo === 1 ? "" : "n"} ninguna talla con código de barras y se omite{sinCodigo === 1 ? "" : "n"}.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button type="button" disabled={!elegidos.length} onClick={continuar}>
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          Elige cuántas etiquetas quieres de cada producto{elegidos.some((p) => p.variantes.length > 1) ? " y de cada talla" : ""}.
        </p>
        <div className="flex gap-3">
          <button type="button" className="text-primary hover:underline" onClick={() => poner((v) => Math.max(0, Math.floor(v.stock)))}>
            Igualar cantidad al stock
          </button>
          <button type="button" className="text-primary hover:underline" onClick={() => poner(() => 1)}>
            Poner todas en 1
          </button>
        </div>
      </div>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {elegidos.map((p) => (
          <div key={p.id} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{p.nombre}</p>
            <div className="mt-2 space-y-2">
              {p.variantes.map((v) => (
                <div key={v.tallaId} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    {v.talla && <span className="mr-2 font-medium">{v.talla}</span>}
                    <span className="text-xs text-muted-foreground">
                      {v.codigoBarras ? `${v.codigoBarras} · ${v.stock} en stock` : "Sin código de barras, se omite"}
                    </span>
                  </div>
                  {v.codigoBarras && (
                    <Input
                      type="number"
                      min={0}
                      max={MAX_POR_VARIANTE}
                      aria-label={`Etiquetas de ${p.nombre}${v.talla ? ` talla ${v.talla}` : ""}`}
                      className="h-8 w-24 shrink-0 text-right"
                      value={cantidades[clave(p.id, v.tallaId)] ?? ""}
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [clave(p.id, v.tallaId)]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <p>
          Se van a crear <span className="font-semibold">{total.toLocaleString("es-MX")}</span> etiqueta{total === 1 ? "" : "s"} de 62 × 25 mm.
        </p>
        {demasiadas && (
          <p className="mt-1 text-destructive">
            El máximo por PDF es {MAX_TOTAL_ETIQUETAS.toLocaleString("es-MX")} etiquetas. Reduce las cantidades o créalas en partes.
          </p>
        )}
      </div>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => setPaso("origen")} disabled={creando}>
          Volver
        </Button>
        <Button type="button" onClick={crearYDescargar} disabled={!total || demasiadas || creando}>
          {creando ? "Creando PDF..." : `Crear ${total.toLocaleString("es-MX")} etiqueta${total === 1 ? "" : "s"} y descargar`}
        </Button>
      </div>
    </div>
  );
}

export function CrearEtiquetasDialog({
  abierto,
  onOpenChange,
  productos,
  idsSeleccionados,
  idsBusqueda,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  productos: ProductoEtiquetable[];
  idsSeleccionados: string[];
  idsBusqueda: string[];
}) {
  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="size-5" />
            Crear etiquetas
          </DialogTitle>
        </DialogHeader>
        {/* Se monta al abrir para que la opción inicial (seleccionados o todos) se calcule en ese momento. */}
        {abierto && (
          <Contenido
            productos={productos}
            idsSeleccionados={idsSeleccionados}
            idsBusqueda={idsBusqueda}
            alCerrar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
