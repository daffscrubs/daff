"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelarPedido } from "@/actions/pedidos.actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function BotonCancelarPedido({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function cancelar() {
    startTransition(async () => {
      try {
        await cancelarPedido(id);
        toast.success("Pedido cancelado");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cancelar");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={pendiente} />}>
        Cancelar pedido
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Deseas cancelar este pedido?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          El pedido quedará marcado como cancelado. No podrás deshacer esta acción.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={pendiente} onClick={cancelar}>
            Cancelar pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
