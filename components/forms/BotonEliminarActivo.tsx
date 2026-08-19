"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function BotonEliminarActivo({
  activo,
  entidad = "elemento",
  onCambiarEstado,
}: {
  activo: boolean;
  entidad?: string;
  onCambiarEstado: (nuevoEstado: boolean) => Promise<void>;
}) {
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function ejecutar(nuevoEstado: boolean) {
    startTransition(async () => {
      try {
        await onCambiarEstado(nuevoEstado);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  if (!activo) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pendiente}
        onClick={(e) => {
          e.stopPropagation();
          ejecutar(true);
        }}
      >
        Activar
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={pendiente}
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        Eliminar
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Deseas eliminar este {entidad}?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>No podrás deshacer esta acción.</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pendiente}
            onClick={(e) => {
              e.stopPropagation();
              ejecutar(false);
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
