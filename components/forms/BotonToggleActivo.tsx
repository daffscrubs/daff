"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cambiarEstadoUsuario } from "@/actions/usuarios.actions";
import { Button } from "@/components/ui/button";

export function BotonToggleActivo({ id, activo }: { id: string; activo: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function alternar() {
    startTransition(async () => {
      try {
        await cambiarEstadoUsuario(id, !activo);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <Button variant="ghost" size="sm" disabled={pendiente} onClick={alternar}>
      {activo ? "Desactivar" : "Activar"}
    </Button>
  );
}
