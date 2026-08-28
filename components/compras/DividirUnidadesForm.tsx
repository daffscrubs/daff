"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { crearUnidadesDesdeCompra } from "@/actions/unidadesMaterial.actions";
import type { ItemCompraConSeguimiento } from "@/actions/compras.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface FilaDivision {
  cantidadPorUnidad: string;
  numeroDeUnidades: string;
}

function filaVacia(): FilaDivision {
  return { cantidadPorUnidad: "", numeroDeUnidades: "1" };
}

function totalDeFilas(filas: FilaDivision[]): number {
  return filas.reduce((acc, f) => acc + (Number(f.cantidadPorUnidad) || 0) * (Number(f.numeroDeUnidades) || 0), 0);
}

// Expande "25 x 4, 20 x 1" al arreglo plano que espera crearUnidadesDesdeCompra:
// [25, 25, 25, 25, 20].
function expandirFilas(filas: FilaDivision[]): number[] {
  const cantidades: number[] = [];
  for (const fila of filas) {
    const cantidad = Number(fila.cantidadPorUnidad);
    const veces = Number(fila.numeroDeUnidades);
    if (!(cantidad > 0) || !(veces > 0)) continue;
    for (let i = 0; i < veces; i++) cantidades.push(cantidad);
  }
  return cantidades;
}

export function DividirUnidadesForm({
  itemsParaDividir,
  onTerminado,
}: {
  itemsParaDividir: ItemCompraConSeguimiento[];
  onTerminado: () => void;
}) {
  const [filasPorItem, setFilasPorItem] = useState<Record<string, FilaDivision[]>>(() =>
    Object.fromEntries(itemsParaDividir.map((item) => [item.compraItemId, [filaVacia()]]))
  );
  const [pendiente, startTransition] = useTransition();
  const [idsGenerados, setIdsGenerados] = useState<string[] | null>(null);

  function actualizarFila(compraItemId: string, index: number, cambios: Partial<FilaDivision>) {
    setFilasPorItem((prev) => ({
      ...prev,
      [compraItemId]: prev[compraItemId].map((f, i) => (i === index ? { ...f, ...cambios } : f)),
    }));
  }

  function agregarFila(compraItemId: string) {
    setFilasPorItem((prev) => ({ ...prev, [compraItemId]: [...prev[compraItemId], filaVacia()] }));
  }

  function quitarFila(compraItemId: string, index: number) {
    setFilasPorItem((prev) => ({
      ...prev,
      [compraItemId]: prev[compraItemId].filter((_, i) => i !== index),
    }));
  }

  function confirmar() {
    startTransition(async () => {
      const idsTotales: string[] = [];
      const errores: string[] = [];

      for (const item of itemsParaDividir) {
        const cantidades = expandirFilas(filasPorItem[item.compraItemId] ?? []);
        if (!cantidades.length) continue;

        const res = await crearUnidadesDesdeCompra({ compraItemId: item.compraItemId, cantidades });
        if (!res.ok) {
          errores.push(`${item.materialNombre}: ${res.error}`);
          continue;
        }
        idsTotales.push(...res.data.idsCreados);
      }

      if (errores.length) {
        errores.forEach((e) => toast.error(e));
      }
      if (idsTotales.length) {
        toast.success(`${idsTotales.length} unidad${idsTotales.length === 1 ? "" : "es"} creada${idsTotales.length === 1 ? "" : "s"}`);
        setIdsGenerados(idsTotales);
      } else if (!errores.length) {
        toast.error("No se generó ninguna unidad — agrega al menos una cantidad válida.");
      }
    });
  }

  if (idsGenerados) {
    return (
      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-semibold">Unidades generadas</h2>
          <p className="text-sm text-muted-foreground">
            Se crearon {idsGenerados.length} unidad{idsGenerados.length === 1 ? "" : "es"} con su código QR. Descarga las
            etiquetas para imprimirlas y pegarlas en cada rollo/bolsa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<a href={`/api/pdf/unidades-material?ids=${idsGenerados.join(",")}`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Descargar etiquetas (PDF)
          </Button>
          <Button variant="outline" onClick={onTerminado}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Dividir en unidades</h2>
        <p className="text-sm text-muted-foreground">
          Estos materiales se controlan por unidad (rollo/bolsa con QR). Indica en cuántas unidades se dividió cada uno.
        </p>
      </div>

      {itemsParaDividir.map((item) => {
        const filas = filasPorItem[item.compraItemId] ?? [];
        const total = totalDeFilas(filas);
        const coincide = total === item.cantidadComprada;

        return (
          <div key={item.compraItemId} className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.materialNombre}</p>
              <p className="text-sm text-muted-foreground">Comprado: {item.cantidadComprada}</p>
            </div>

            <div className="space-y-2">
              {filas.map((fila, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    placeholder="Cantidad por unidad"
                    className="w-36"
                    value={fila.cantidadPorUnidad}
                    onChange={(e) => actualizarFila(item.compraItemId, index, { cantidadPorUnidad: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    placeholder="Unidades"
                    className="w-24"
                    value={fila.numeroDeUnidades}
                    onChange={(e) => actualizarFila(item.compraItemId, index, { numeroDeUnidades: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">unidad(es)</span>
                  {filas.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => quitarFila(item.compraItemId, index)}>
                      Quitar
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => agregarFila(item.compraItemId)}>
                Agregar renglón
              </Button>
              <span className="text-sm">
                Total: <strong>{total}</strong> de {item.cantidadComprada}
              </span>
              {!coincide && total > 0 && <Badge variant="destructive">No coincide con lo comprado</Badge>}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <Button onClick={confirmar} disabled={pendiente}>
          {pendiente ? "Generando..." : "Generar unidades y etiquetas"}
        </Button>
        <Button type="button" variant="ghost" onClick={onTerminado}>
          Hacerlo después
        </Button>
      </div>
    </div>
  );
}
