"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, BarChart3, CreditCard, ArrowRightLeft, Receipt, Undo2, Tag, Hourglass, TrendingUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearMoneda } from "@/lib/dinero";
import { etiquetaCorta, etiquetaPeriodo, rangoDePeriodo, type Agrupacion, type Preset } from "@/lib/reportes/ventas";
import { cn } from "@/lib/utils";

interface Periodo {
  periodo: string;
  ventas: number;
  bruto: number;
  descuentos: number;
  reembolsos: number;
  neto: number;
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  porCobrar: number;
}
interface Fila {
  clave: string;
  ventas: number;
  neto: number;
}

const AGRUPACIONES: { valor: Agrupacion; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Por día" },
  { valor: "mes", etiqueta: "Por mes" },
  { valor: "anio", etiqueta: "Por año" },
];

function Metrica({ icono: Icono, titulo, valor, detalle, tono }: { icono: LucideIcon; titulo: string; valor: string; detalle?: string; tono?: "ambar" | "rojo" | "verde" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icono className="size-4" />
        {titulo}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", tono === "ambar" && "text-amber-600", tono === "rojo" && "text-red-600", tono === "verde" && "text-emerald-600")}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

function ListaTop({ titulo, filas, total, nota }: { titulo: string; filas: Fila[]; total: number; nota?: string }) {
  const maximo = Math.max(...filas.map((f) => f.neto), 1);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">{titulo}</h3>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      <ul className="mt-3 space-y-3">
        {filas.map((f) => (
          <li key={f.clave} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{f.clave}</span>
              <span className="shrink-0 tabular-nums">{formatearMoneda(f.neto)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max((f.neto / maximo) * 100, 2)}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                {f.ventas.toLocaleString("es-MX")} venta{f.ventas === 1 ? "" : "s"} · {total > 0 ? Math.round((f.neto / total) * 100) : 0}%
              </span>
            </div>
          </li>
        ))}
        {!filas.length && <li className="py-6 text-center text-sm text-muted-foreground">Sin ventas en este periodo.</li>}
      </ul>
    </div>
  );
}

export function ReporteVentas({
  desde,
  hasta,
  agrupar,
  presets,
  periodos,
  clientes,
  cajeros,
  error,
}: {
  desde: string;
  hasta: string;
  agrupar: Agrupacion;
  presets: Preset[];
  periodos: Periodo[];
  clientes: Fila[];
  cajeros: Fila[];
  error: string | null;
}) {
  const router = useRouter();
  const [desdeEdit, setDesdeEdit] = useState(desde);
  const [hastaEdit, setHastaEdit] = useState(hasta);
  const [agruparEdit, setAgruparEdit] = useState<Agrupacion>(agrupar);

  function ir(rango: { desde: string; hasta: string; agrupar: Agrupacion }) {
    router.push(`/reportes/ventas?${new URLSearchParams(rango).toString()}`);
  }

  const total = periodos.reduce(
    (acc, p) => ({
      ventas: acc.ventas + p.ventas,
      bruto: acc.bruto + p.bruto,
      descuentos: acc.descuentos + p.descuentos,
      reembolsos: acc.reembolsos + p.reembolsos,
      neto: acc.neto + p.neto,
      efectivo: acc.efectivo + p.efectivo,
      tarjeta: acc.tarjeta + p.tarjeta,
      transferencia: acc.transferencia + p.transferencia,
      porCobrar: acc.porCobrar + p.porCobrar,
    }),
    { ventas: 0, bruto: 0, descuentos: 0, reembolsos: 0, neto: 0, efectivo: 0, tarjeta: 0, transferencia: 0, porCobrar: 0 }
  );
  const cobrado = total.efectivo + total.tarjeta + total.transferencia;
  const presetActivo = presets.find((p) => p.desde === desde && p.hasta === hasta && p.agrupar === agrupar)?.id;
  const datosGrafica = periodos.map((p) => ({ ...p, etiqueta: etiquetaCorta(p.periodo, agrupar), completa: etiquetaPeriodo(p.periodo, agrupar) }));
  const cambiosPendientes = desdeEdit !== desde || hastaEdit !== hasta || agruparEdit !== agrupar;
  const fechasValidas = !!desdeEdit && !!hastaEdit;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => ir(p)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                presetActivo === p.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (fechasValidas) ir({ desde: desdeEdit, hasta: hastaEdit, agrupar: agruparEdit });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rep-desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input id="rep-desde" type="date" value={desdeEdit} onChange={(e) => setDesdeEdit(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input id="rep-hasta" type="date" value={hastaEdit} onChange={(e) => setHastaEdit(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Agrupar</Label>
            <Select items={AGRUPACIONES.map((a) => ({ value: a.valor, label: a.etiqueta }))} value={agruparEdit} onValueChange={(v) => v && setAgruparEdit(v as Agrupacion)}>
              <SelectTrigger className="h-9 w-36" aria-label="Agrupar por">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGRUPACIONES.map((a) => (
                  <SelectItem key={a.valor} value={a.valor}>
                    {a.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!cambiosPendientes || !fechasValidas}>
            Aplicar
          </Button>
        </form>
      </div>

      {error && <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">No se pudo cargar el reporte: {error}</p>}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Metrica icono={TrendingUp} titulo="Venta neta" valor={formatearMoneda(total.neto)} detalle="Ya sin descuentos ni reembolsos" />
        <Metrica icono={Receipt} titulo="Ventas" valor={total.ventas.toLocaleString("es-MX")} detalle="Sin contar canceladas" />
        <Metrica icono={BarChart3} titulo="Ticket promedio" valor={formatearMoneda(total.ventas ? total.neto / total.ventas : 0)} />
        <Metrica icono={Tag} titulo="Descuentos" valor={formatearMoneda(total.descuentos)} />
        <Metrica icono={Undo2} titulo="Reembolsos" valor={formatearMoneda(total.reembolsos)} />
        <Metrica icono={Hourglass} titulo="Por cobrar" valor={formatearMoneda(total.porCobrar)} tono={total.porCobrar > 0 ? "ambar" : undefined} detalle="Ventas a deuda sin liquidar" />
      </div>

      {/* Gráfica */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Venta neta {agrupar === "mes" ? "por mes" : agrupar === "dia" ? "por día" : "por año"}</h2>
        {periodos.length ? (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGrafica} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  labelFormatter={(_, items) => items?.[0]?.payload?.completa ?? ""}
                  formatter={(v, _n, item) => [`${formatearMoneda(Number(v))} · ${item.payload.ventas} venta${item.payload.ventas === 1 ? "" : "s"}`, "Venta neta"]}
                />
                <Bar dataKey="neto" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EstadoVacio icon={BarChart3} titulo="Sin ventas en este periodo" descripcion="Cambia las fechas o elige otro periodo arriba." />
        )}
      </div>

      {/* Métodos de pago */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metrica icono={Banknote} titulo="Efectivo" valor={formatearMoneda(total.efectivo)} detalle={cobrado > 0 ? `${Math.round((total.efectivo / cobrado) * 100)}% de lo cobrado` : undefined} />
        <Metrica icono={CreditCard} titulo="Tarjeta" valor={formatearMoneda(total.tarjeta)} detalle={cobrado > 0 ? `${Math.round((total.tarjeta / cobrado) * 100)}% de lo cobrado` : undefined} />
        <Metrica icono={ArrowRightLeft} titulo="Transferencia" valor={formatearMoneda(total.transferencia)} detalle={cobrado > 0 ? `${Math.round((total.transferencia / cobrado) * 100)}% de lo cobrado` : undefined} />
      </div>

      {/* Tabla por periodo */}
      <div className="space-y-2">
        <h2 className="font-semibold">Detalle {agrupar === "mes" ? "por mes" : agrupar === "dia" ? "por día" : "por año"}</h2>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Periodo</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Venta neta</TableHead>
                <TableHead className="text-right">Descuentos</TableHead>
                <TableHead className="text-right">Reembolsos</TableHead>
                <TableHead className="text-right">Efectivo</TableHead>
                <TableHead className="text-right">Tarjeta</TableHead>
                <TableHead className="text-right">Transferencia</TableHead>
                <TableHead className="pr-4 text-right">Por cobrar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...periodos].reverse().map((p) => {
                const detalle = rangoDePeriodo(p.periodo, agrupar);
                return (
                  <TableRow key={p.periodo}>
                    <TableCell className="pl-4 font-medium">
                      {detalle ? (
                        <button type="button" className="text-left hover:underline" title={agrupar === "mes" ? "Ver este mes por día" : "Ver este año por mes"} onClick={() => ir(detalle)}>
                          {etiquetaPeriodo(p.periodo, agrupar)}
                        </button>
                      ) : (
                        etiquetaPeriodo(p.periodo, agrupar)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.ventas.toLocaleString("es-MX")}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatearMoneda(p.neto)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.descuentos ? formatearMoneda(p.descuentos) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.reembolsos ? formatearMoneda(p.reembolsos) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearMoneda(p.efectivo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearMoneda(p.tarjeta)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearMoneda(p.transferencia)}</TableCell>
                    <TableCell className={cn("pr-4 text-right tabular-nums", p.porCobrar > 0 ? "font-medium text-amber-600" : "text-muted-foreground")}>{p.porCobrar > 0 ? formatearMoneda(p.porCobrar) : "—"}</TableCell>
                  </TableRow>
                );
              })}
              {!periodos.length && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Sin ventas en este periodo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {periodos.length > 0 && (
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell className="pl-4">Total</TableCell>
                  <TableCell className="text-right tabular-nums">{total.ventas.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(total.neto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(total.descuentos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(total.reembolsos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(total.efectivo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(total.tarjeta)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearMoneda(total.transferencia)}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatearMoneda(total.porCobrar)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Incluye las ventas importadas del sistema anterior y las del punto de venta. La venta neta ya descuenta descuentos y reembolsos; los métodos de pago muestran lo cobrado en cada venta
          (los reembolsos no se restan de ellos). Las horas se cuentan en hora de México.
          {agrupar !== "dia" && " Toca un periodo para ver su detalle."}
        </p>
      </div>

      {/* Top */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListaTop titulo="Mejores clientes" filas={clientes} total={total.neto} nota="Solo clientes con registro; las ventas de mostrador sin cliente no se cuentan aquí." />
        <ListaTop titulo="Ventas por cajero" filas={cajeros} total={total.neto} />
      </div>
    </div>
  );
}
