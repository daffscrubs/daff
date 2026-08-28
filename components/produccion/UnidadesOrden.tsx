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
    cantidad_actual: number;
    materiales: { nombre: string; unidad_medida: string; mide_cantidad_por_unidad: boolean } | null;
  } | null;
};

// Subconjunto de lo que devuelve buscarUnidadPorCodigo — solo lo que esta
// pantalla necesita mostrar antes de confirmar la asignación.
type UnidadEncontrada = {
  id: string;
  codigo: string;
  cantidad_actual: number;
  estatus: EstatusUnidadMaterial;
  materiales: { nombre: string; unidad_medida: string; mide_cantidad_por_unidad: boolean } | null;
};

function FilaUnidadConsumo({
  consumo,
  loteId,
  onQuitar,
  bloqueado,
  columnasCantidad,
}: {
  consumo: ConsumoUnidad;
  loteId: string;
  onQuitar: () => void;
  bloqueado: boolean;
  /** Si la tabla completa muestra las columnas Estimado/Real (porque algún
   * otro material de la lista sí mide cantidad) aunque esta fila no las use
   * -- para no desalinear las columnas del resto de la tabla. */
  columnasCantidad: boolean;
}) {
  const valorGuardado = String(consumo.cantidad_real ?? 0);
  const [real, setReal] = useState(valorGuardado);
  const [mostrarSobrante, setMostrarSobrante] = useState(false);
  const [sobrante, setSobrante] = useState("");
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();
  const registrado = !!consumo.cantidad_real_registrada_en;
  const unidadMedida = consumo.unidades_material?.materiales?.unidad_medida ?? "";
  const mideCantidad = consumo.unidades_material?.materiales?.mide_cantidad_por_unidad ?? true;
  const totalAsignado = consumo.cantidad_estimada ?? consumo.unidades_material?.cantidad_actual ?? 1;

  function guardar(cantidad: number) {
    startTransition(async () => {
      const res = await registrarConsumoRealUnidad(consumo.id, loteId, cantidad);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Consumo real guardado");
      router.refresh();
    });
  }

  if (registrado) {
    const sobro = !mideCantidad ? Math.max(0, totalAsignado - (consumo.cantidad_real ?? 0)) : 0;
    return (
      <TableRow>
        <TableCell>{consumo.unidades_material?.materiales?.nombre ?? "—"}</TableCell>
        <TableCell className="font-mono text-xs">{consumo.unidades_material?.codigo ?? "—"}</TableCell>
        {columnasCantidad &&
          (mideCantidad ? (
            <>
              <TableCell>
                {consumo.cantidad_estimada ?? "—"} {unidadMedida}
              </TableCell>
              <TableCell>
                {consumo.cantidad_real} {unidadMedida}
              </TableCell>
            </>
          ) : (
            <TableCell colSpan={2} />
          ))}
        <TableCell className="text-right">
          <div className="flex flex-col items-end gap-0.5">
            <Badge variant="secondary">{mideCantidad ? "Registrado" : "Usado"}</Badge>
            {sobro > 0 && <span className="text-xs text-muted-foreground">Sobró {sobro}</span>}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // El material no mide cantidad dentro de cada unidad: por default se
  // asume que el rollo se usó completo (un solo clic), pero si sobró algo
  // se puede registrar cuánto -- sigue siendo el mismo cantidad_real de
  // siempre, solo que aquí se captura como "cuánto sobró" en vez de "cuánto
  // se usó", que es como lo piensa quien corta la tela.
  if (!mideCantidad) {
    return (
      <TableRow>
        <TableCell>{consumo.unidades_material?.materiales?.nombre ?? "—"}</TableCell>
        <TableCell className="font-mono text-xs">{consumo.unidades_material?.codigo ?? "—"}</TableCell>
        <TableCell colSpan={columnasCantidad ? 2 : 1}>
          {mostrarSobrante ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-24"
                placeholder="¿Cuánto sobró?"
                value={sobrante}
                onChange={(e) => setSobrante(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pendiente || bloqueado}
                onClick={() => guardar(Math.max(0, totalAsignado - (Number(sobrante) || 0)))}
              >
                Guardar
              </Button>
              <Button size="sm" variant="ghost" disabled={pendiente || bloqueado} onClick={() => setMostrarSobrante(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" disabled={pendiente || bloqueado} onClick={() => guardar(totalAsignado)}>
                Usar completo
              </Button>
              <Button size="sm" variant="ghost" disabled={pendiente || bloqueado} onClick={() => setMostrarSobrante(true)}>
                ¿Quedó sobrante?
              </Button>
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" disabled={pendiente || bloqueado} onClick={onQuitar}>
            Quitar
          </Button>
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
            onClick={() => guardar(Number(real) || 0)}
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
  // Si algún material asignado mide cantidad, la tabla necesita las columnas
  // Estimado/Real; si ninguno mide, se simplifica a Material+Código+acción.
  const algunoMideCantidad = consumos.some((c) => c.unidades_material?.materiales?.mide_cantidad_por_unidad);

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

  function asignar(cantidad: number) {
    if (!unidadEncontrada) return;
    startTransition(async () => {
      const res = await asignarUnidadAOrden({
        loteId,
        unidadId: unidadEncontrada.id,
        cantidadEstimada: cantidad,
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

  const mideCantidadEncontrada = unidadEncontrada?.materiales?.mide_cantidad_por_unidad ?? true;

  return (
    <div className="space-y-4">
      {unidadEncontrada ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <p className="text-sm font-medium">{unidadEncontrada.materiales?.nombre ?? "—"}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {unidadEncontrada.codigo}
              {mideCantidadEncontrada &&
                ` · ${unidadEncontrada.cantidad_actual} ${unidadEncontrada.materiales?.unidad_medida ?? ""} disponibles`}
            </p>
          </div>
          {mideCantidadEncontrada && (
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Cantidad estimada"
              className="sm:w-40"
              value={cantidadEstimada}
              onChange={(e) => setCantidadEstimada(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pendiente}
              onClick={() => asignar(mideCantidadEncontrada ? Number(cantidadEstimada) || 0 : unidadEncontrada.cantidad_actual)}
            >
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
            {algunoMideCantidad && (
              <>
                <TableHead>Estimado</TableHead>
                <TableHead>Real</TableHead>
              </>
            )}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {consumos.map((c) => (
            <FilaUnidadConsumo
              key={c.id}
              consumo={c}
              loteId={loteId}
              bloqueado={pendiente}
              columnasCantidad={algunoMideCantidad}
              onQuitar={() => quitar(c.id)}
            />
          ))}
          {!consumos.length && (
            <TableRow>
              <TableCell colSpan={algunoMideCantidad ? 5 : 3} className="text-center text-muted-foreground">
                Sin unidades asignadas todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
