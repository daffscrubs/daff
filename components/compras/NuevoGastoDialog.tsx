"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearGasto } from "@/actions/compras.actions";
import { CATEGORIAS_GASTO } from "@/lib/validaciones/compras.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { fechaISOLocal } from "@/lib/fechas";

const ETIQUETA_CATEGORIA: Record<(typeof CATEGORIAS_GASTO)[number], string> = {
  renta: "Renta",
  servicios: "Servicios (luz, agua, internet)",
  nomina: "Nómina",
  transporte: "Transporte",
  mantenimiento: "Mantenimiento",
  otro: "Otro",
};

export function NuevoGastoDialog() {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(() => fechaISOLocal(new Date()));
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_GASTO)[number]>("otro");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await crearGasto({ fecha, categoria, concepto, monto: Number(monto), notas });
        toast.success("Gasto registrado");
        setConcepto("");
        setMonto("");
        setNotas("");
        setAbierto(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al registrar");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>Nuevo gasto</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo gasto</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={crear}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaGasto">Fecha</Label>
              <Input id="fechaGasto" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                items={CATEGORIAS_GASTO.map((c) => ({ value: c, label: ETIQUETA_CATEGORIA[c] }))}
                value={categoria}
                onValueChange={(v) => setCategoria((v ?? "otro") as typeof categoria)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_GASTO.map((c) => (
                    <SelectItem key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="concepto">Concepto</Label>
            <Input id="concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monto">Monto</Label>
            <Input id="monto" type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notasGasto">Notas</Label>
            <Textarea id="notasGasto" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={pendiente}>
            {pendiente ? "Guardando..." : "Registrar gasto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
