"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  agregarEtapaLote,
  agregarSubprocesosLote,
  quitarEtapaLote,
  quitarSubprocesoLote,
} from "@/actions/produccion.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database.types";

type LoteEtapa = Database["public"]["Tables"]["lote_etapas"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];
type ItemOrden = Database["public"]["Tables"]["items_orden_produccion"]["Row"];

interface Subproceso {
  nombre: string;
  tieneAvance: boolean;
}

// Sub-procesos dentro de un paso (ej. Confección con Manga/Delantero/Trasero/
// Cuello), completamente opcionales: si no se agrega ninguno el paso funciona
// igual que siempre. Se pueden quitar mientras nadie haya capturado avance
// en ellos, igual que un paso completo.
function SubprocesosPaso({
  loteId,
  ordenSecuencia,
  subprocesos,
  pendienteGlobal,
}: {
  loteId: string;
  ordenSecuencia: number;
  subprocesos: Subproceso[];
  pendienteGlobal: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function agregar() {
    const nombres = texto
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (!nombres.length) {
      toast.error("Escribe al menos un sub-proceso");
      return;
    }
    startTransition(async () => {
      const res = await agregarSubprocesosLote({ loteId, ordenSecuencia, nombres });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTexto("");
      setAbierto(false);
      router.refresh();
    });
  }

  function quitar(nombreSubproceso: string) {
    startTransition(async () => {
      const res = await quitarSubprocesoLote({ loteId, ordenSecuencia, nombreSubproceso });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  const bloqueado = pendiente || pendienteGlobal;

  return (
    <div className="mt-2 ml-6 space-y-2">
      {!!subprocesos.length && (
        <div className="flex flex-wrap gap-1.5">
          {subprocesos.map((s) => (
            <Badge key={s.nombre} variant="secondary" className="gap-1 pr-1">
              {s.nombre}
              {!s.tieneAvance && (
                <button
                  type="button"
                  onClick={() => quitar(s.nombre)}
                  disabled={bloqueado}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label={`Quitar sub-proceso ${s.nombre}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      {abierto ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Manga, Delantero, Trasero, Cuello"
            className="h-8 max-w-xs text-sm"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
          />
          <Button size="sm" variant="outline" disabled={bloqueado} onClick={agregar}>
            Agregar
          </Button>
          <Button size="sm" variant="ghost" disabled={bloqueado} onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={bloqueado} onClick={() => setAbierto(true)}>
          + Agregar sub-procesos
        </Button>
      )}
    </div>
  );
}

export function EtapasLoteManager({
  loteId,
  lote,
  loteEtapas,
  etapasCatalogo,
  items,
  modelos,
  tallas,
}: {
  loteId: string;
  lote: { folio: string };
  loteEtapas: LoteEtapa[];
  etapasCatalogo: EtapaProceso[];
  items: ItemOrden[];
  modelos: { id: string; nombre: string }[];
  tallas: { id: string; codigo: string }[];
}) {
  const [etapaId, setEtapaId] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  // Los pasos son compartidos por todos los productos de la orden: se agrupan
  // por orden_secuencia (cada producto tiene su propia fila de lote_etapas,
  // pero todas comparten la misma etapa y el mismo número de paso). Los
  // sub-procesos (hijas) no tienen orden_secuencia propio, así que se
  // excluyen aquí y se procesan aparte.
  const filasPadre = loteEtapas.filter((le) => !le.parent_lote_etapa_id);
  const pasos = [...new Map(filasPadre.map((le) => [le.orden_secuencia!, le])).values()].sort(
    (a, b) => a.orden_secuencia! - b.orden_secuencia!
  );

  // Sub-procesos por paso: nombre + si alguna de sus filas (una por producto)
  // ya tiene avance, para bloquear el botón de quitar en ese caso.
  const subprocesosPorPaso = new Map<number, Subproceso[]>();
  loteEtapas
    .filter((le) => le.parent_lote_etapa_id)
    .forEach((hija) => {
      const padre = filasPadre.find((p) => p.id === hija.parent_lote_etapa_id);
      if (!padre?.orden_secuencia) return;
      const lista = subprocesosPorPaso.get(padre.orden_secuencia) ?? [];
      const existente = lista.find((s) => s.nombre === hija.nombre_subproceso);
      if (existente) {
        existente.tieneAvance = existente.tieneAvance || hija.cantidad_completada > 0;
      } else {
        lista.push({ nombre: hija.nombre_subproceso!, tieneAvance: hija.cantidad_completada > 0 });
      }
      subprocesosPorPaso.set(padre.orden_secuencia, lista);
    });

  const yaUsadas = new Set(pasos.map((p) => p.etapa_id));
  const disponibles = etapasCatalogo.filter((e) => e.activo && !yaUsadas.has(e.id));
  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";
  const nombreItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return "—";
    return `${modelos.find((m) => m.id === item.modelo_id)?.nombre ?? ""} ${tallas.find((t) => t.id === item.talla_id)?.codigo ?? ""}`.trim();
  };

  function agregar() {
    if (!etapaId) {
      toast.error("Selecciona una etapa");
      return;
    }
    startTransition(async () => {
      const res = await agregarEtapaLote({ loteId, etapaId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEtapaId("");
      router.refresh();
    });
  }

  function quitar(ordenSecuencia: number) {
    startTransition(async () => {
      const res = await quitarEtapaLote(loteId, ordenSecuencia);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  const ultimoPaso = pasos[pasos.length - 1];
  const ultimoPasoSinAvance = ultimoPaso
    ? loteEtapas.filter((le) => le.orden_secuencia === ultimoPaso.orden_secuencia).every((le) => le.cantidad_completada === 0)
    : false;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Procesos de {lote.folio}</h1>
        <p className="text-muted-foreground">
          Define el proceso (ej. Corte → Confección → Terminado). Se aplica a los {items.length} producto(s) de esta orden:{" "}
          {items.map((i) => nombreItem(i.id)).join(", ")}. Si un proceso lo requiere, puedes dividirlo en sub-procesos
          (ej. Confección en Manga, Delantero, Trasero, Cuello) — es opcional.
        </p>
      </div>

      <ol className="space-y-3">
        {pasos.map((paso, index) => (
          <li key={paso.orden_secuencia} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span>
                <span className="mr-2 text-muted-foreground">{paso.orden_secuencia}.</span>
                {nombreEtapa(paso.etapa_id!)}
              </span>
              {index === pasos.length - 1 && ultimoPasoSinAvance && (
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => quitar(paso.orden_secuencia!)}>
                  Quitar
                </Button>
              )}
            </div>
            <SubprocesosPaso
              loteId={loteId}
              ordenSecuencia={paso.orden_secuencia!}
              subprocesos={subprocesosPorPaso.get(paso.orden_secuencia!) ?? []}
              pendienteGlobal={pendiente}
            />
          </li>
        ))}
        {!pasos.length && (
          <p className="text-sm text-muted-foreground">Aún no hay etapas configuradas.</p>
        )}
      </ol>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Select
            items={disponibles.map((e) => ({ value: e.id, label: e.nombre }))}
            value={etapaId}
            onValueChange={(v) => setEtapaId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Agregar proceso..." />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={agregar} disabled={pendiente || !disponibles.length}>
          Agregar
        </Button>
      </div>

      {!!pasos.length && (
        <Button render={<Link href={`/produccion/${loteId}`} />} nativeButton={false}>
          Ver orden
        </Button>
      )}
    </div>
  );
}
