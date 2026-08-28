"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearMaterial } from "@/actions/materiales.actions";
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

export function NuevoMaterialDialog() {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidadMedida, setUnidadMedida] = useState("");
  const [stockMinimo, setStockMinimo] = useState("0");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [seguimientoPorUnidad, setSeguimientoPorUnidad] = useState(false);
  const [medirCantidadPorUnidad, setMedirCantidadPorUnidad] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function crear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearMaterial({
        nombre,
        categoria,
        unidadMedida,
        stockMinimo: Number(stockMinimo || 0),
        costoUnitario: costoUnitario ? Number(costoUnitario) : undefined,
        seguimientoPorUnidad,
        medirCantidadPorUnidad,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Material creado");
      setNombre("");
      setCategoria("");
      setUnidadMedida("");
      setStockMinimo("0");
      setCostoUnitario("");
      setSeguimientoPorUnidad(false);
      setMedirCantidadPorUnidad(false);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button />}>Nuevo material</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo material</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={crear}>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Tela antifluido azul" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoría</Label>
            <Input id="categoria" placeholder="Tela, hilo, accesorio..." value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unidadMedida">Unidad de medida</Label>
              <Input id="unidadMedida" placeholder="metro, pieza, kg" value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockMinimo">Stock mínimo</Label>
              <Input id="stockMinimo" type="number" min={0} value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="costoUnitario">Costo unitario (opcional)</Label>
            <Input id="costoUnitario" type="number" min={0} step="0.01" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 rounded-lg border p-2 text-sm">
            <input
              type="checkbox"
              checked={seguimientoPorUnidad}
              onChange={(e) => setSeguimientoPorUnidad(e.target.checked)}
              className="size-4"
            />
            <span>
              <Label className="cursor-pointer font-normal">Seguimiento por unidad (rollo/bolsa con QR)</Label>
              <p className="text-xs text-muted-foreground">
                Cada compra se dividirá en unidades individuales con su propio código QR.
              </p>
            </span>
          </label>
          {seguimientoPorUnidad && (
            <label className="ml-6 flex items-center gap-2 rounded-lg border p-2 text-sm">
              <input
                type="checkbox"
                checked={medirCantidadPorUnidad}
                onChange={(e) => setMedirCantidadPorUnidad(e.target.checked)}
                className="size-4"
              />
              <span>
                <Label className="cursor-pointer font-normal">Medir cantidad dentro de cada unidad</Label>
                <p className="text-xs text-muted-foreground">
                  Actívalo solo si necesitas saber cuánto le queda a cada rollo/bolsa (ej. metros de tela).
                  Si lo dejas apagado, cada unidad es 1 ítem completo — disponible o usado, sin números.
                </p>
              </span>
            </label>
          )}
          <Button type="submit" className="w-full" disabled={pendiente}>
            {pendiente ? "Creando..." : "Crear material"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
