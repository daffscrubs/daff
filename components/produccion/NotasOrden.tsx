"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarNotasOrden } from "@/actions/produccion.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotasOrden({ loteId, notasIniciales }: { loteId: string; notasIniciales: string }) {
  const [notas, setNotas] = useState(notasIniciales);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function guardar() {
    startTransition(async () => {
      const res = await actualizarNotasOrden(loteId, notas);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Notas guardadas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Notas de la orden (instrucciones especiales, detalles del cliente, etc.)"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />
      <Button size="sm" variant="outline" onClick={guardar} disabled={pendiente || notas === notasIniciales}>
        {pendiente ? "Guardando..." : "Guardar notas"}
      </Button>
    </div>
  );
}
