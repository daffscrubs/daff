"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import {
  asignarUnidadAOrden,
  buscarUnidadPorCodigo,
  eliminarUnidadDeOrden,
  registrarConsumoRealUnidad,
} from "@/actions/unidadesMaterial.actions";
import { EscanerQRDialog } from "@/components/ui/escaner-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database, EstatusUnidadMaterial } from "@/types/database.types";

type ConsumoUnidad = Database["public"]["Tables"]["consumo_unidad_orden"]["Row"] & {
  unidades_material: {
    codigo: string;
    materiales: { nombre: string; unidad_medida: string } | null;
  } | null;
};

// Subconjunto de lo que devuelve buscarUnidadPorCodigo — solo lo que esta
// pantalla necesita mostrar antes de confirmar la asignación.
type UnidadEncontrada = {
  id: string;
  codigo: string;
  cantidad_actual: number;
  estatus: EstatusUnidadMaterial;
  materiales: { nombre: string; unidad_medida: string } | null;
};

function FilaUnidadConsumo({
  consumo,
  loteId,
  onQuitar,
  bloqueado,
}: {
  consumo: ConsumoUnidad;
  loteId: string;
  onQuitar: () => void;
  bloqueado: boolean;
}) {
  const valorGuardado = String(consumo.cantidad_real ?? 0);
  const [real, setReal] = useState(valorGuardado);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const registrado = !!consumo.cantidad_real_registrada_en;
  const unidadMedida = consumo.unidades_material?.materiales?.unidad_medida ?? "";

  function guardar() {
    startTransition(async () => {
      const res = await registrarConsumoRealUnidad(consumo.id, loteId, Number(real) || 0);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Consumo real guardado");
      router.refresh();
    });
  }

  if (registrado) {
    return (
      <TableRow>
        <TableCell>{consumo.unidades_material?.materiales?.nombre ?? "—"}</TableCell>
        <TableCell className="font-mono text-xs">{consumo.unidades_material?.codigo ?? "—"}</TableCell>
        <TableCell>
          {consumo.cantidad_estimada ?? "—"} {unidadMedida}
        </TableCell>
        <TableCell>
          {consumo.cantidad_real} {unidadMedida}
        </TableCell>
        <TableCell className="text-right">
          <Badge variant="secondary">Registrado</Badge>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{consumo.unidades_material?.materiales?.nombre ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">{consumo.unidades_material?.codigo ?? "—"}</TableCell>
      <TableCell>
        {consumo.cantidad_estimada ?? "—"} {unidadMedida}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            className="w-24"
            value={real}
            onChange={(e) => setReal(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pendiente || bloqueado || real === valorGuardado}
            onClick={guardar}
          >
            Guardar
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" disabled={pendiente || bloqueado} onClick={onQuitar}>
          Quitar
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Equivalente a InsumosOrden pero para materiales con seguimiento_por_unidad:
// en vez de capturar una cantidad estimada agregada por material, aquí se
// escanea/busca el código de un rollo/bolsa específico y se le asigna una
// cantidad estimada a esta orden. El trigger de la migración 0023 mantiene
// consumo_material_orden (lo que ya leen reportes/PDF/cronología) sincronizado
// con la suma de estas filas, así que esos consumidores no necesitan cambios.
export function UnidadesOrden({ loteId, consumos }: { loteId: string; consumos: ConsumoUnidad[] }) {
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [unidadEncontrada, setUnidadEncontrada] = useState<UnidadEncontrada | null>(null);
  const [cantidadEstimada, setCantidadEstimada] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  function buscar(codigo: string) {
    startTransition(async () => {
      const res = await buscarUnidadPorCodigo(codigo);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEscanerAbierto(false);
      setUnidadEncontrada(res.data);
      setCantidadEstimada(String(res.data.cantidad_actual));
    });
  }

  function asignar() {
    if (!unidadEncontrada) return;
    startTransition(async () => {
      const res = await asignarUnidadAOrden({
        loteId,
        unidadId: unidadEncontrada.id,
        cantidadEstimada: Number(cantidadEstimada) || 0,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Unidad asignada");
      setUnidadEncontrada(null);
      setCantidadEstimada("");
      router.refresh();
    });
  }

  function quitar(id: string) {
    startTransition(async () => {
      const res = await eliminarUnidadDeOrden(id, loteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Unidad quitada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {unidadEncontrada ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <p className="text-sm font-medium">{unidadEncontrada.materiales?.nombre ?? "—"}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {unidadEncontrada.codigo} · {unidadEncontrada.cantidad_actual}{" "}
              {unidadEncontrada.materiales?.unidad_medida} disponibles
            </p>
          </div>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Cantidad estimada"
            className="sm:w-40"
            value={cantidadEstimada}
            onChange={(e) => setCantidadEstimada(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={pendiente} onClick={asignar}>
              Asignar
            </Button>
            <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => setUnidadEncontrada(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setEscanerAbierto(true)} disabled={pendiente}>
          <QrCode className="size-4" />
          Escanear/buscar unidad
        </Button>
      )}

      <EscanerQRDialog
        abierto={escanerAbierto}
        onOpenChange={setEscanerAbierto}
        onDetectado={buscar}
        titulo="Escanear unidad de materia prima"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Estimado</TableHead>
            <TableHead>Real</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {consumos.map((c) => (
            <FilaUnidadConsumo key={c.id} consumo={c} loteId={loteId} bloqueado={pendiente} onQuitar={() => quitar(c.id)} />
          ))}
          {!consumos.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin unidades asignadas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
