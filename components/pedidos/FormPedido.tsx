"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actualizarPedido, crearPedido } from "@/actions/pedidos.actions";
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
import { ComboboxField } from "@/components/ui/combobox-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database.types";
import type { ItemPedidoInput } from "@/lib/validaciones/pedidos.schema";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type ModeloTalla = Database["public"]["Tables"]["modelo_tallas"]["Row"];
type Plantilla = Database["public"]["Tables"]["plantillas_pedido"]["Row"];
type PlantillaItem = Database["public"]["Tables"]["plantilla_items"]["Row"];

export function FormPedido({
  clientes,
  modelos,
  tallas,
  modeloTallas,
  plantillas,
  plantillaItems,
  pedidoId,
  valoresIniciales,
}: {
  clientes: Cliente[];
  modelos: Modelo[];
  tallas: Talla[];
  modeloTallas: ModeloTalla[];
  plantillas: Plantilla[];
  plantillaItems: PlantillaItem[];
  pedidoId?: string;
  valoresIniciales?: {
    clienteId: string;
    fechaCompromiso: string;
    notas: string;
    diasCredito: number;
    items: ItemPedidoInput[];
  };
}) {
  const modoEdicion = !!pedidoId;
  const [clienteId, setClienteId] = useState(valoresIniciales?.clienteId ?? "");
  const [fechaCompromiso, setFechaCompromiso] = useState(valoresIniciales?.fechaCompromiso ?? "");
  const [notas, setNotas] = useState(valoresIniciales?.notas ?? "");
  const [esCredito, setEsCredito] = useState((valoresIniciales?.diasCredito ?? 0) > 0);
  const [diasCreditoInput, setDiasCreditoInput] = useState(String(valoresIniciales?.diasCredito || 30));
  const [items, setItems] = useState<ItemPedidoInput[]>(valoresIniciales?.items ?? []);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function tallasDeModelo(modeloId: string) {
    const asignadas = modeloTallas.filter((mt) => mt.modelo_id === modeloId).map((mt) => mt.talla_id);
    if (!asignadas.length) return tallas;
    return tallas.filter((t) => asignadas.includes(t.id));
  }

  // El precio puede variar por talla (ej. una capa CH/M cuesta distinto que
  // G/XG); si no hay precio específico para esa talla, usa el precio
  // general del modelo.
  function precioDe(modeloId: string, tallaId: string): number {
    const porTalla = modeloTallas.find((mt) => mt.modelo_id === modeloId && mt.talla_id === tallaId)?.precio_venta;
    if (porTalla != null) return porTalla;
    return modelos.find((m) => m.id === modeloId)?.precio_venta ?? 0;
  }

  function agregarItem() {
    setItems((prev) => [...prev, { modeloId: "", tallaId: "", cantidad: 1, precioUnitario: 0 }]);
  }

  function actualizarItem(index: number, cambios: Partial<ItemPedidoInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...cambios } : item)));
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function cargarDesdePlantilla(plantillaId: string) {
    const itemsPlantilla = plantillaItems.filter((pi) => pi.plantilla_id === plantillaId);
    setItems(
      itemsPlantilla.map((pi) => ({
        modeloId: pi.modelo_id,
        tallaId: pi.talla_id,
        cantidad: pi.cantidad_sugerida ?? 1,
        precioUnitario: 0,
      }))
    );
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    if (plantilla?.cliente_id) setClienteId(plantilla.cliente_id);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!items.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    if (items.some((item) => !item.precioUnitario || item.precioUnitario <= 0)) {
      toast.error("Todos los productos deben tener un precio unitario");
      return;
    }
    const diasCredito = esCredito ? Number(diasCreditoInput) || 0 : 0;
    startTransition(async () => {
      try {
        if (modoEdicion) {
          await actualizarPedido(pedidoId, { clienteId, fechaCompromiso, notas, diasCredito, items });
          toast.success("Pedido actualizado");
          router.push(`/pedidos/${pedidoId}`);
        } else {
          const id = await crearPedido({ clienteId, fechaCompromiso, notas, diasCredito, items });
          toast.success("Pedido creado");
          router.push(`/pedidos/${id}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar el pedido");
      }
    });
  }

  return (
    <form className="space-y-6" onSubmit={enviar}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select
            items={clientes.map((c) => ({ value: c.id, label: c.nombre_comercial }))}
            value={clienteId}
            onValueChange={(v) => setClienteId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre_comercial}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaCompromiso">Fecha compromiso (opcional)</Label>
          <Input
            id="fechaCompromiso"
            type="date"
            value={fechaCompromiso}
            onChange={(e) => setFechaCompromiso(e.target.value)}
          />
        </div>
        {!modoEdicion && !!plantillas.length && (
          <div className="space-y-2">
            <Label>Cargar desde plantilla (opcional)</Label>
            <Select
              items={plantillas.map((p) => ({ value: p.id, label: p.nombre }))}
              defaultValue=""
              onValueChange={(v) => v && cargarDesdePlantilla(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Ninguna" />
              </SelectTrigger>
              <SelectContent>
                {plantillas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <Label>Condición de pago</Label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={!esCredito ? "default" : "ghost"}
              onClick={() => setEsCredito(false)}
            >
              Contado
            </Button>
            <Button
              type="button"
              size="sm"
              variant={esCredito ? "default" : "ghost"}
              onClick={() => setEsCredito(true)}
            >
              Crédito
            </Button>
          </div>
          {esCredito && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-20"
                value={diasCreditoInput}
                onChange={(e) => setDiasCreditoInput(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">días para cobrar</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Productos</Label>
          <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
            Agregar producto
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio unit. *</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <ComboboxField
                    className="w-40"
                    items={modelos.map((m) => ({ value: m.id, label: m.nombre }))}
                    value={item.modeloId}
                    onValueChange={(v) => actualizarItem(index, { modeloId: v, tallaId: "" })}
                    placeholder="Buscar modelo..."
                  />
                </TableCell>
                <TableCell>
                  <Select
                    items={tallasDeModelo(item.modeloId).map((t) => ({ value: t.id, label: t.codigo }))}
                    value={item.tallaId}
                    onValueChange={(v) => {
                      const tallaId = v ?? "";
                      // Solo autocompleta si el precio sigue en 0: así no se
                      // pisa un precio que la persona ya haya escrito a mano.
                      const precioAuto = !item.precioUnitario && tallaId ? precioDe(item.modeloId, tallaId) : undefined;
                      actualizarItem(index, {
                        tallaId,
                        ...(precioAuto ? { precioUnitario: precioAuto } : {}),
                      });
                    }}
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
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(index, { cantidad: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="w-24"
                    value={item.precioUnitario || ""}
                    onChange={(e) =>
                      actualizarItem(index, {
                        precioUnitario: e.target.value ? Number(e.target.value) : 0,
                      })
                    }
                    required
                  />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => quitarItem(index)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Agrega al menos un producto.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Crear pedido"}
      </Button>
    </form>
  );
}
