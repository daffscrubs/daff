"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Banknote, Calculator, Check, CreditCard, type LucideIcon } from "lucide-react";
import { cerrarCaja, type ResultadoCorte } from "@/actions/caja.actions";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearMoneda } from "@/lib/dinero";
import { cn } from "@/lib/utils";

type Metodo = "efectivo" | "tarjeta" | "transferencia";
const METODOS: { clave: Metodo; etiqueta: string; icono: LucideIcon; color: string }[] = [
  { clave: "efectivo", etiqueta: "Efectivo", icono: Banknote, color: "text-sky-500" },
  { clave: "tarjeta", etiqueta: "Tarjeta", icono: CreditCard, color: "text-violet-600" },
  { clave: "transferencia", etiqueta: "Transferencia", icono: ArrowRightLeft, color: "text-amber-600" },
];

export interface EsperadoCorte {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
}

// Vacío = sin contar (null). Un texto que no es dinero válido = NaN.
function leerConteo(texto: string): number | null {
  const limpio = texto.replace(/[$,\s]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : NaN;
}
const redondear = (n: number) => Math.round(n * 100) / 100;

function Diferencia({ esperado, contado }: { esperado: number; contado: number | null }) {
  if (contado === null || Number.isNaN(contado)) return null;
  const d = redondear(contado - esperado);
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-sm font-medium",
        d === 0 && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        d < 0 && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        d > 0 && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      {d === 0 ? "Cuadra" : `${formatearMoneda(Math.abs(d))} ${d < 0 ? "faltantes" : "sobrantes"}`}
    </span>
  );
}

