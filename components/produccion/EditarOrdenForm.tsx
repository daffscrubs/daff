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
import { CamposTipoProduccion, type MaquileroOpcion } from "@/components/produccion/CamposTipoProduccion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/types/database.types";
import type { ItemOrdenInput, TipoProduccion } from "@/lib/validaciones/produccion.schema";

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
  tieneEntregas,
  entregadoPorItem,
  tipoInicial,
  maquileroInicial,
  preciosIniciales,
  maquileros,
  puedeVerPrecios,
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
  /** La orden ya tiene entregas vigentes: el tipo y el maquilero no se pueden cambiar. */
  tieneEntregas: boolean;
  /** Piezas ya entregadas por "modelo|talla": la cantidad no puede bajar de ahí ni se puede quitar el renglón. */
  entregadoPorItem: Record<string, number>;
  tipoInicial: TipoProduccion;
  maquileroInicial: string;
  preciosIniciales: Record<string, string>;
  maquileros: MaquileroOpcion[];
  puedeVerPrecios: boolean;
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
  const [tipo, setTipo] = useState<TipoProduccion>(tipoInicial);
  const [maquileroId, setMaquileroId] = useState(maquileroInicial);
  const [precios, setPrecios] = useState<Record<string, string>>(preciosIniciales);
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

  const entregado = (item: ItemOrdenInput) => entregadoPorItem[`${item.modeloId}|${item.tallaId}`] ?? 0;
  const modelosOrden = [...new Set(items.map((i) => i.modeloId))].map((id) => ({ id, nombre: nombreModelo(id) }));

  function codigoTalla(id: string) {
    return tallas.find((t) => t.id === id)?.codigo ?? "—";
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    if (tipo === "maquila" && !maquileroId) {
      toast.error("Elige el maquilero de esta orden");
      return;
    }
    const bajo = items.find((i) => i.cantidadPlaneada < entregado(i));
    if (bajo) {
      toast.error(`${nombreModelo(bajo.modeloId)} talla ${codigoTalla(bajo.tallaId)}: ya se entregaron ${entregado(bajo)} pieza(s), la cantidad no puede ser menor.`);
      return;
    }
    const preciosCapturados =
      tipo === "maquila" && puedeVerPrecios
        ? modelosOrden.filter((m) => (precios[m.id] ?? "").trim() !== "").map((m) => ({ modeloId: m.id, precioPorPieza: Number((precios[m.id] ?? "").replace(/[$,\s]/g, "")) }))
        : undefined;
    if (preciosCapturados?.some((p) => !Number.isFinite(p.precioPorPieza) || p.precioPorPieza < 0)) {
      toast.error("Revisa los precios por pieza: deben ser números mayores o iguales a cero");
      return;
    }
    startTransition(async () => {
      const res = await actualizarOrdenProduccion(loteId, {
        fechaFinEstimada,
        ubicacionDestinoId: ubicacionDestinoId || null,
        items,
        tipoProduccion: tipo,
        maquileroId: tipo === "maquila" ? maquileroId : null,
        precios: preciosCapturados,
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
          Las piezas que ya entraron al inventario conservan la ubicación donde entraron; el cambio aplica a las
          entregas que registres de ahora en adelante.
        </p>
      </div>

      <CamposTipoProduccion
        tipo={tipo}
        onTipo={setTipo}
        maquileroId={maquileroId}
        onMaquilero={setMaquileroId}
        maquileros={maquileros}
        modelosOrden={modelosOrden}
        precios={precios}
        onPrecio={(modeloId, valor) => setPrecios((prev) => ({ ...prev, [modeloId]: valor }))}
        puedeVerPrecios={puedeVerPrecios}
        bloqueado={tieneEntregas}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Productos</Label>
        </div>
        <BuscadorProductos productos={productosBuscables} onSeleccionar={agregarProducto} />
        <p className="text-xs text-muted-foreground">
          Si el maquilero o el taller entregó de más, aumenta aquí la cantidad y luego registra la entrega. La cantidad no puede ser menor a lo ya entregado.
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Ya entregado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const hecho = entregado(item);
              return (
                <TableRow key={index}>
                  <TableCell className="font-medium">{nombreModelo(item.modeloId)}</TableCell>
                  <TableCell>
                    {hecho > 0 ? (
                      codigoTalla(item.tallaId)
                    ) : (
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
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={Math.max(1, hecho)}
                      className="w-20"
                      value={item.cantidadPlaneada}
                      onChange={(e) => actualizarItem(index, { cantidadPlaneada: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{hecho || "—"}</TableCell>
                  <TableCell>
                    {hecho > 0 ? (
                      <span className="text-xs text-muted-foreground">Ya tiene entregas</span>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" onClick={() => quitarItem(index)}>
                        Quitar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
