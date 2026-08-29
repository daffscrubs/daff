"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ListChecks } from "lucide-react";
import { crearPrendaBordado } from "@/actions/prendasBordado.actions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fechaISOLocal } from "@/lib/fechas";
import type { DetalleBordadoInput } from "@/lib/validaciones/prendasBordado.schema";

const TIPOS: { value: DetalleBordadoInput["tipo"]; label: string }[] = [
  { value: "logo", label: "Logo" },
  { value: "nombre", label: "Nombre" },
  { value: "texto_libre", label: "Texto libre" },
];

function detalleVacio(): DetalleBordadoInput {
  return { ubicacion: "", tipo: "logo", descripcion: "" };
}

export function FormNuevaPrenda() {
  const [descripcion, setDescripcion] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState(() => fechaISOLocal(new Date()));
  const [detalles, setDetalles] = useState<DetalleBordadoInput[]>([detalleVacio()]);
  const [pendiente, startTransition] = useTransition();
  const [creada, setCreada] = useState<{ id: string; folio: string } | null>(null);
  const router = useRouter();

  function actualizarDetalle(index: number, cambios: Partial<DetalleBordadoInput>) {
    setDetalles((prev) => prev.map((d, i) => (i === index ? { ...d, ...cambios } : d)));
  }

  function agregarDetalle() {
    setDetalles((prev) => [...prev, detalleVacio()]);
  }

  function quitarDetalle(index: number) {
    setDetalles((prev) => prev.filter((_, i) => i !== index));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const detallesValidos = detalles.filter((d) => d.ubicacion.trim() && d.descripcion.trim());
    if (!detallesValidos.length) {
      toast.error("Agrega al menos un bordado");
      return;
    }
    startTransition(async () => {
      const res = await crearPrendaBordado({
        descripcion,
        clienteNombre,
        clienteTelefono: clienteTelefono || undefined,
        fechaEntregaCompromiso: fechaEntrega,
        detalles: detallesValidos,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Prenda ${res.data.folio} registrada`);
      setCreada(res.data);
    });
  }

  if (creada) {
    return (
      <div className="max-w-md space-y-4 rounded-lg border p-6">
        <div>
          <h2 className="text-lg font-semibold">Prenda registrada</h2>
          <p className="text-muted-foreground">Folio: {creada.folio}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<a href={`/api/pdf/prendas-bordado/${creada.id}`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Imprimir ticket
          </Button>
          <Button variant="outline" onClick={() => router.push("/bordados")}>
            Ver listado
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCreada(null);
              setDescripcion("");
              setClienteNombre("");
              setClienteTelefono("");
              setFechaEntrega(fechaISOLocal(new Date()));
              setDetalles([detalleVacio()]);
            }}
          >
            Registrar otra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="max-w-2xl space-y-6" onSubmit={guardar}>
      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción de la prenda</Label>
        <Input
          id="descripcion"
          placeholder="Filipina de chef"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="clienteNombre">Cliente</Label>
          <Input
            id="clienteNombre"
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clienteTelefono">Teléfono (opcional)</Label>
          <Input id="clienteTelefono" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaEntrega">Fecha de entrega</Label>
          <Input
            id="fechaEntrega"
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Bordados</Label>
          <Button type="button" variant="outline" size="sm" onClick={agregarDetalle}>
            Agregar bordado
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ubicación</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {detalles.map((d, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    placeholder="Manga izquierda"
                    value={d.ubicacion}
                    onChange={(e) => actualizarDetalle(index, { ubicacion: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    items={TIPOS}
                    value={d.tipo}
                    onValueChange={(v) => actualizarDetalle(index, { tipo: (v as DetalleBordadoInput["tipo"]) ?? "logo" })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Logo de la escuela X"
                    value={d.descripcion}
                    onChange={(e) => actualizarDetalle(index, { descripcion: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  {detalles.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => quitarDetalle(index)}>
                      Quitar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={pendiente}>
        <ListChecks className="size-4" />
        {pendiente ? "Guardando..." : "Registrar prenda"}
      </Button>
    </form>
  );
}
