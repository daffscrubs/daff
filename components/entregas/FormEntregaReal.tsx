"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registrarEntregaReal } from "@/actions/entregas.actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FormEntregaReal({ entregaId, pedidoId }: { entregaId: string; pedidoId: string }) {
  const [recibidoPor, setRecibidoPor] = useState("");
  const [notas, setNotas] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        let firmaUrl: string | null = null;
        if (foto) {
          const supabase = createClient();
          const path = `${entregaId}/${crypto.randomUUID()}-${foto.name}`;
          const { error: errorSubida } = await supabase.storage.from("evidencia-entrega").upload(path, foto);
          if (errorSubida) throw new Error("No se pudo subir la evidencia: " + errorSubida.message);
          firmaUrl = path;
        }

        await registrarEntregaReal(entregaId, pedidoId, { recibidoPor, notas, firmaUrl });
        toast.success("Entrega registrada");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar la entrega");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="max-w-md space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="recibidoPor">Nombre de quien recibe</Label>
        <Input id="recibidoPor" value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fotoEntrega">Foto/firma de confirmación (opcional)</Label>
        <Input
          id="fotoEntrega"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notasEntrega">Notas</Label>
        <Textarea id="notasEntrega" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Confirmar entrega"}
      </Button>
    </form>
  );
}
