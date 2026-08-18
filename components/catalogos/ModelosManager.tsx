"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { alternarModeloActivo, crearModelo } from "@/actions/catalogos.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database.types";

type Modelo = Database["public"]["Tables"]["modelos"]["Row"];

export function ModelosManager({ modelos }: { modelos: Modelo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearModelo({ nombre, descripcion });
        toast.success("Modelo creado");
        setNombre("");
        setDescripcion("");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear el modelo");
      }
    });
  }

  function alternar(id: string, activo: boolean) {
    startTransition(async () => {
      try {
        await alternarModeloActivo(id, !activo);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button />}>Nuevo modelo</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo modelo</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={crear}>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={pendiente}>
                {pendiente ? "Creando..." : "Crear"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {modelos.map((modelo) => (
            <TableRow key={modelo.id}>
              <TableCell>{modelo.nombre}</TableCell>
              <TableCell className="text-muted-foreground">{modelo.descripcion ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={modelo.activo ? "default" : "secondary"}>
                  {modelo.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => alternar(modelo.id, modelo.activo)}>
                  {modelo.activo ? "Desactivar" : "Activar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!modelos.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin modelos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
