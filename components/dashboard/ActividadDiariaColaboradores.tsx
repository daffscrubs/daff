"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RegistroReporte } from "@/components/produccion/ReporteProductividadTable";
import { fechaISOLocal } from "@/lib/fechas";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ActividadDiariaColaboradores({
  registros,
  colaboradores,
}: {
  registros: RegistroReporte[];
  colaboradores: { id: string; nombre: string }[];
}) {
  const hoy = fechaISOLocal(new Date());
  const [fecha, setFecha] = useState(hoy);
  const [colaboradorId, setColaboradorId] = useState("todos");

  const opcionesColaborador = useMemo(
    () => [{ value: "todos", label: "Todos" }, ...colaboradores.map((c) => ({ value: c.id, label: c.nombre }))],
    [colaboradores]
  );

  const filtrados = useMemo(
    () =>
      registros
        .filter((r) => r.fecha === fecha)
        .filter((r) => colaboradorId === "todos" || r.colaboradorId === colaboradorId),
    [registros, fecha, colaboradorId]
  );

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <ClipboardList className="size-4 text-muted-foreground" />
        Actividad diaria de colaboradores
      </h2>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="fechaActividad">Fecha</Label>
            <Input id="fechaActividad" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>Colaborador</Label>
            <Select
              items={opcionesColaborador}
              value={colaboradorId}
              onValueChange={(v) => setColaboradorId((v as string) ?? "todos")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcionesColaborador.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 divide-y">
          {filtrados.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                {iniciales(r.colaborador)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">{r.colaborador}</span>{" "}
                  {r.origen === "ajuste_supervisor" ? "ajustó" : "registró"}{" "}
                  <span className={r.cantidad < 0 ? "text-destructive" : "font-medium"}>
                    {r.cantidad > 0 ? "+" : ""}
                    {r.cantidad}
                  </span>{" "}
                  en <span className="font-medium">{r.etapa}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.producto} · {r.folioOrden}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {new Date(r.created_at).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
              </Badge>
            </div>
          ))}
          {!filtrados.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin registros para este filtro.</p>
          )}
        </div>
      </div>
    </div>
  );
}
