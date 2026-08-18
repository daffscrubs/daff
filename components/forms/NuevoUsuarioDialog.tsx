"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormUsuario } from "@/components/forms/FormUsuario";

export function NuevoUsuarioDialog() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>Nuevo usuario</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <FormUsuario
          onCreado={() => {
            setAbierto(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
