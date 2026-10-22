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
import type { InsumoOrdenInput, ItemOrdenInput } from "@/lib/validaciones/produccion.schema";

type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];
type ItemPedido = Database["public"]["Tables"]["items_pedido"]["Row"];
type Modelo = Database["public"]["Tables"]["modelos"]["Row"];
type Talla = Database["public"]["Tables"]["tallas"]["Row"];
type ModeloTalla = Database["public"]["Tables"]["modelo_tallas"]["Row"];
type Material = Database["public"]["Tables"]["materiales"]["Row"];
type Ubicacion = Database["public"]["Tables"]["ubicaciones"]["Row"];

export function FormLote({
  folioSugerido,
  pedidos,
  itemsPedido,
  modelos,
  tallas,
  modeloTallas,
  materiales,
  existencias,
  ubicaciones,
}: {
  folioSugerido: string;
  pedidos: Pedido[];
  itemsPedido: ItemPedido[];
  modelos: Modelo[];
  tallas: Talla[];
  modeloTallas: ModeloTalla[];
  materiales: Material[];
  /** Piezas en inventario por modelo (suma de todas sus tallas). */
  existencias: Record<string, number>;
  ubicaciones: Ubicacion[];
}) {
  const [folio, setFolio] = useState(folioSugerido);
  const [pedidoId, setPedidoId] = useState("");
  const [fechaFinEstimada, setFechaFinEstimada] = useState("");
  const [ubicacionDestinoId, setUbicacionDestinoId] = useState("");
  const [items, setItems] = useState<ItemOrdenInput[]>([]);
  const [insumos, setInsumos] = useState<InsumoOrdenInput[]>([]);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const itemsDelPedido = itemsPedido.filter((i) => i.pedido_id === pedidoId);

  const productosBuscables = modelos.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    categoria: m.categoria,
    precioVenta: m.precio_venta,
    imagenUrl: m.imagen_url,
    existencias: existencias[m.id] ?? 0,
  }));
  const nombreModelo = (id: string) => modelos.find((m) => m.id === id)?.nombre ?? "—";

  function tallasDeModelo(modeloId: string) {
    const asignadas = modeloTallas.filter((mt) => mt.modelo_id === modeloId).map((mt) => mt.talla_id);
    if (!asignadas.length) return tallas;
    return tallas.filter((t) => asignadas.includes(t.id));
  }

  // Elegir un producto en el buscador agrega una línea con ese modelo ya
  // puesto; solo falta la talla y la cantidad. Se puede elegir el mismo
  // modelo varias veces para pedir varias tallas.
  function agregarProducto(modeloId: string) {
    setItems((prev) => [...prev, { modeloId, tallaId: "", cantidadPlaneada: 1 }]);
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
        cantidadPlaneada: ip.cantidad,
      }))
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    if (!ubicacionDestinoId) {
      toast.error("Elige dónde entrarán las piezas terminadas");
      return;
    }
    const insumosValidos = insumos.filter((i) => i.materialId);
    startTransition(async () => {
      const res = await crearOrdenProduccion({
        folio,
        pedidoId: pedidoId || null,
        fechaFinEstimada: fechaFinEstimada || undefined,
        ubicacionDestinoId,
        items,
        insumos: insumosValidos,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Orden de producción creada");
      router.push(`/produccion/${res.data}/etapas`);
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

      <div className="max-w-sm space-y-2">
        <Label>Ubicación destino de las piezas terminadas</Label>
        <Select
          items={ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))}
          value={ubicacionDestinoId}
          onValueChange={(v) => setUbicacionDestinoId(v ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Elige dónde entrarán al inventario" />
          </SelectTrigger>
          <SelectContent>
            {ubicaciones.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Cuando se complete el último proceso de cada producto, sus piezas entran al inventario de esta ubicación.
        </p>
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
          </div>
        </div>

        <BuscadorProductos productos={productosBuscables} onSeleccionar={agregarProducto} />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
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
            {!items.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Busca arriba un producto y haz clic para agregarlo (ej. 10 filipinas chicas y 10 medianas).
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
