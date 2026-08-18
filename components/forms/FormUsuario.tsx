"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { crearUsuario } from "@/actions/usuarios.actions";
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

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: "colaborador", label: "Colaborador (piso)" },
  { value: "supervisor", label: "Supervisor" },
  { value: "ventas", label: "Ventas" },
  { value: "admin", label: "Admin" },
];

export function FormUsuario({ onCreado }: { onCreado?: () => void }) {
  const [rol, setRol] = useState<RolUsuario>("colaborador");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usuarioCorto, setUsuarioCorto] = useState("");
  const [pin, setPin] = useState("");
  const [pendiente, startTransition] = useTransition();

  function limpiar() {
    setNombreCompleto("");
    setEmail("");
    setPassword("");
    setUsuarioCorto("");
    setPin("");
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (rol === "colaborador") {
          await crearUsuario({ rol, nombreCompleto, usuarioCorto, pin });
        } else {
          await crearUsuario({ rol, nombreCompleto, email, password });
        }
        toast.success("Usuario creado");
        limpiar();
        onCreado?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear el usuario");
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={enviar}>
      <div className="space-y-2">
        <Label>Rol</Label>
        <Select value={rol} onValueChange={(v) => setRol(v as RolUsuario)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombreCompleto">Nombre completo</Label>
        <Input
          id="nombreCompleto"
          value={nombreCompleto}
          onChange={(e) => setNombreCompleto(e.target.value)}
          required
        />
      </div>

      {rol === "colaborador" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="usuarioCorto">Usuario</Label>
            <Input
              id="usuarioCorto"
              placeholder="martha"
              value={usuarioCorto}
              onChange={(e) => setUsuarioCorto(e.target.value.toLowerCase())}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN (6 dígitos)</Label>
            <Input
              id="pin"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </>
      )}

      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Creando..." : "Crear usuario"}
      </Button>
    </form>
  );
}
