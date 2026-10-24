"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PauseCircle, Send } from "lucide-react";
import { asignarOrdenProduccion } from "@/actions/produccion.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CamposTipoProduccion, type MaquileroOpcion } from "@/components/produccion/CamposTipoProduccion";
import type { TipoProduccion } from "@/lib/validaciones/produccion.schema";

// Decide quién hará la orden: el taller o un maquilero. Un corte puede quedar parado y asignarse cuando haga falta;
// mientras no tenga entregas se puede cambiar de opinión.
export function AsignarOrden({
  modo,
  loteId,
  tipoActual,
  maquileroActual,
  maquileros,
  modelosOrden,
  preciosIniciales,
  puedeVerPrecios,
}: {
  /** "tarjeta": aviso de orden sin asignar con su botón. "boton": solo el botón para cambiar la asignación. */
  modo: "tarjeta" | "boton";
  loteId: string;
  tipoActual: TipoProduccion;
  maquileroActual: string;
  maquileros: MaquileroOpcion[];
  modelosOrden: { id: string; nombre: string }[];
  preciosIniciales: Record<string, string>;
  puedeVerPrecios: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoProduccion>(tipoActual === "sin_asignar" ? "interna" : tipoActual);
  const [maquileroId, setMaquileroId] = useState(maquileroActual);
  const [precios, setPrecios] = useState<Record<string, string>>(preciosIniciales);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    if (tipo === "maquila" && !maquileroId) return void toast.error("Elige el maquilero.");
    const preciosCapturados =
      tipo === "maquila" && puedeVerPrecios
        ? modelosOrden.filter((m) => (precios[m.id] ?? "").trim() !== "").map((m) => ({ modeloId: m.id, precioPorPieza: Number((precios[m.id] ?? "").replace(/[$,\s]/g, "")) }))
        : undefined;
    if (preciosCapturados?.some((p) => !Number.isFinite(p.precioPorPieza) || p.precioPorPieza < 0)) {
      return void toast.error("Revisa los precios por pieza: deben ser números mayores o iguales a cero.");
    }
    startTransition(async () => {
      const res = await asignarOrdenProduccion(loteId, { tipoProduccion: tipo, maquileroId: tipo === "maquila" ? maquileroId : null, precios: preciosCapturados });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tipo === "maquila" ? "Orden asignada a maquila" : tipo === "interna" ? "Orden asignada al taller" : "La orden quedó sin asignar");
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      {modo === "tarjeta" ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <PauseCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Esta orden todavía no tiene quién la haga</p>
              <p className="text-sm opacity-90">El corte puede esperar. Cuando lo decidas, asígnala al taller o mándala a un maquilero para poder registrar sus entregas.</p>
            </div>
          </div>
          <Button type="button" onClick={() => setAbierto(true)}>
            <Send className="size-4" />
            Asignar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
          Cambiar quién la hace
        </Button>
      )}

      <Dialog open={abierto} onOpenChange={(o) => !pendiente && setAbierto(o)}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
            <DialogTitle className="text-xl">¿Quién va a hacer esta orden?</DialogTitle>
            <p className="text-sm text-muted-foreground">Puedes cambiarlo mientras la orden no tenga entregas.</p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <CamposTipoProduccion
              titulo="Elige una opción"
              tipo={tipo}
              onTipo={setTipo}
              maquileroId={maquileroId}
              onMaquilero={setMaquileroId}
              maquileros={maquileros}
              modelosOrden={modelosOrden}
              precios={precios}
              onPrecio={(modeloId, valor) => setPrecios((prev) => ({ ...prev, [modeloId]: valor }))}
              puedeVerPrecios={puedeVerPrecios}
            />
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setAbierto(false)} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="button" onClick={guardar} disabled={pendiente}>
              {pendiente ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
