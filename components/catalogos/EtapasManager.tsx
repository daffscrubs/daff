"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { alternarEtapaActiva, crearEtapa } from "@/actions/catalogos.actions";
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

type Etapa = Database["public"]["Tables"]["etapas_proceso"]["Row"];

export function EtapasManager({ etapas, esAdmin }: { etapas: Etapa[]; esAdmin: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearEtapa({ nombre, descripcion });
        toast.success("Etapa creada");
        setNombre("");
        setDescripcion("");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear la etapa");
      }
    });
  }

  function alternar(id: string, activo: boolean) {
    startTransition(async () => {
      try {
        await alternarEtapaActiva(id, !activo);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <div className="space-y-4">
      {esAdmin && (
        <div className="flex justify-end">
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger render={<Button />}>Nueva etapa</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva etapa de proceso</DialogTitle>
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
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Estatus</TableHead>
            {esAdmin && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {etapas.map((etapa) => (
            <TableRow key={etapa.id}>
              <TableCell>{etapa.nombre}</TableCell>
              <TableCell className="text-muted-foreground">{etapa.descripcion ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={etapa.activo ? "default" : "secondary"}>
                  {etapa.activo ? "Activa" : "Inactiva"}
                </Badge>
              </TableCell>
              {esAdmin && (
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => alternar(etapa.id, etapa.activo)}>
                    {etapa.activo ? "Desactivar" : "Activar"}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {!etapas.length && (
            <TableRow>
              <TableCell colSpan={esAdmin ? 4 : 3} className="text-center text-muted-foreground">
                Sin etapas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
