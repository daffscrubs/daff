import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { ConteoEtapaPedidos } from "@/lib/dashboard/pedidosPorEtapa";

const COLORES_PILL = [
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
];
const COLOR_ENTREGADO = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";

export function PedidosPorEtapa({ conteos }: { conteos: ConteoEtapaPedidos[] }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Pedidos por etapa</p>
          <Link href="/pedidos" className="text-sm font-medium text-primary hover:underline">
            Ver reporte
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {conteos.map((c, i) => (
            <div key={c.etapa} className="flex items-center justify-between">
              <span
                className={`inline-flex h-6 items-center rounded-full px-3 text-sm font-medium ${
                  c.etapa === "Entregado" ? COLOR_ENTREGADO : COLORES_PILL[i % COLORES_PILL.length]
                }`}
              >
                {c.etapa}
              </span>
              <span className="text-lg font-bold">{c.cantidad}</span>
            </div>
          ))}
          {!conteos.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin etapas configuradas.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
