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
        const res = await actualizarCliente(id, datos);
        if (!res.ok) throw new Error(res.error);
        toast.success("Cliente actualizado");
        router.refresh();
      }}
    />
  );
}
