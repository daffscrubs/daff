"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearRegistroAvance } from "@/actions/avance.actions";
import { createClient } from "@/lib/supabase/client";
import { visualEtapa } from "@/lib/produccion/etapa-visual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function FormAvanceColaborador({
  loteId,
  loteEtapaId,
  itemOrdenId,
  nombreEtapa,
  folioLote,
  disponible,
}: {
  loteId: string;
  loteEtapaId: string;
  itemOrdenId: string;
  nombreEtapa: string;
  folioLote: string;
  disponible: number;
}) {
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const { icon: Icon, color } = visualEtapa(nombreEtapa);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum < 1) {
      toast.error("Ingresa una cantidad válida");
      return;
    }
    if (cantidadNum > disponible) {
      toast.error(`No puedes registrar más de ${disponible} piezas`);
      return;
    }

    startTransition(async () => {
      let fotoUrl: string | null = null;
      if (foto) {
        const supabase = createClient();
        const path = `${loteId}/${crypto.randomUUID()}-${foto.name}`;
        const { error: errorSubida } = await supabase.storage
          .from("evidencia-avance")
          .upload(path, foto);
        if (errorSubida) {
          toast.error("No se pudo subir la foto: " + errorSubida.message);
          return;
        }
        fotoUrl = path;
      }

      const res = await crearRegistroAvance({
        loteId,
        loteEtapaId,
        cantidad: cantidadNum,
        observaciones,
        fotoUrl,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Avance registrado");
      // Regresa a los procesos de este mismo producto (no hasta el inicio de
      // Mi día) -- es común capturar varios sub-procesos seguidos del mismo
      // producto.
      router.push(`/mi-dia/${itemOrdenId}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">{nombreEtapa}</p>
            <p className="text-sm text-muted-foreground">{folioLote} · disponible: {disponible}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={enviar}>
          <div className="space-y-2">
            <Label htmlFor="cantidad">¿Cuántas piezas hiciste?</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cantidad"
                type="number"
                inputMode="numeric"
                min={1}
                max={disponible}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="h-12 text-center text-lg"
                required
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 px-4"
                onClick={() => setCantidad(String(disponible))}
              >
                Todo ({disponible})
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="foto">Foto (opcional)</Label>
            <Input
              id="foto"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea id="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar avance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
