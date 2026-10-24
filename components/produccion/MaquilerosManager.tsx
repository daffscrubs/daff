"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HandCoins, Pencil, Plus } from "lucide-react";
import { actualizarMaquilero, alternarMaquileroActivo, crearMaquilero } from "@/actions/maquileros.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearMoneda } from "@/lib/dinero";

export interface MaquileroFila {
  id: string;
  nombre: string;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  ordenesAbiertas: number;
  piezasPendientes: number;
  /** Solo para quien ve montos; null = no mostrar. */
  porPagar: number | null;
  banco: string;
  clabe: string;
}

interface Formulario {
  id: string | null;
  nombre: string;
  telefono: string;
  notas: string;
  banco: string;
  clabe: string;
}
const VACIO: Formulario = { id: null, nombre: "", telefono: "", notas: "", banco: "", clabe: "" };

export function MaquilerosManager({ maquileros, puedeVerDatosBancarios }: { maquileros: MaquileroFila[]; puedeVerDatosBancarios: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Formulario | null>(null);
  const [pendiente, startTransition] = useTransition();
  const campo = (k: keyof Formulario, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function guardar() {
    if (!form) return;
    startTransition(async () => {
      const datos = { nombre: form.nombre, telefono: form.telefono, notas: form.notas, banco: form.banco, clabe: form.clabe };
      const res = form.id ? await actualizarMaquilero(form.id, datos) : await crearMaquilero(datos);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(form.id ? "Maquilero actualizado" : "Maquilero creado");
      setForm(null);
      router.refresh();
    });
  }

  function alternar(m: MaquileroFila) {
    startTransition(async () => {
      const res = await alternarMaquileroActivo(m.id, !m.activo);
      if (!res.ok) return void toast.error(res.error);
      toast.success(m.activo ? "Maquilero desactivado (ya no sale al crear órdenes)" : "Maquilero activado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm(VACIO)}>
          <Plus className="size-4" />
          Nuevo maquilero
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Maquilero</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Órdenes abiertas</TableHead>
              <TableHead className="text-right">Piezas por entregar</TableHead>
              {maquileros.some((m) => m.porPagar !== null) && <TableHead className="text-right">Por pagar</TableHead>}
              <TableHead>Estatus</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {maquileros.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="pl-4">
                  <Link href={`/produccion/maquileros/${m.id}`} className="font-medium hover:underline">
                    {m.nombre}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{m.telefono ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{m.ordenesAbiertas || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{m.piezasPendientes || "—"}</TableCell>
                {m.porPagar !== null && <TableCell className="text-right tabular-nums">{m.porPagar > 0 ? formatearMoneda(m.porPagar) : "—"}</TableCell>}
                <TableCell>
                  <Badge variant={m.activo ? "default" : "secondary"}>{m.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ id: m.id, nombre: m.nombre, telefono: m.telefono ?? "", notas: m.notas ?? "", banco: m.banco, clabe: m.clabe })}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" disabled={pendiente} onClick={() => alternar(m)}>
                      {m.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!maquileros.length && (
              <TableRow>
                <TableCell colSpan={7}>
                  <EstadoVacio icon={HandCoins} titulo="Sin maquileros todavía" descripcion="Da de alta a quien te maquila para poder asignarle órdenes de producción." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && !pendiente && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar maquilero" : "Nuevo maquilero"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                guardar();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="mq-nombre">Nombre</Label>
                <Input id="mq-nombre" autoFocus value={form.nombre} onChange={(e) => campo("nombre", e.target.value)} placeholder="Nombre del maquilero o taller" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mq-tel">Teléfono (opcional)</Label>
                <Input id="mq-tel" inputMode="tel" value={form.telefono} onChange={(e) => campo("telefono", e.target.value)} />
              </div>
              {puedeVerDatosBancarios && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="mq-banco">Banco (opcional)</Label>
                    <Input id="mq-banco" value={form.banco} onChange={(e) => campo("banco", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mq-clabe">CLABE (opcional)</Label>
                    <Input id="mq-clabe" inputMode="numeric" maxLength={18} value={form.clabe} onChange={(e) => campo("clabe", e.target.value.replace(/\D/g, ""))} placeholder="18 dígitos" />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="mq-notas">Notas (opcional)</Label>
                <Input id="mq-notas" value={form.notas} onChange={(e) => campo("notas", e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={pendiente}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pendiente || form.nombre.trim().length < 2}>
                  {pendiente ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
