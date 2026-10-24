"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Factory, HandCoins, PackageCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearFechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";

export interface LineaEntrega {
  entregaId: string;
  fecha: string;
  loteId: string;
  folio: string;
  tipo: "interna" | "maquila";
  /** Colaborador (interna) o maquilero (maquila) que entregó. */
  quienId: string;
  quien: string;
  recibio: string;
  producto: string;
  talla: string;
  cantidad: number;
}

export interface PresetEntregas {
  id: string;
  etiqueta: string;
  desde: string;
  hasta: string;
}

type Vista = "colaborador" | "maquilero";

export function ReporteEntregas({ desde, hasta, presets, lineas }: { desde: string; hasta: string; presets: PresetEntregas[]; lineas: LineaEntrega[] }) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("colaborador");
  const [desdeEdit, setDesdeEdit] = useState(desde);
  const [hastaEdit, setHastaEdit] = useState(hasta);
  const [elegido, setElegido] = useState<string | null>(null);

  const tipoVista = vista === "colaborador" ? "interna" : "maquila";
  const delaVista = lineas.filter((l) => l.tipo === tipoVista);
  const ir = (d: string, h: string) => router.push(`/reportes/entregas?${new URLSearchParams({ desde: d, hasta: h }).toString()}`);

  const personas = [...new Map(delaVista.map((l) => [l.quienId, l.quien])).entries()]
    .map(([id, nombre]) => {
      const suyas = delaVista.filter((l) => l.quienId === id);
      return {
        id,
        nombre,
        piezas: suyas.reduce((acc, l) => acc + l.cantidad, 0),
        entregas: new Set(suyas.map((l) => l.entregaId)).size,
        ordenes: new Set(suyas.map((l) => l.loteId)).size,
      };
    })
    .sort((a, b) => b.piezas - a.piezas);
  const totalPiezas = personas.reduce((acc, p) => acc + p.piezas, 0);
  const maximo = Math.max(...personas.map((p) => p.piezas), 1);
  const presetActivo = presets.find((p) => p.desde === desde && p.hasta === hasta)?.id;
  const detalle = (elegido ? delaVista.filter((l) => l.quienId === elegido) : delaVista).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.folio.localeCompare(b.folio));
  const hayCambios = desdeEdit !== desde || hastaEdit !== hasta;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => ir(p.desde, p.hasta)}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", presetActivo === p.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (desdeEdit && hastaEdit) ir(desdeEdit, hastaEdit);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ent-desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input id="ent-desde" type="date" value={desdeEdit} onChange={(e) => setDesdeEdit(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ent-hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input id="ent-hasta" type="date" value={hastaEdit} onChange={(e) => setHastaEdit(e.target.value)} className="h-9 w-40" />
          </div>
          <Button type="submit" disabled={!hayCambios || !desdeEdit || !hastaEdit}>
            Aplicar
          </Button>
        </form>
      </div>

      <div className="inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Vista del reporte">
        {([
          ["colaborador", "Por colaborador", Users],
          ["maquilero", "Por maquilero", HandCoins],
        ] as const).map(([valor, etiqueta, Icono]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={vista === valor}
            onClick={() => {
              setVista(valor);
              setElegido(null);
            }}
            className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", vista === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Icono className="size-4" />
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PackageCheck className="size-4" />
            Piezas entregadas
          </div>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{totalPiezas.toLocaleString("es-MX")}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Factory className="size-4" />
            Entregas registradas
          </div>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{new Set(delaVista.map((l) => l.entregaId)).size}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {vista === "colaborador" ? "Colaboradores" : "Maquileros"}
          </div>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{personas.length}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Piezas entregadas {vista === "colaborador" ? "por colaborador" : "por maquilero"}</h2>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{vista === "colaborador" ? "Colaborador" : "Maquilero"}</TableHead>
                <TableHead className="w-1/3">Piezas</TableHead>
                <TableHead className="text-right">Entregas</TableHead>
                <TableHead className="pr-4 text-right">Órdenes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas.map((p) => (
                <TableRow key={p.id} className={cn("cursor-pointer", elegido === p.id && "bg-primary/5")} onClick={() => setElegido(elegido === p.id ? null : p.id)}>
                  <TableCell className="pl-4 font-medium">{p.nombre}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max((p.piezas / maximo) * 100, 3)}%` }} />
                      </div>
                      <span className="w-14 text-right tabular-nums">{p.piezas.toLocaleString("es-MX")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.entregas}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{p.ordenes}</TableCell>
                </TableRow>
              ))}
              {!personas.length && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EstadoVacio icon={PackageCheck} titulo="Sin entregas en este periodo" descripcion="Cambia las fechas o elige otro periodo arriba." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {personas.length > 0 && (
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total</TableCell>
                  <TableCell className="tabular-nums">{totalPiezas.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right tabular-nums">{new Set(delaVista.map((l) => l.entregaId)).size}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{new Set(delaVista.map((l) => l.loteId)).size}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
        {personas.length > 0 && <p className="text-xs text-muted-foreground">Toca una fila para ver solo sus entregas abajo.</p>}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Detalle de entregas{elegido ? ` de ${personas.find((p) => p.id === elegido)?.nombre}` : ""}</h2>
          {elegido && (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setElegido(null)}>
              Ver todos
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Fecha</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>{vista === "colaborador" ? "Entregó" : "Maquilero"}</TableHead>
                <TableHead>Recibió</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Talla</TableHead>
                <TableHead className="pr-4 text-right">Piezas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalle.map((l, i) => (
                <TableRow key={`${l.entregaId}-${i}`}>
                  <TableCell className="pl-4 whitespace-nowrap">{formatearFechaCorta(l.fecha)}</TableCell>
                  <TableCell>
                    <Link href={`/produccion/${l.loteId}`} className="hover:underline">
                      {l.folio}
                    </Link>
                  </TableCell>
                  <TableCell>{l.quien}</TableCell>
                  <TableCell className="text-muted-foreground">{l.recibio}</TableCell>
                  <TableCell>{l.producto}</TableCell>
                  <TableCell>{l.talla}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{l.cantidad}</TableCell>
                </TableRow>
              ))}
              {!detalle.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    Sin entregas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
