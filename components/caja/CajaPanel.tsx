"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, CreditCard, Landmark, Lock, Receipt, Smartphone, Store, Wallet } from "lucide-react";
import { abrirCaja, cerrarCaja, registrarMovimientoCaja } from "@/actions/caja.actions";
import { cancelarVenta } from "@/actions/ventas.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaSolo, formatearHoraMexico } from "@/lib/fechas";
import { cn } from "@/lib/utils";

interface SesionAbierta {
  id: string;
  desde: string;
  fondo: number;
  abiertaPor: string;
  efectivoEsperado: number;
}
interface Turno {
  id: string;
  apertura: string;
  cierre: string | null;
  fondo: number;
  esperado: number | null;
  contado: number | null;
  notas: string | null;
  abiertaPor: string;
  cerradaPor: string;
}
interface VentaCaja {
  id: string;
  folio: string;
  sesionId: string;
  fecha: string;
  total: number;
  descuento: number;
  estatus: "completada" | "cancelada";
  motivoCancelacion: string | null;
  vendedor: string;
  cliente: string | null;
  piezas: number;
  pagos: { metodo: "efectivo" | "transferencia" | "tarjeta"; monto: number }[];
}
interface MovimientoCaja {
  id: string;
  tipo: "ingreso" | "retiro";
  monto: number;
  concepto: string;
  fecha: string;
  usuario: string;
}
interface PermisosCaja {
  verVentas: boolean;
  abrirCerrar: boolean;
  ingresos: boolean;
  retiros: boolean;
  cancelar: boolean;
  vender: boolean;
}

const METODO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" } as const;

