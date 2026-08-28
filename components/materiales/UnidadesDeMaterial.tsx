"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// Resuelve "qué rollo/bolsa me está faltando": una fila por unidad física
// (cada una con su propio código QR), con cuánto le queda y su estatus.
export function UnidadesDeMaterial({ unidades, unidadMedida }: { unidades: UnidadMaterial[]; unidadMedida: string }) {
  const idsDisponibles = unidades.filter((u) => u.estatus !== "de_baja").map((u) => u.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Unidades (rollos/bolsas)</h2>
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
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={`/api/pdf/unidades-material?ids=${u.id}`} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                >
                  Etiqueta
                </Button>
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
