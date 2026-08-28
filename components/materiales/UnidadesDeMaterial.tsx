"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Plus } from "lucide-react";
import { crearUnidadIndividual, eliminarUnidadMaterial } from "@/actions/unidadesMaterial.actions";
import { BotonEliminarConfirmacion } from "@/components/forms/BotonEliminarConfirmacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { EstatusUnidadMaterial } from "@/types/database.types";
import { fechaISOLocal } from "@/lib/fechas";

type UnidadMaterial = Database["public"]["Tables"]["unidades_material"]["Row"];

const ESTATUS_LABEL: Record<EstatusUnidadMaterial, string> = {
  disponible: "Disponible",
  agotado: "Agotado",
  de_baja: "De baja",
};

const ESTATUS_VARIANTE: Record<EstatusUnidadMaterial, "default" | "secondary" | "destructive"> = {
  disponible: "default",
  agotado: "secondary",
  de_baja: "destructive",
};

// Para inventario inicial: rollos/bolsas que ya existen físicamente en la
// bodega sin una compra formal que los respalde en el sistema (compra_item_id
// queda null). crearUnidadIndividual ya soportaba esto, solo faltaba el
// diálogo que lo llamara.
//
// "Cantidad por unidad" vs "cuántas unidades": si Alejandro tiene 20 rollos
// físicos de 25m cada uno, antes había que repetir el formulario 20 veces (y
// si en vez de eso ponía "20" como cantidad, se creaba UN solo rollo de 20m
// con un solo QR — justo la confusión que reportó). cantidadDeUnidades crea
// N unidades idénticas de un jalón, cada una con su propio número y código.
function AgregarUnidadExistenteDialog({
  materialId,
  costoUnitarioMaterial,
}: {
  materialId: string;
  costoUnitarioMaterial: number | null;
}) {
  const costoPorDefecto = costoUnitarioMaterial != null ? String(costoUnitarioMaterial) : "";
  const [abierto, setAbierto] = useState(false);
  const [cantidadInicial, setCantidadInicial] = useState("");
  const [cantidadDeUnidades, setCantidadDeUnidades] = useState("1");
  const [costoUnitario, setCostoUnitario] = useState(costoPorDefecto);
  const [proveedor, setProveedor] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState(() => fechaISOLocal(new Date()));
  const [creadas, setCreadas] = useState<string[] | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function reiniciar() {
    setCantidadInicial("");
    setCantidadDeUnidades("1");
    setCostoUnitario(costoPorDefecto);
    setProveedor("");
    setFechaRecepcion(fechaISOLocal(new Date()));
    setCreadas(null);
  }

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearUnidadIndividual({
        materialId,
        cantidadInicial: Number(cantidadInicial),
        cantidadDeUnidades: Number(cantidadDeUnidades) || 1,
        costoUnitario: costoUnitario ? Number(costoUnitario) : undefined,
        proveedor: proveedor || undefined,
        fechaRecepcion: fechaRecepcion || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.ids.length > 1 ? `${res.data.ids.length} unidades creadas` : "Unidad creada");
      setCreadas(res.data.ids);
      router.refresh();
    });
  }

  function alCambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) reiniciar();
  }

  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-4" />
        Agregar unidad existente
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar unidad existente</DialogTitle>
        </DialogHeader>
        {creadas ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {creadas.length > 1
                ? `${creadas.length} unidades creadas correctamente.`
                : "Unidad creada correctamente."}{" "}
              Imprime {creadas.length > 1 ? "sus etiquetas" : "su etiqueta"} con QR para pegar en cada
              rollo/bolsa.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                render={
                  <a
                    href={`/api/pdf/unidades-material?ids=${creadas.join(",")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <Download className="size-4" />
                {creadas.length > 1 ? "Descargar etiquetas" : "Descargar etiqueta"}
              </Button>
              <Button variant="outline" onClick={() => alCambiarAbierto(false)}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={crear}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cantidadInicialUnidad">Cantidad por unidad</Label>
                <Input
                  id="cantidadInicialUnidad"
                  type="number"
                  min={0.01}
                  step="0.01"
                  placeholder="Ej. 25 (lo que tiene CADA rollo)"
                  value={cantidadInicial}
                  onChange={(e) => setCantidadInicial(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cantidadDeUnidades">Cuántas unidades iguales</Label>
                <Input
                  id="cantidadDeUnidades"
                  type="number"
                  min={1}
                  step="1"
                  value={cantidadDeUnidades}
                  onChange={(e) => setCantidadDeUnidades(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Si tienes varios rollos/bolsas con exactamente la misma cantidad (ej. 20 rollos de 25m cada
              uno), créalos todos aquí de una vez — cada uno sale con su propio código y QR. Si solo quieres
              contar rollos completos sin medir cuánto tiene cada uno por dentro, pon 1 en &ldquo;Cantidad
              por unidad&rdquo; y el número de rollos en &ldquo;Cuántas unidades iguales&rdquo;.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costoUnitarioUnidad">Costo unitario (opcional)</Label>
                <Input
                  id="costoUnitarioUnidad"
                  type="number"
                  min={0}
                  step="0.01"
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaRecepcionUnidad">Fecha de recepción</Label>
                <Input
                  id="fechaRecepcionUnidad"
                  type="date"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proveedorUnidad">Proveedor (opcional)</Label>
              <Input id="proveedorUnidad" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={pendiente}>
              {pendiente ? "Guardando..." : "Crear unidad(es)"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Resuelve "qué rollo/bolsa me está faltando": una fila por unidad física
// (cada una con su propio código QR), con cuánto le queda y su estatus.
export function UnidadesDeMaterial({
  materialId,
  costoUnitarioMaterial,
  unidades,
  unidadMedida,
}: {
  materialId: string;
  costoUnitarioMaterial: number | null;
  unidades: UnidadMaterial[];
  unidadMedida: string;
}) {
  const idsDisponibles = unidades.filter((u) => u.estatus !== "de_baja").map((u) => u.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Unidades (rollos/bolsas)</h2>
        <div className="flex flex-wrap gap-2">
          <AgregarUnidadExistenteDialog materialId={materialId} costoUnitarioMaterial={costoUnitarioMaterial} />
          {!!idsDisponibles.length && (
            <Button
              variant="outline"
              size="sm"
              render={<a href={`/api/pdf/unidades-material?ids=${idsDisponibles.join(",")}`} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <Download className="size-4" />
              Reimprimir todas las etiquetas
            </Button>
          )}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Restante</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Recepción</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {unidades.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-mono text-xs">{u.codigo}</TableCell>
              <TableCell>
                {u.cantidad_actual} / {u.cantidad_inicial} {unidadMedida}
              </TableCell>
              <TableCell>
                <Badge variant={ESTATUS_VARIANTE[u.estatus]}>{ESTATUS_LABEL[u.estatus]}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{u.fecha_recepcion}</TableCell>
              <TableCell className="text-muted-foreground">{u.proveedor ?? "—"}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={`/api/pdf/unidades-material?ids=${u.id}`} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  Etiqueta
                </Button>
                <BotonEliminarConfirmacion entidad="unidad" onEliminar={() => eliminarUnidadMaterial(u.id)} />
              </TableCell>
            </TableRow>
          ))}
          {!unidades.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin unidades registradas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
