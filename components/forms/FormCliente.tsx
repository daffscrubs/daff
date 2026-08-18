"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClienteInput } from "@/lib/validaciones/clientes.schema";

export function FormCliente({
  valoresIniciales,
  onGuardar,
  textoBoton = "Guardar",
}: {
  valoresIniciales?: Partial<ClienteInput>;
  onGuardar: (datos: ClienteInput) => Promise<void>;
  textoBoton?: string;
}) {
  const [datos, setDatos] = useState<ClienteInput>({
    nombreComercial: valoresIniciales?.nombreComercial ?? "",
    razonSocial: valoresIniciales?.razonSocial ?? "",
    rfc: valoresIniciales?.rfc ?? "",
    contactoNombre: valoresIniciales?.contactoNombre ?? "",
    telefono: valoresIniciales?.telefono ?? "",
    email: valoresIniciales?.email ?? "",
    direccion: valoresIniciales?.direccion ?? "",
    notas: valoresIniciales?.notas ?? "",
  });
  const [pendiente, startTransition] = useTransition();

  function set<K extends keyof ClienteInput>(campo: K, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await onGuardar(datos);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={enviar}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombreComercial">Nombre comercial</Label>
          <Input id="nombreComercial" value={datos.nombreComercial} onChange={(e) => set("nombreComercial", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="razonSocial">Razón social</Label>
          <Input id="razonSocial" value={datos.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rfc">RFC</Label>
          <Input id="rfc" value={datos.rfc} onChange={(e) => set("rfc", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactoNombre">Nombre de contacto</Label>
          <Input id="contactoNombre" value={datos.contactoNombre} onChange={(e) => set("contactoNombre", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" value={datos.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" value={datos.email} onChange={(e) => set("email", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="direccion">Dirección</Label>
        <Textarea id="direccion" value={datos.direccion} onChange={(e) => set("direccion", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" value={datos.notas} onChange={(e) => set("notas", e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Guardando..." : textoBoton}
      </Button>
    </form>
  );
}
