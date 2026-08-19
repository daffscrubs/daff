"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { PuntoSerieDiaria } from "@/lib/dashboard/serieDiaria";

type Formato = "moneda" | "piezas";

function formatoEje(valor: number, formato: Formato) {
  if (formato === "piezas") return valor.toLocaleString("es-MX");
  if (Math.abs(valor) >= 1000) return `$${(valor / 1000).toFixed(valor % 1000 === 0 ? 0 : 1)}k`;
  return `$${valor.toFixed(0)}`;
}

function formatoGrande(valor: number, formato: Formato) {
  if (formato === "piezas") return valor.toLocaleString("es-MX");
  return `$${valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TarjetaMetricaConGrafica({
  titulo,
  valor,
  href,
  serie,
  color = "#2563eb",
  formato = "moneda",
}: {
  titulo: string;
  valor: number;
  href: string;
  serie: PuntoSerieDiaria[];
  color?: string;
  formato?: Formato;
}) {
  const idGradiente = `gradiente-${titulo.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
          <Link href={href} className="text-sm font-medium text-primary hover:underline">
            Ver reporte
          </Link>
        </div>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{formatoGrande(valor, formato)}</p>
        <div className="mt-3 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="etiqueta"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatoEje(v, formato)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                domain={[0, (max: number) => Math.max(max, 1)]}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v) => [formatoGrande(Number(v), formato), titulo]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${idGradiente})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
