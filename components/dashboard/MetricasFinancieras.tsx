"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TarjetaMetricaConGrafica } from "@/components/dashboard/TarjetaMetricaConGrafica";
import { rangoDePeriodo, type TipoPeriodo } from "@/lib/dashboard/periodos";
import { serieDiaria } from "@/lib/dashboard/serieDiaria";
import { fechaISOLocal } from "@/lib/fechas";

export interface PedidoResumenFinanciero {
  fecha: string;
  total: number;
}

export interface MovimientoFinanciero {
  fecha: string;
  monto: number;
}

const OPCIONES_PERIODO = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "personalizado", label: "Personalizado" },
];

export function MetricasFinancieras({
  pedidos,
  compras,
  gastos,
  entregas,
}: {
  pedidos: PedidoResumenFinanciero[];
  compras: MovimientoFinanciero[];
  gastos: MovimientoFinanciero[];
  /** Piezas entregadas por día (entregas de producción vigentes). */
  entregas: MovimientoFinanciero[];
}) {
  const [periodo, setPeriodo] = useState<TipoPeriodo>("mes");
  const hoy = fechaISOLocal(new Date());
  const [desdePersonalizado, setDesdePersonalizado] = useState(hoy);
  const [hastaPersonalizado, setHastaPersonalizado] = useState(hoy);

  const { desde, hasta } = useMemo(() => {
    if (periodo === "personalizado") return { desde: desdePersonalizado, hasta: hastaPersonalizado };
    return rangoDePeriodo(periodo);
  }, [periodo, desdePersonalizado, hastaPersonalizado]);

  const enRango = (fecha: string) => fecha >= desde && fecha <= hasta;

  const ingresos = pedidos.filter((p) => enRango(p.fecha)).reduce((acc, p) => acc + p.total, 0);
  const totalCompras = compras.filter((c) => enRango(c.fecha)).reduce((acc, c) => acc + c.monto, 0);
  const totalGastos = gastos.filter((g) => enRango(g.fecha)).reduce((acc, g) => acc + g.monto, 0);
  const totalPiezas = entregas.filter((a) => enRango(a.fecha)).reduce((acc, a) => acc + a.monto, 0);

  const serieIngresos = serieDiaria(pedidos.map((p) => ({ fecha: p.fecha, monto: p.total })));
  const serieCompras = serieDiaria(compras);
  const serieGastos = serieDiaria(gastos);
  const seriePiezas = serieDiaria(entregas);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select items={OPCIONES_PERIODO} value={periodo} onValueChange={(v) => setPeriodo((v ?? "mes") as TipoPeriodo)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_PERIODO.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {periodo === "personalizado" ? (
          <div className="flex items-center gap-2">
            <Input type="date" value={desdePersonalizado} onChange={(e) => setDesdePersonalizado(e.target.value)} className="w-40" />
            <span className="text-muted-foreground">a</span>
            <Input type="date" value={hastaPersonalizado} onChange={(e) => setHastaPersonalizado(e.target.value)} className="w-40" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {desde === hasta ? desde : `${desde} a ${hasta}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaMetricaConGrafica titulo="Ingresos" valor={ingresos} href="/pedidos" serie={serieIngresos} color="#16a34a" formato="moneda" />
        <TarjetaMetricaConGrafica titulo="Compras" valor={totalCompras} href="/compras" serie={serieCompras} color="#d97706" formato="moneda" />
        <TarjetaMetricaConGrafica titulo="Gastos" valor={totalGastos} href="/compras/gastos" serie={serieGastos} color="#dc2626" formato="moneda" />
        <TarjetaMetricaConGrafica titulo="Piezas entregadas" valor={totalPiezas} href="/reportes/entregas" serie={seriePiezas} color="#2563eb" formato="piezas" />
      </div>
    </div>
  );
}