// Corte de caja: se cuenta cada método de pago y se compara con lo que registró el sistema. Tarjeta y transferencia
// son opcionales (vacío = sin contar). Antes de cerrar hay una pantalla de confirmación: el cierre no se deshace.
export function CorteCaja({
  sesionId,
  ubicacion,
  esperado,
  alCancelar,
  alTerminar,
}: {
  sesionId: string;
  ubicacion: string;
  esperado: EsperadoCorte;
  alCancelar: () => void;
  alTerminar: () => void;
}) {
  const [paso, setPaso] = useState<"conteo" | "confirmar" | "listo">("conteo");
  const [textos, setTextos] = useState<Record<Metodo, string>>({ efectivo: "", tarjeta: "", transferencia: "" });
  const [comentarios, setComentarios] = useState("");
  const [resultado, setResultado] = useState<ResultadoCorte | null>(null);
  const [cerrando, startTransition] = useTransition();

  const conteo = { efectivo: leerConteo(textos.efectivo), tarjeta: leerConteo(textos.tarjeta), transferencia: leerConteo(textos.transferencia) };
  const hayError = METODOS.some((m) => Number.isNaN(conteo[m.clave]));
  const efectivoListo = conteo.efectivo !== null && !Number.isNaN(conteo.efectivo);
  const totalEsperado = redondear(esperado.efectivo + esperado.tarjeta + esperado.transferencia);
  const contados = METODOS.filter((m) => conteo[m.clave] !== null && !Number.isNaN(conteo[m.clave]));
  const totalContado = redondear(contados.reduce((acc, m) => acc + (conteo[m.clave] as number), 0));
  // La diferencia total solo suma los métodos que se contaron: un método sin contar no es un faltante.
  const diferenciaTotal = redondear(contados.reduce((acc, m) => acc + ((conteo[m.clave] as number) - esperado[m.clave]), 0));

  function cerrar() {
    startTransition(async () => {
      const res = await cerrarCaja(
        sesionId,
        { efectivo: conteo.efectivo as number, tarjeta: conteo.tarjeta, transferencia: conteo.transferencia },
        comentarios
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResultado(res.data);
      setPaso("listo");
    });
  }

  if (paso === "listo" && resultado) {
    const efectivo = resultado.efectivo.diferencia;
    return (
      <div>
        <div className="space-y-4 px-8 py-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Check className="size-7" />
          </div>
          <DialogTitle className="text-2xl font-semibold">Caja cerrada</DialogTitle>
          <p className="text-muted-foreground">El corte de {ubicacion} quedó guardado en Turnos de caja.</p>
          <div className="mx-auto max-w-md divide-y rounded-xl border text-left">
            {METODOS.map((m) => {
              const r = resultado[m.clave];
              return (
                <div key={m.clave} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    <m.icono className={cn("size-5", m.color)} />
                    {m.etiqueta}
                  </span>
                  {r.contado === null ? <span className="text-sm text-muted-foreground">Sin contar</span> : <Diferencia esperado={r.esperado} contado={r.contado} />}
                </div>
              );
            })}
          </div>
          {efectivo !== 0 && <p className="text-sm text-muted-foreground">El efectivo no cuadró: revisa los retiros e ingresos del turno.</p>}
        </div>
        <div className="flex justify-end border-t px-8 py-5">
          <Button className="h-11 px-6 text-base" onClick={alTerminar}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  if (paso === "confirmar") {
    return (
      <div>
        <div className="border-b px-8 py-6 pr-14">
          <DialogTitle className="text-2xl font-semibold">Confirmar corte de caja</DialogTitle>
          <p className="mt-1.5 text-muted-foreground">Revisa el resultado. Al cerrar ya no se pueden agregar ventas a este turno ni cancelar las que ya tiene.</p>
        </div>
        <div className="space-y-4 px-8 py-6">
          <div className="divide-y rounded-xl border">
            {METODOS.map((m) => (
              <div key={m.clave} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 px-4 py-3">
                <span className="flex items-center gap-2 font-medium">
                  <m.icono className={cn("size-5", m.color)} />
                  {m.etiqueta}
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  Esperado {formatearMoneda(esperado[m.clave])}
                  <br />
                  {conteo[m.clave] === null ? "Sin contar" : `Contado ${formatearMoneda(conteo[m.clave] as number)}`}
                </span>
                <span className="min-w-36 text-right">
                  <Diferencia esperado={esperado[m.clave]} contado={conteo[m.clave]} />
                </span>
              </div>
            ))}
          </div>
          {comentarios.trim() && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="font-medium">Comentarios: </span>
              {comentarios.trim()}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t px-8 py-5">
          <Button type="button" variant="outline" className="h-11 px-6 text-base" onClick={() => setPaso("conteo")} disabled={cerrando}>
            Volver
          </Button>
          <Button type="button" className="h-11 px-6 text-base" onClick={cerrar} disabled={cerrando}>
            {cerrando ? "Cerrando..." : "Cerrar caja"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (efectivoListo && !hayError) setPaso("confirmar");
      }}
    >
      <div className="border-b px-8 py-6 pr-14">
        <DialogTitle className="text-2xl font-semibold">Corte de Caja</DialogTitle>
        <p className="mt-1.5 text-muted-foreground">Haz un recuento manual del efectivo en tu caja y otros métodos de pago y compáralos con el valor registrado en el sistema.</p>
      </div>

      <div className="space-y-6 px-8 py-6">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="bg-muted/40 text-base">
                <th className="px-4 py-4" />
                <th className="px-3 py-4 font-semibold">Recuento Manual</th>
                <th className="px-3 py-4 text-center font-semibold">Total Esperado</th>
                <th className="px-3 py-4 text-center font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {METODOS.map((m, i) => (
                <tr key={m.clave}>
                  <td className="px-4 py-3">
                    <Label htmlFor={`corte-${m.clave}`} className="flex items-center gap-3 text-base font-medium">
                      <m.icono className={cn("size-6", m.color)} />
                      {m.etiqueta}
                    </Label>
                  </td>
                  <td className="px-3 py-3">
                    <div className="relative w-44">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id={`corte-${m.clave}`}
                        autoFocus={i === 0}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={textos[m.clave]}
                        onChange={(e) => setTextos((prev) => ({ ...prev, [m.clave]: e.target.value }))}
                        className={cn("h-11 pl-8 text-base", Number.isNaN(conteo[m.clave]) && "border-destructive")}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-base text-muted-foreground">{formatearMoneda(esperado[m.clave])}</td>
                  <td className="px-3 py-3 text-center">
                    <Diferencia esperado={esperado[m.clave]} contado={conteo[m.clave]} />
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/20 text-base font-semibold">
                <td className="px-4 py-4">
                  <span className="flex items-center gap-3">
                    <Calculator className="size-6" />
                    Total
                  </span>
                </td>
                <td className="px-3 py-4">{formatearMoneda(totalContado)}</td>
                <td className="px-3 py-4 text-center">{formatearMoneda(totalEsperado)}</td>
                <td className="px-3 py-4 text-center">{efectivoListo && <Diferencia esperado={0} contado={diferenciaTotal} />}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          El efectivo es obligatorio. Tarjeta y transferencia son opcionales: si las dejas vacías se guardan como &ldquo;sin contar&rdquo;.
        </p>

        <div className="space-y-2">
          <Label htmlFor="corte-comentarios" className="text-base font-medium">
            Comentarios (opcional)
          </Label>
          <Input id="corte-comentarios" value={comentarios} onChange={(e) => setComentarios(e.target.value)} placeholder="Registra comentarios de este corte" className="h-11 text-base" />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t px-8 py-5">
        <Button type="button" variant="outline" className="h-11 px-6 text-base" onClick={alCancelar}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11 px-6 text-base" disabled={!efectivoListo || hayError}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
