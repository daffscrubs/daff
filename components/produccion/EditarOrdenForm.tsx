"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarOrdenProduccion } from "@/actions/produccion.actions";
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
import { BuscadorProductos } from "@/components/produccion/BuscadorProductos";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database.types";
import type { ItemOrdenInput } from "@/lib/validaciones/produccion.schema";

type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type ModeloTalla = Database["public"]["Tables"]["modelo_tallas"]["Row"];
type Ubicacion = Database["public"]["Tables"]["ubicaciones"]["Row"];

export function EditarOrdenForm({
  loteId,
  folio,
  fechaFinEstimadaInicial,
  ubicacionDestinoInicial,
  itemsIniciales,
  bloqueado,
  modelos,
  tallas,
  modeloTallas,
  existencias,
  ubicaciones,
}: {
  loteId: string;
  folio: string;
  fechaFinEstimadaInicial: string;
  ubicacionDestinoInicial: string;
  itemsIniciales: ItemOrdenInput[];
  bloqueado: boolean;
  modelos: Modelo[];
  tallas: Talla[];
  modeloTallas: ModeloTalla[];
  /** Piezas en inventario por modelo (suma de todas sus tallas). */
  existencias: Record<string, number>;
  ubicaciones: Ubicacion[];
}) {
  const [fechaFinEstimada, setFechaFinEstimada] = useState(fechaFinEstimadaInicial);
  const [ubicacionDestinoId, setUbicacionDestinoId] = useState(ubicacionDestinoInicial);
  const [items, setItems] = useState<ItemOrdenInput[]>(itemsIniciales);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function tallasDeModelo(modeloId: string) {
    const asignadas = modeloTallas.filter((mt) => mt.modelo_id === modeloId).map((mt) => mt.talla_id);
    if (!asignadas.length) return tallas;
    return tallas.filter((t) => asignadas.includes(t.id));
  }

  // Elegir un producto en el buscador agrega una línea con ese modelo ya
  // puesto; solo falta la talla y la cantidad.
  function agregarProducto(modeloId: string) {
    setItems((prev) => [...prev, { modeloId, tallaId: "", cantidadPlaneada: 1 }]);
  }

  function actualizarItem(index: number, cambios: Partial<ItemOrdenInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...cambios } : item)));
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Solo modelos activos se ofrecen para agregar; los ya agregados a la
  // orden siguen mostrando su nombre aunque se hayan desactivado después.
  const productosBuscables = modelos
    .filter((m) => m.activo)
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      categoria: m.categoria,
      precioVenta: m.precio_venta,
      imagenUrl: m.imagen_url,
      existencias: existencias[m.id] ?? 0,
    }));

  function nombreModelo(id: string) {
    return modelos.find((m) => m.id === id)?.nombre ?? "—";
  }

  function codigoTalla(id: string) {
    return tallas.find((t) => t.id === id)?.codigo ?? "—";
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!bloqueado && !items.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    startTransition(async () => {
      const res = await actualizarOrdenProduccion(loteId, {
        fechaFinEstimada,
        ubicacionDestinoId: ubicacionDestinoId || null,
        items,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Orden actualizada");
      router.push(`/produccion/${loteId}`);
    });
  }

  return (
    <form className="space-y-6" onSubmit={enviar}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Folio</Label>
          <Input value={folio} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaFinEstimada">Fecha estimada de fin</Label>
          <Input
            id="fechaFinEstimada"
            type="date"
            value={fechaFinEstimada}
            onChange={(e) => setFechaFinEstimada(e.target.value)}
          />
        </div>
      </div>

      <div className="max-w-sm space-y-2">
        <Label>Ubicación destino de las piezas terminadas</Label>
        <Select
          items={ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))}
          value={ubicacionDestinoId}
          onValueChange={(v) => setUbicacionDestinoId(v ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={`Sin elegir (se usa ${ubicaciones[0]?.nombre ?? "la predeterminada"})`} />
          </SelectTrigger>
          <SelectContent>
            {ubicaciones.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Las piezas que ya entraron al inventario conservan la ubicación donde entraron; el cambio aplica a las que
          se terminen de ahora en adelante.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Productos</Label>
        </div>
        {!bloqueado && <BuscadorProductos productos={productosBuscables} onSeleccionar={agregarProducto} />}
        {bloqueado && (
          <p className="text-xs text-muted-foreground">
            Esta orden ya tiene procesos configurados, así que los productos no se pueden modificar. Si necesitas
            cambiarlos, cancela esta orden y crea una nueva.
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Cantidad</TableHead>
              {!bloqueado && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bloqueado
              ? items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{nombreModelo(item.modeloId)}</TableCell>
                    <TableCell>{codigoTalla(item.tallaId)}</TableCell>
                    <TableCell>{item.cantidadPlaneada}</TableCell>
                  </TableRow>
                ))
              : items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{nombreModelo(item.modeloId)}</TableCell>
                    <TableCell>
                      <Select
                        items={tallasDeModelo(item.modeloId).map((t) => ({ value: t.id, label: t.codigo }))}
                        value={item.tallaId}
                        onValueChange={(v) => actualizarItem(index, { tallaId: v ?? "" })}
                        disabled={!item.modeloId}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Talla" />
                        </SelectTrigger>
                        <SelectContent>
                          {tallasDeModelo(item.modeloId).map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.codigo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={item.cantidadPlaneada}
                        onChange={(e) => actualizarItem(index, { cantidadPlaneada: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" onClick={() => quitarItem(index)}>
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
