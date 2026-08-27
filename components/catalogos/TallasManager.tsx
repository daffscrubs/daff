"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearTalla, eliminarTalla } from "@/actions/catalogos.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Talla = Database["public"]["Tables"]["tallas"]["Row"];

export function TallasManager({ tallas }: { tallas: Talla[] }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [orden, setOrden] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearTalla({ codigo, orden: Number(orden) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Talla creada");
      setCodigo("");
      setOrden("");
      setAbierto(false);
      router.refresh();
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      const res = await eliminarTalla(id);
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
          <DialogTrigger render={<Button />}>Nueva talla</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva talla</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={crear}>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" placeholder="M" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orden">Orden</Label>
                <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} required />
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
            <TableHead>Código</TableHead>
            <TableHead>Orden</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tallas.map((talla) => (
            <TableRow key={talla.id}>
              <TableCell>{talla.codigo}</TableCell>
              <TableCell>{talla.orden}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => eliminar(talla.id)}>
                  Eliminar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!tallas.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin tallas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
