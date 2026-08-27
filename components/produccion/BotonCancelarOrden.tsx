"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelarOrdenProduccion } from "@/actions/produccion.actions";
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

export function BotonCancelarOrden({ loteId }: { loteId: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function cancelar() {
    startTransition(async () => {
      const res = await cancelarOrdenProduccion(loteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Orden cancelada");
      router.refresh();
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={pendiente} />}>
        Cancelar orden
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Deseas cancelar esta orden de producción?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          La orden quedará marcada como cancelada. No podrás deshacer esta acción.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={pendiente} onClick={cancelar}>
            Cancelar orden
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
