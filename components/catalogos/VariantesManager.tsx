"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearVariante, eliminarVariante } from "@/actions/catalogos.actions";
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

type Variante = Database["public"]["Tables"]["variantes"]["Row"];
type Modelo = Database["public"]["Tables"]["modelos"]["Row"];

export function VariantesManager({ variantes, modelos }: { variantes: Variante[]; modelos: Modelo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [modeloId, setModeloId] = useState("");
  const [color, setColor] = useState("");
  const [tela, setTela] = useState("");
  const [diseno, setDiseno] = useState("");
  const [sku, setSku] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const nombreModelo = (id: string) => modelos.find((m) => m.id === id)?.nombre ?? "—";

  function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!modeloId) {
      toast.error("Selecciona un modelo");
      return;
    }
    startTransition(async () => {
      try {
        await crearVariante({ modeloId, color, tela, diseno, sku });
        toast.success("Variante creada");
        setColor("");
        setTela("");
        setDiseno("");
        setSku("");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear la variante");
      }
    });
  }

  function eliminar(id: string) {
    startTransition(async () => {
      try {
        await eliminarVariante(id);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger render={<Button />}>Nueva variante</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva variante</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={crear}>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={modeloId} onValueChange={(v) => setModeloId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tela">Tela</Label>
                <Input id="tela" value={tela} onChange={(e) => setTela(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diseno">Diseño</Label>
                <Input id="diseno" value={diseno} onChange={(e) => setDiseno(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
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
            <TableHead>Modelo</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Tela</TableHead>
            <TableHead>Diseño</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {variantes.map((variante) => (
            <TableRow key={variante.id}>
              <TableCell>{nombreModelo(variante.modelo_id)}</TableCell>
              <TableCell>{variante.color ?? "—"}</TableCell>
              <TableCell>{variante.tela ?? "—"}</TableCell>
              <TableCell>{variante.diseno ?? "—"}</TableCell>
              <TableCell>{variante.sku ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => eliminar(variante.id)}>
                  Eliminar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!variantes.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin variantes todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
