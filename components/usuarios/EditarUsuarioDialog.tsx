"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarUsuario, obtenerUsuarioParaEditar } from "@/actions/usuarios.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RolUsuario } from "@/types/database.types";

export type UsuarioParaEditar = Awaited<ReturnType<typeof obtenerUsuarioParaEditar>>;

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: "colaborador", label: "Colaborador (piso)" },
  { value: "supervisor", label: "Supervisor" },
  { value: "ventas", label: "Ventas" },
  { value: "admin", label: "Admin" },
];

export function EditarUsuarioDialog({
  open,
  onOpenChange,
  detalle,
  cargando,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalle: UsuarioParaEditar | null;
  cargando: boolean;
}) {
  const router = useRouter();
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [rol, setRol] = useState<RolUsuario>("colaborador");
  const [usuarioCorto, setUsuarioCorto] = useState("");
  const [email, setEmail] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [inicializadoPara, setInicializadoPara] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (detalle?.perfil && detalle.perfil.id !== inicializadoPara) {
    setInicializadoPara(detalle.perfil.id);
    setNombreCompleto(detalle.perfil.nombre_completo);
    setRol(detalle.perfil.rol);
    setUsuarioCorto(detalle.perfil.usuario_corto ?? "");
    setEmail(detalle.email);
    setNuevaContrasena("");
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!detalle?.perfil) return;
    startTransition(async () => {
      try {
        await actualizarUsuario(detalle.perfil.id, {
          nombreCompleto,
          rol,
          usuarioCorto: rol === "colaborador" ? usuarioCorto.toLowerCase() : undefined,
          email: rol !== "colaborador" ? email : undefined,
          nuevaContrasena: nuevaContrasena || undefined,
        });
        toast.success("Usuario actualizado");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {cargando || !detalle ? (
          <div className="space-y-3 p-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Editar usuario</DialogTitle>
              <DialogDescription>Modifica los datos, el rol o restablece la contraseña.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={guardar}>
              <div className="space-y-2">
                <Label htmlFor="nombreCompleto">Nombre completo</Label>
                <Input
                  id="nombreCompleto"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select items={ROLES} value={rol} onValueChange={(v) => setRol(v as RolUsuario)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {rol === "colaborador" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="usuarioCorto">Usuario</Label>
                    <Input
                      id="usuarioCorto"
                      value={usuarioCorto}
                      onChange={(e) => setUsuarioCorto(e.target.value.toLowerCase())}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevoPin">Nuevo PIN (opcional)</Label>
                    <Input
                      id="nuevoPin"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Dejar en blanco para no cambiarlo"
                      value={nuevaContrasena}
                      onChange={(e) => setNuevaContrasena(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevaContrasena">Nueva contraseña (opcional)</Label>
                    <Input
                      id="nuevaContrasena"
                      type="password"
                      placeholder="Dejar en blanco para no cambiarla"
                      value={nuevaContrasena}
                      onChange={(e) => setNuevaContrasena(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={pendiente}>
                {pendiente ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
