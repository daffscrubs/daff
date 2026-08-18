"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearCliente } from "@/actions/clientes.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormCliente } from "@/components/forms/FormCliente";

export function NuevoClienteDialog() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>Nuevo cliente</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <FormCliente
          textoBoton="Crear cliente"
          onGuardar={async (datos) => {
            await crearCliente(datos);
            toast.success("Cliente creado");
            setAbierto(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
