"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { PiezasColaborador } from "@/lib/dashboard/piezasPorColaborador";

export function PiezasPorColaboradorSemana({ datos }: { datos: PiezasColaborador[] }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Piezas por colaborador (semana)</p>
          <Link href="/reportes/productividad" className="text-sm font-medium text-primary hover:underline">
            Ver reporte
          </Link>
        </div>

        {datos.length ? (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  domain={[0, (max: number) => Math.max(max, 1)]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="colaborador"
                  width={90}
                  tick={{ fontSize: 12, fill: "var(--foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [v, "Piezas"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="piezas" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-muted-foreground">Sin registros esta semana</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
