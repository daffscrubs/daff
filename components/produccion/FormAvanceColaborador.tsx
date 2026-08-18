"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearRegistroAvance } from "@/actions/avance.actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FormAvanceColaborador({
  loteId,
  loteEtapaId,
  nombreEtapa,
  folioLote,
  disponible,
}: {
  loteId: string;
  loteEtapaId: string;
  nombreEtapa: string;
  folioLote: string;
  disponible: number;
}) {
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

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
      try {
        let fotoUrl: string | null = null;
        if (foto) {
          const supabase = createClient();
          const path = `${loteId}/${crypto.randomUUID()}-${foto.name}`;
          const { error: errorSubida } = await supabase.storage
            .from("evidencia-avance")
            .upload(path, foto);
          if (errorSubida) throw new Error("No se pudo subir la foto: " + errorSubida.message);
          fotoUrl = path;
        }

        await crearRegistroAvance({
          loteId,
          loteEtapaId,
          cantidad: cantidadNum,
          observaciones,
          fotoUrl,
        });
        toast.success("Avance registrado");
        router.push("/mi-dia");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar avance");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{nombreEtapa}</CardTitle>
        <p className="text-sm text-muted-foreground">{folioLote} · disponible: {disponible}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={enviar}>
          <div className="space-y-2">
            <Label htmlFor="cantidad">¿Cuántas piezas hiciste?</Label>
            <Input
              id="cantidad"
              type="number"
              inputMode="numeric"
              min={1}
              max={disponible}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
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
          <Button type="submit" className="w-full" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar avance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
