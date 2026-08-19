"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface RegistroReporte {
  id: string;
  fecha: string;
  created_at: string;
  cantidad: number;
  origen: string;
  observaciones: string | null;
  foto_url: string | null;
  colaboradorId: string;
  colaborador: string;
  etapa: string;
  producto: string;
  folioOrden: string;
}

export function ReporteProductividadTable({ registros }: { registros: RegistroReporte[] }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const primerDiaMes = hoy.slice(0, 8) + "01";
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);
  const [seleccionado, setSeleccionado] = useState<RegistroReporte | null>(null);

  const filtrados = useMemo(
    () => registros.filter((r) => r.fecha >= desde && r.fecha <= hasta),
    [registros, desde, hasta]
  );

  const resumen = useMemo(() => {
    const mapa = new Map<string, { colaborador: string; etapa: string; total: number }>();
    for (const r of filtrados) {
      const clave = `${r.colaborador}::${r.etapa}`;
      const actual = mapa.get(clave) ?? { colaborador: r.colaborador, etapa: r.etapa, total: 0 };
      actual.total += r.cantidad;
      mapa.set(clave, actual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [filtrados]);

  function limpiarFiltro() {
    setDesde("2000-01-01");
    setHasta(hoy);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="desdeReporte">Desde</Label>
          <Input id="desdeReporte" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hastaReporte">Hasta</Label>
          <Input id="hastaReporte" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={limpiarFiltro}>
          Ver todo
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Productividad por colaborador</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Proceso</TableHead>
              <TableHead>Total piezas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumen.map((fila) => (
              <TableRow key={`${fila.colaborador}-${fila.etapa}`}>
                <TableCell>{fila.colaborador}</TableCell>
                <TableCell>{fila.etapa}</TableCell>
                <TableCell>{fila.total}</TableCell>
              </TableRow>
            ))}
            {!resumen.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin registros de avance en este periodo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Detalle diario</h2>
        <p className="mb-2 text-sm text-muted-foreground">Haz clic en un registro para ver el detalle completo.</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Proceso</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.slice(0, 200).map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSeleccionado(r)}>
                <TableCell className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                </TableCell>
                <TableCell>{r.colaborador}</TableCell>
                <TableCell>{r.producto}</TableCell>
                <TableCell>{r.etapa}</TableCell>
                <TableCell className={r.cantidad < 0 ? "text-destructive" : ""}>{r.cantidad}</TableCell>
                <TableCell>{r.origen === "ajuste_supervisor" ? "Ajuste" : "Colaborador"}</TableCell>
              </TableRow>
            ))}
            {!filtrados.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sin registros de avance en este periodo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!seleccionado} onOpenChange={(open) => !open && setSeleccionado(null)}>
        <DialogContent>
          {seleccionado && (
            <>
              <DialogHeader>
                <DialogTitle>{seleccionado.producto}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Colaborador</p>
                    <p>{seleccionado.colaborador}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Proceso</p>
                    <p>{seleccionado.etapa}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cantidad</p>
                    <p className={seleccionado.cantidad < 0 ? "text-destructive" : ""}>{seleccionado.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Origen</p>
                    <p>{seleccionado.origen === "ajuste_supervisor" ? "Ajuste de supervisor" : "Captura de colaborador"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Orden de producción</p>
                    <p>{seleccionado.folioOrden}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fecha y hora exacta del registro</p>
                    <p>{new Date(seleccionado.created_at).toLocaleString("es-MX", { dateStyle: "full", timeStyle: "medium" })}</p>
                  </div>
                </div>
                {seleccionado.observaciones && (
                  <div>
                    <p className="text-muted-foreground">Observaciones</p>
                    <p>{seleccionado.observaciones}</p>
                  </div>
                )}
                {seleccionado.foto_url && (
                  <div>
                    <p className="mb-1 text-muted-foreground">Evidencia</p>
                    <Badge variant="secondary">Foto adjunta</Badge>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