function leerMonto(texto: string): number {
  const n = Number(texto.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function Tarjeta({ icono: Icono, titulo, valor, detalle, tono }: { icono: typeof Wallet; titulo: string; valor: string; detalle?: string; tono?: "verde" | "rojo" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icono className="size-4" />
        {titulo}
      </div>
      <p className={cn("mt-1 text-2xl font-semibold", tono === "verde" && "text-emerald-600", tono === "rojo" && "text-red-600")}>{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

export function CajaPanel({
  ubicaciones,
  ubicacionId,
  fecha,
  hoy,
  sesionAbierta,
  sesiones,
  ventas,
  movimientos,
  permisos,
}: {
  ubicaciones: { id: string; nombre: string }[];
  ubicacionId: string;
  fecha: string;
  hoy: string;
  sesionAbierta: SesionAbierta | null;
  sesiones: Turno[];
  ventas: VentaCaja[];
  movimientos: MovimientoCaja[];
  permisos: PermisosCaja;
}) {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<"abrir" | "ingreso" | "retiro" | "cerrar" | null>(null);
  const [cancelando, setCancelando] = useState<VentaCaja | null>(null);
  const [resultadoCierre, setResultadoCierre] = useState<number | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [monto, setMonto] = useState("");
  const [texto, setTexto] = useState("");

  const esHoy = fecha === hoy;
  const ubicacion = ubicaciones.find((u) => u.id === ubicacionId);
  const completadas = ventas.filter((v) => v.estatus === "completada");
  const canceladas = ventas.filter((v) => v.estatus === "cancelada");
  const totalVentas = completadas.reduce((acc, v) => acc + v.total, 0);
  const porMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0 };
  for (const v of completadas) for (const p of v.pagos) porMetodo[p.metodo] += p.monto;
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((acc, m) => acc + m.monto, 0);
  const retiros = movimientos.filter((m) => m.tipo === "retiro").reduce((acc, m) => acc + m.monto, 0);

  function navegar(cambios: { ubicacion?: string; fecha?: string }) {
    const params = new URLSearchParams({ ubicacion: cambios.ubicacion ?? ubicacionId, fecha: cambios.fecha ?? fecha });
    router.push(`/caja?${params.toString()}`);
  }

  function abrirDialogo(tipo: "abrir" | "ingreso" | "retiro" | "cerrar") {
    setMonto("");
    setTexto("");
    setResultadoCierre(null);
    setDialogo(tipo);
  }

  function ejecutar(accion: () => Promise<{ ok: true; mensaje?: string; alTerminar?: () => void } | { ok: false; error: string }>) {
    startTransition(async () => {
      const res = await accion();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.mensaje) toast.success(res.mensaje);
      res.alTerminar?.();
      router.refresh();
    });
  }

  function enviarDialogo(e: React.FormEvent) {
    e.preventDefault();
    const cantidad = leerMonto(monto);
    if (dialogo === "cerrar" && !monto.trim()) return void toast.error("Cuenta el efectivo del cajón e ingresa la cantidad (puede ser 0).");
    if (dialogo !== "cerrar" && !(cantidad >= 0)) return void toast.error("Escribe un monto válido.");

    ejecutar(async () => {
      if (dialogo === "abrir") {
        const res = await abrirCaja(ubicacionId, cantidad || 0);
        return res.ok ? { ok: true, mensaje: "Caja abierta", alTerminar: () => setDialogo(null) } : res;
      }
      if (!sesionAbierta) return { ok: false, error: "No hay una caja abierta." };
      if (dialogo === "ingreso" || dialogo === "retiro") {
        const res = await registrarMovimientoCaja(sesionAbierta.id, dialogo, cantidad, texto);
        return res.ok ? { ok: true, mensaje: dialogo === "ingreso" ? "Ingreso registrado" : "Retiro registrado", alTerminar: () => setDialogo(null) } : res;
      }
      const res = await cerrarCaja(sesionAbierta.id, cantidad, texto);
      return res.ok ? { ok: true, alTerminar: () => setResultadoCierre(res.data.diferencia) } : res;
    });
  }

  function confirmarCancelacion(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelando) return;
    ejecutar(async () => {
      const res = await cancelarVenta(cancelando.id, texto);
      return res.ok ? { ok: true, mensaje: `${cancelando.folio} cancelada; las piezas regresaron al inventario`, alTerminar: () => setCancelando(null) } : res;
    });
  }

  const titulosDialogo = { abrir: "Abrir caja", ingreso: "Registrar ingreso de efectivo", retiro: "Registrar retiro de efectivo", cerrar: "Cerrar caja" } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Caja</h1>
          <p className="text-muted-foreground">Ventas del día, ingresos, retiros y el efectivo del cajón.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {ubicaciones.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ubicación</Label>
              <Select items={ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))} value={ubicacionId} onValueChange={(v) => v && navegar({ ubicacion: v })}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ubicaciones.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="fechaCaja" className="text-xs text-muted-foreground">
              Día
            </Label>
            <Input id="fechaCaja" type="date" max={hoy} value={fecha} className="h-9 w-40" onChange={(e) => e.target.value && navegar({ fecha: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Estado del turno */}
      <div className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4", sesionAbierta ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20" : "bg-muted/30")}>
        <div className="flex items-center gap-3">
          <div className={cn("flex size-11 items-center justify-center rounded-full", sesionAbierta ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950" : "bg-muted text-muted-foreground")}>
            {sesionAbierta ? <Landmark className="size-5" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="font-semibold">
              {sesionAbierta ? `Caja abierta · ${ubicacion?.nombre}` : `Caja cerrada · ${ubicacion?.nombre}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {sesionAbierta
                ? `Desde las ${formatearHoraMexico(sesionAbierta.desde)}${sesionAbierta.abiertaPor ? ` por ${sesionAbierta.abiertaPor}` : ""} · fondo inicial ${formatearMoneda(sesionAbierta.fondo)}`
                : "Ábrela con el fondo inicial para empezar a vender."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sesionAbierta ? (
            <>
              {permisos.vender && (
                <Button variant="outline" render={<a href="/pos" />} nativeButton={false}>
                  <Store className="size-4" />
                  Ir a vender
                </Button>
              )}
              {permisos.ingresos && (
                <Button variant="outline" onClick={() => abrirDialogo("ingreso")}>
                  <ArrowDownToLine className="size-4" />
                  Ingreso
                </Button>
              )}
              {permisos.retiros && (
                <Button variant="outline" onClick={() => abrirDialogo("retiro")}>
                  <ArrowUpFromLine className="size-4" />
                  Retiro
                </Button>
              )}
              {permisos.abrirCerrar && <Button onClick={() => abrirDialogo("cerrar")}>Cerrar caja</Button>}
            </>
          ) : (
            permisos.abrirCerrar && <Button onClick={() => abrirDialogo("abrir")}>Abrir caja</Button>
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta icono={Receipt} titulo={esHoy ? "Ventas de hoy" : `Ventas del ${formatearFechaSolo(fecha)}`} valor={formatearMoneda(totalVentas)} detalle={`${completadas.length} venta${completadas.length === 1 ? "" : "s"}${canceladas.length ? ` · ${canceladas.length} cancelada${canceladas.length === 1 ? "" : "s"}` : ""}`} />
        <Tarjeta icono={Banknote} titulo="Efectivo" valor={formatearMoneda(porMetodo.efectivo)} detalle="cobrado en efectivo" />
        <Tarjeta icono={Smartphone} titulo="Transferencia" valor={formatearMoneda(porMetodo.transferencia)} detalle="cobrado por transferencia" />
        <Tarjeta icono={CreditCard} titulo="Tarjeta" valor={formatearMoneda(porMetodo.tarjeta)} detalle="cobrado con tarjeta" />
        <Tarjeta icono={ArrowDownToLine} titulo="Ingresos de caja" valor={formatearMoneda(ingresos)} detalle="efectivo agregado" tono="verde" />
        <Tarjeta icono={ArrowUpFromLine} titulo="Retiros de caja" valor={formatearMoneda(retiros)} detalle="efectivo retirado" tono="rojo" />
        {sesionAbierta && (
          <div className="col-span-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" />
              Efectivo que debe haber en el cajón
            </div>
            <p className="mt-1 text-2xl font-semibold">{formatearMoneda(sesionAbierta.efectivoEsperado)}</p>
            <p className="text-xs text-muted-foreground">Fondo + ventas en efectivo + ingresos − retiros de este turno</p>
          </div>
        )}
      </div>

      {/* Ventas del día */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ventas {esHoy ? "de hoy" : "del día"}</h2>
        {permisos.verVentas ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Folio</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((v) => {
                  const enTurnoAbierto = sesionAbierta?.id === v.sesionId;
                  return (
                    <TableRow key={v.id} className={cn(v.estatus === "cancelada" && "opacity-60")}>
                      <TableCell className="pl-4 font-mono text-xs">
                        {v.folio}
                        {v.estatus === "cancelada" && (
                          <Badge className="ml-2 border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" title={v.motivoCancelacion ?? undefined}>
                            Cancelada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatearHoraMexico(v.fecha)}</TableCell>
                      <TableCell>
                        {v.vendedor}
                        {v.cliente && <span className="block text-xs text-muted-foreground">{v.cliente}</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.pagos.map((p) => `${METODO_LABEL[p.metodo]} ${formatearMoneda(p.monto)}`).join(" · ")}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", v.estatus === "cancelada" && "line-through")}>{formatearMoneda(v.total)}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button variant="ghost" size="sm" render={<a href={`/api/pdf/ventas/${v.id}`} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                          Ticket
                        </Button>
                        {permisos.cancelar && v.estatus === "completada" && enTurnoAbierto && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTexto("");
                              setCancelando(v);
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!ventas.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No hay ventas {esHoy ? "hoy" : "ese día"} en {ubicacion?.nombre}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No tienes permiso para ver el detalle de las ventas; arriba se muestran los totales.
          </p>
        )}
      </section>

      {/* Movimientos */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ingresos y retiros</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Registró</TableHead>
                <TableHead className="pr-4 text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-4">{formatearHoraMexico(m.fecha)}</TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent", m.tipo === "ingreso" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300")}>
                      {m.tipo === "ingreso" ? "Ingreso" : "Retiro"}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.concepto}</TableCell>
                  <TableCell className="text-muted-foreground">{m.usuario}</TableCell>
                  <TableCell className={cn("pr-4 text-right font-medium", m.tipo === "ingreso" ? "text-emerald-600" : "text-red-600")}>
                    {m.tipo === "ingreso" ? "+" : "−"}
                    {formatearMoneda(m.monto)}
                  </TableCell>
                </TableRow>
              ))}
              {!movimientos.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Sin ingresos ni retiros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Turnos */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Turnos de caja</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Apertura</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead className="text-right">Fondo</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="pr-4 text-right">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sesiones.map((s) => {
                const diferencia = s.contado !== null && s.esperado !== null ? s.contado - s.esperado : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4">
                      {formatearHoraMexico(s.apertura)}
                      <span className="block text-xs text-muted-foreground">{s.abiertaPor}</span>
                    </TableCell>
                    <TableCell>
                      {s.cierre ? formatearHoraMexico(s.cierre) : <Badge variant="secondary">Abierta</Badge>}
                      {s.cierre && <span className="block text-xs text-muted-foreground">{s.cerradaPor}</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatearMoneda(s.fondo)}</TableCell>
                    <TableCell className="text-right">{s.esperado !== null ? formatearMoneda(s.esperado) : "—"}</TableCell>
                    <TableCell className="text-right">{s.contado !== null ? formatearMoneda(s.contado) : "—"}</TableCell>
                    <TableCell className={cn("pr-4 text-right font-medium", diferencia !== null && diferencia < 0 && "text-red-600", diferencia !== null && diferencia > 0 && "text-amber-600")}>
                      {diferencia === null ? "—" : diferencia === 0 ? "Cuadra" : `${diferencia > 0 ? "+" : "−"}${formatearMoneda(Math.abs(diferencia))}`}
                      {s.notas && <span className="block text-xs font-normal text-muted-foreground">{s.notas}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!sesiones.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No hubo turnos de caja ese día.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Abrir / ingreso / retiro / cerrar */}
      <Dialog open={!!dialogo} onOpenChange={(abierto) => !abierto && !pendiente && setDialogo(null)}>
        <DialogContent>
          {dialogo && resultadoCierre === null && (
            <>
              <DialogHeader>
                <DialogTitle>{titulosDialogo[dialogo]}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={enviarDialogo}>
                {dialogo === "cerrar" && sesionAbierta && (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    Cuenta el efectivo que hay en el cajón y escríbelo. El sistema lo compara con lo que debería haber ({formatearMoneda(sesionAbierta.efectivoEsperado)}) y deja el corte guardado.
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="montoCaja">
                    {dialogo === "abrir" ? "Fondo inicial (efectivo con el que empieza la caja)" : dialogo === "cerrar" ? "Efectivo contado en el cajón" : "Monto"}
                  </Label>
                  <Input id="montoCaja" inputMode="decimal" autoFocus placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} />
                </div>
                {dialogo !== "abrir" && (
                  <div className="space-y-2">
                    <Label htmlFor="textoCaja">{dialogo === "cerrar" ? "Notas del corte (opcional)" : "Motivo"}</Label>
                    <Input id="textoCaja" placeholder={dialogo === "ingreso" ? "Ej. cambio para la caja" : dialogo === "retiro" ? "Ej. pago a proveedor" : ""} value={texto} onChange={(e) => setTexto(e.target.value)} />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogo(null)} disabled={pendiente}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={pendiente}>
                    {pendiente ? "Guardando..." : dialogo === "abrir" ? "Abrir caja" : dialogo === "cerrar" ? "Cerrar caja" : "Registrar"}
                  </Button>
                </div>
              </form>
            </>
          )}
          {dialogo === "cerrar" && resultadoCierre !== null && (
            <div className="space-y-4 text-center">
              <DialogHeader>
                <DialogTitle>Caja cerrada</DialogTitle>
              </DialogHeader>
              <p className={cn("text-3xl font-bold", resultadoCierre === 0 ? "text-emerald-600" : resultadoCierre < 0 ? "text-red-600" : "text-amber-600")}>
                {resultadoCierre === 0 ? "La caja cuadra" : `${resultadoCierre < 0 ? "Faltan" : "Sobran"} ${formatearMoneda(Math.abs(resultadoCierre))}`}
              </p>
              <p className="text-sm text-muted-foreground">El corte quedó guardado en la sección Turnos de caja.</p>
              <Button className="w-full" onClick={() => setDialogo(null)}>
                Listo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancelar venta */}
      <Dialog open={!!cancelando} onOpenChange={(abierto) => !abierto && !pendiente && setCancelando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar {cancelando?.folio}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={confirmarCancelacion}>
            <p className="text-sm text-muted-foreground">
              Las {cancelando?.piezas} pieza{cancelando?.piezas === 1 ? "" : "s"} regresan al inventario y la venta deja de sumar en la caja. Esto no se puede deshacer.
            </p>
            <div className="space-y-2">
              <Label htmlFor="motivoCancelacion">Motivo</Label>
              <Input id="motivoCancelacion" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. el cliente se arrepintió" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCancelando(null)} disabled={pendiente}>
                Volver
              </Button>
              <Button type="submit" variant="destructive" disabled={pendiente || texto.trim().length < 3}>
                {pendiente ? "Cancelando..." : "Cancelar venta"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
