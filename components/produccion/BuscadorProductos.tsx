"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatearMoneda } from "@/lib/dinero";
import { cn } from "@/lib/utils";

export interface ProductoBuscable {
  id: string;
  nombre: string;
  categoria: string | null;
  precioVenta: number | null;
  imagenUrl: string | null;
  existencias: number;
}

// Sin acentos y en minúsculas, para que "filipina" encuentre "Filipína".
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function BuscadorProductos({
  productos,
  onSeleccionar,
}: {
  productos: ProductoBuscable[];
  onSeleccionar: (productoId: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cierra la lista al hacer clic fuera del buscador.
  useEffect(() => {
    function alHacerClic(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alHacerClic);
    return () => document.removeEventListener("mousedown", alHacerClic);
  }, []);

  const resultados = useMemo(() => {
    const q = normalizar(texto.trim());
    if (!q) return productos;
    return productos.filter((p) => normalizar(`${p.nombre} ${p.categoria ?? ""}`).includes(q));
  }, [productos, texto]);

  function elegir(productoId: string) {
    onSeleccionar(productoId);
    setTexto("");
    setAbierto(false);
  }

  return (
    <div ref={contenedor} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={texto}
        placeholder="Buscar producto por nombre o categoría"
        className="h-10 pl-9 text-sm"
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierto(false);
          if (e.key === "Enter") {
            // Enter dentro del buscador no debe enviar el formulario completo.
            e.preventDefault();
            if (resultados.length === 1) elegir(resultados[0].id);
          }
        }}
      />

      {abierto && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegir(p.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {p.imagenUrl?.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagenUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Shirt className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.nombre}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.precioVenta != null ? formatearMoneda(p.precioVenta) : "Sin precio"}
                  {p.categoria ? ` · ${p.categoria}` : ""}
                </p>
              </div>
              <Badge
                className={cn(
                  "shrink-0 border-transparent",
                  p.existencias > 0
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                )}
              >
                {p.existencias > 0
                  ? `${p.existencias} en inventario`
                  : p.existencias < 0
                    ? `${p.existencias} en inventario`
                    : "Sin inventario"}
              </Badge>
            </button>
          ))}
          {!resultados.length && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Ningún producto coincide con “{texto}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
