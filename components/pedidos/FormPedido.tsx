"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearPedido } from "@/actions/pedidos.actions";
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
type Variante = Database["public"]["Tables"]["variantes"]["Row"];
type Plantilla = Database["public"]["Tables"]["plantillas_pedido"]["Row"];
type PlantillaItem = Database["public"]["Tables"]["plantilla_items"]["Row"];

export function FormPedido({
  clientes,
  modelos,
  tallas,
  variantes,
  plantillas,
  plantillaItems,
}: {
  clientes: Cliente[];
  modelos: Modelo[];
  tallas: Talla[];
  variantes: Variante[];
  plantillas: Plantilla[];
  plantillaItems: PlantillaItem[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemPedidoInput[]>([]);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function agregarItem() {
    setItems((prev) => [...prev, { modeloId: "", tallaId: "", varianteId: null, cantidad: 1 }]);
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
        varianteId: pi.variante_id,
        cantidad: pi.cantidad_sugerida ?? 1,
      }))
    );
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    if (plantilla?.cliente_id) setClienteId(plantilla.cliente_id);
  }

  function variantesDe(modeloId: string) {
    return variantes.filter((v) => v.modelo_id === modeloId);
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
    startTransition(async () => {
      try {
        const id = await crearPedido({ clienteId, fechaCompromiso, notas, items });
        toast.success("Pedido creado");
        router.push(`/pedidos/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear el pedido");
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
          <Label htmlFor="fechaCompromiso">Fecha compromiso</Label>
          <Input
            id="fechaCompromiso"
            type="date"
            value={fechaCompromiso}
            onChange={(e) => setFechaCompromiso(e.target.value)}
            required
          />
        </div>
        {!!plantillas.length && (
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
              <TableHead>Variante</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio unit.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Select
                    value={item.modeloId}
                    onValueChange={(v) => actualizarItem(index, { modeloId: v ?? "", varianteId: null })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={item.tallaId} onValueChange={(v) => actualizarItem(index, { tallaId: v ?? "" })}>
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
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(index, { cantidad: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24"
                    value={item.precioUnitario ?? ""}
                    onChange={(e) =>
                      actualizarItem(index, {
                        precioUnitario: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
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
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Agrega al menos un producto.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Creando..." : "Crear pedido"}
      </Button>
    </form>
  );
}
