"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { crearPlantilla, eliminarPlantilla } from "@/actions/catalogos.actions";
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

type Plantilla = Database["public"]["Tables"]["plantillas_pedido"]["Row"];
type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

export function PlantillasManager({ plantillas, clientes }: { plantillas: Plantilla[]; clientes: Cliente[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombreCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nombre_comercial ?? "Genérica";

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearPlantilla({ nombre, clienteId: clienteId || null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Plantilla creada");
      setNombre("");
      setClienteId("");
      setAbierto(false);
      router.refresh();
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarPlantilla(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button />}>Nueva plantilla</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva plantilla</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={crear}>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <Select
                  items={clientes.map((c) => ({ value: c.id, label: c.nombre_comercial }))}
                  value={clienteId}
                  onValueChange={(v) => setClienteId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Genérica (cualquier cliente)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre_comercial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <TableHead>Cliente</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {plantillas.map((plantilla) => (
            <TableRow key={plantilla.id}>
              <TableCell>
                <Link href={`/catalogos/plantillas/${plantilla.id}`} className="font-medium hover:underline">
                  {plantilla.nombre}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{nombreCliente(plantilla.cliente_id)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => eliminar(plantilla.id)}>
                  Eliminar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!plantillas.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin plantillas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
