"use client";

import { Factory, HandCoins, PauseCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoProduccion } from "@/lib/validaciones/produccion.schema";
import { cn } from "@/lib/utils";

export interface MaquileroOpcion {
  id: string;
  nombre: string;
  activo: boolean;
}

const OPCIONES: { valor: TipoProduccion; titulo: string; detalle: string; icono: typeof Factory }[] = [
  { valor: "sin_asignar", titulo: "Sin asignar", detalle: "El corte espera; se decide después", icono: PauseCircle },
  { valor: "interna", titulo: "Interna", detalle: "Se hace en nuestro taller", icono: Factory },
  { valor: "maquila", titulo: "Maquila", detalle: "Se la lleva un maquilero a su taller", icono: HandCoins },
];

// Quién hace la orden: nuestro taller, un maquilero (con su precio por pieza por modelo) o todavía nadie (el corte
// está parado y se decide cuando haga falta). Los precios son montos: solo los captura y ve quien tiene el permiso
// de pagos de maquila.
export function CamposTipoProduccion({
  tipo,
  onTipo,
  maquileroId,
  onMaquilero,
  maquileros,
  modelosOrden,
  precios,
  onPrecio,
  puedeVerPrecios,
  bloqueado = false,
  titulo = "¿Quién va a hacer esta orden?",
}: {
  tipo: TipoProduccion;
  onTipo: (tipo: TipoProduccion) => void;
  maquileroId: string;
  onMaquilero: (id: string) => void;
  maquileros: MaquileroOpcion[];
  modelosOrden: { id: string; nombre: string }[];
  precios: Record<string, string>;
  onPrecio: (modeloId: string, valor: string) => void;
  puedeVerPrecios: boolean;
  /** La orden ya tiene entregas: el tipo y el maquilero no se pueden cambiar. */
  bloqueado?: boolean;
  titulo?: string;
}) {
  const disponibles = maquileros.filter((m) => m.activo || m.id === maquileroId);
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="space-y-2">
        <Label>{titulo}</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPCIONES.map((o) => {
            const activa = tipo === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                disabled={bloqueado && !activa}
                aria-pressed={activa}
                onClick={() => onTipo(o.valor)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  activa ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  bloqueado && !activa && "cursor-not-allowed opacity-50"
                )}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-lg", activa ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <o.icono className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{o.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{o.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
        {bloqueado && <p className="text-xs text-muted-foreground">Esta orden ya tiene entregas: el tipo y el maquilero ya no se pueden cambiar.</p>}
      </div>

      {tipo === "maquila" && (
        <div className="space-y-4">
          <div className="max-w-sm space-y-2">
            <Label>Maquilero</Label>
            <Select items={disponibles.map((m) => ({ value: m.id, label: m.nombre }))} value={maquileroId} onValueChange={(v) => onMaquilero(v ?? "")} disabled={bloqueado}>
              <SelectTrigger className="w-full" aria-label="Maquilero">
                <SelectValue placeholder={disponibles.length ? "Elige el maquilero" : "Primero da de alta un maquilero"} />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                    {m.activo ? "" : " (inactivo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!maquileros.length && <p className="text-xs text-muted-foreground">Da de alta a tus maquileros en Producción → Maquileros.</p>}
          </div>

          {puedeVerPrecios ? (
            <div className="space-y-2">
              <Label>Precio por pieza acordado (por modelo)</Label>
              {modelosOrden.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {modelosOrden.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.nombre}</span>
                      <div className="relative w-32">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input
                          inputMode="decimal"
                          aria-label={`Precio por pieza de ${m.nombre}`}
                          placeholder="0.00"
                          className="pl-6"
                          value={precios[m.id] ?? ""}
                          onChange={(e) => onPrecio(m.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Agrega productos a la orden para capturar su precio por pieza.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Es el mismo precio para todas las tallas del modelo. Si lo cambias después, solo aplica a las entregas nuevas: los pagos ya generados conservan su monto.
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              El precio por pieza lo captura el administrador. Hasta que lo capture no se podrán registrar entregas de esta orden.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
