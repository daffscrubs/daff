"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarCliente } from "@/actions/clientes.actions";
import { FormCliente } from "@/components/forms/FormCliente";
import type { ClienteInput } from "@/lib/validaciones/clientes.schema";

export function EditarClienteForm({ id, valoresIniciales }: { id: string; valoresIniciales: ClienteInput }) {
  const router = useRouter();

  return (
    <FormCliente
      valoresIniciales={valoresIniciales}
      textoBoton="Guardar cambios"
      onGuardar={async (datos) => {
        await actualizarCliente(id, datos);
        toast.success("Cliente actualizado");
        router.refresh();
      }}
    />
  );
}
