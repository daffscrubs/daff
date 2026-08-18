"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearOrdenProduccion } from "@/actions/produccion.actions";
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
import type { InsumoOrdenInput, ItemOrdenInput } from "@/lib/validaciones/produccion.schema";

type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];
type ItemPedido = Database["public"]["Tables"]["items_pedido"]["Row"];
type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type Variante = Database["public"]["Tables"]["variantes"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];

export function FormLote({
  folioSugerido,
  pedidos,
  itemsPedido,
  modelos,
  tallas,
  variantes,
  materiales,
}: {
  folioSugerido: string;
  pedidos: Pedido[];
  itemsPedido: ItemPedido[];
  modelos: Modelo[];
  tallas: Talla[];
  variantes: Variante[];
  materiales: Material[];
}) {
  const [folio, setFolio] = useState(folioSugerido);
  const [pedidoId, setPedidoId] = useState("");
  const [fechaFinEstimada, setFechaFinEstimada] = useState("");
  const [items, setItems] = useState<ItemOrdenInput[]>([]);
  const [insumos, setInsumos] = useState<InsumoOrdenInput[]>([]);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const itemsDelPedido = itemsPedido.filter((i) => i.pedido_id === pedidoId);

  function agregarItem() {
    setItems((prev) => [...prev, { modeloId: "", tallaId: "", varianteId: null, cantidadPlaneada: 1 }]);
  }

  function actualizarItem(index: number, cambios: Partial<ItemOrdenInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...cambios } : item)));
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function agregarInsumo() {
    setInsumos((prev) => [...prev, { materialId: "", cantidadEstimada: 0 }]);
  }

  function actualizarInsumo(index: number, cambios: Partial<InsumoOrdenInput>) {
    setInsumos((prev) => prev.map((insumo, i) => (i === index ? { ...insumo, ...cambios } : insumo)));
  }

  function quitarInsumo(index: number) {
    setInsumos((prev) => prev.filter((_, i) => i !== index));
  }

  function cargarProductosDelPedido() {
    if (!itemsDelPedido.length) {
      toast.error("Ese pedido no tiene productos");
      return;
    }
    setItems(
      itemsDelPedido.map((ip) => ({
        modeloId: ip.modelo_id,
        tallaId: ip.talla_id,
        varianteId: ip.variante_id,
        cantidadPlaneada: ip.cantidad,
      }))
    );
  }

  function variantesDe(modeloId: string) {
    return variantes.filter((v) => v.modelo_id === modeloId);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    const insumosValidos = insumos.filter((i) => i.materialId);
    startTransition(async () => {
      try {
        const id = await crearOrdenProduccion({
          folio,
          pedidoId: pedidoId || null,
          fechaFinEstimada: fechaFinEstimada || undefined,
          items,
          insumos: insumosValidos,
        });
        toast.success("Orden de producción creada");
        router.push(`/produccion/${id}/etapas`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear la orden de producción");
      }
    });
  }

  return (
    <form className="space-y-6" onSubmit={enviar}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="folio">Folio</Label>
          <Input id="folio" value={folio} onChange={(e) => setFolio(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Pedido (opcional)</Label>
          <Select
            items={pedidos.map((p) => ({ value: p.id, label: p.folio }))}
            value={pedidoId}
            onValueChange={(v) => setPedidoId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sin pedido asociado" />
            </SelectTrigger>
            <SelectContent>
              {pedidos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.folio}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaFinEstimada">Fecha estimada de fin (opcional)</Label>
          <Input
            id="fechaFinEstimada"
            type="date"
            value={fechaFinEstimada}
            onChange={(e) => setFechaFinEstimada(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Productos de esta orden</Label>
          <div className="flex gap-2">
            {!!pedidoId && (
              <Button type="button" variant="outline" size="sm" onClick={cargarProductosDelPedido}>
                Cargar productos del pedido
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={agregarItem}>
              Agregar producto
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Cantidad</TableHead>
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
                    onValueChange={(v) => actualizarItem(index, { modeloId: v, varianteId: null })}
                    placeholder="Buscar modelo..."
                  />
                </TableCell>
                <TableCell>
                  <Select
                    items={tallas.map((t) => ({ value: t.id, label: t.codigo }))}
                    value={item.tallaId}
                    onValueChange={(v) => actualizarItem(index, { tallaId: v ?? "" })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Talla" />
                    </SelectTrigger>
                    <SelectContent>
                      {tallas.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.codigo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    items={variantesDe(item.modeloId).map((v) => ({
                      value: v.id,
                      label: [v.color, v.tela, v.diseno].filter(Boolean).join(" / ") || v.sku || "Variante",
                    }))}
                    value={item.varianteId ?? ""}
                    onValueChange={(v) => actualizarItem(index, { varianteId: v || null })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Sin variante" />
                    </SelectTrigger>
                    <SelectContent>
                      {variantesDe(item.modeloId).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {[v.color, v.tela, v.diseno].filter(Boolean).join(" / ") || v.sku || "Variante"}
                        </SelectItem>
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
            {!items.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Agrega al menos un producto (ej. 10 filipinas chicas y 10 medianas).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Insumos a utilizar (opcional)</Label>
          <Button type="button" variant="outline" size="sm" onClick={agregarInsumo}>
            Agregar insumo
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Cantidad estimada</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((insumo, index) => (
              <TableRow key={index}>
                <TableCell>
                  <ComboboxField
                    className="w-56"
                    items={materiales.map((m) => ({ value: m.id, label: `${m.nombre} (${m.unidad_medida})` }))}
                    value={insumo.materialId}
                    onValueChange={(v) => actualizarInsumo(index, { materialId: v })}
                    placeholder="Buscar material..."
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28"
                    value={insumo.cantidadEstimada}
                    onChange={(e) => actualizarInsumo(index, { cantidadEstimada: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => quitarInsumo(index)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!insumos.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Puedes agregar los insumos ahora o después desde el detalle de la orden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Creando..." : "Crear orden y configurar etapas"}
      </Button>
    </form>
  );
}
