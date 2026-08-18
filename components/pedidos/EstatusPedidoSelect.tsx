"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarEstatusPedido } from "@/actions/pedidos.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";
import type { EstatusPedido } from "@/types/database.types";

export function EstatusPedidoSelect({ id, estatus }: { id: string; estatus: EstatusPedido }) {
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function cambiar(valor: string | null) {
    if (!valor || valor === estatus) return;
    startTransition(async () => {
      try {
        await actualizarEstatusPedido(id, valor as EstatusPedido);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <Select value={estatus} onValueChange={cambiar} disabled={pendiente}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ESTATUS_PEDIDO_LABEL).map(([valor, label]) => (
          <SelectItem key={valor} value={valor}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
