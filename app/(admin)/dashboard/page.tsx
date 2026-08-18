import Link from "next/link";
import { ClipboardList, Factory, Truck, AlertTriangle, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const supabase = await createClient();

  const enUnaSemana = new Date();
  enUnaSemana.setDate(enUnaSemana.getDate() + 7);

  const [
    { count: pedidosActivos },
    { count: lotesEnProceso },
    { data: entregasProximas },
    { data: materiales },
  ] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .in("estatus", ["confirmado", "en_produccion"]),
    supabase
      .from("lotes_produccion")
      .select("id", { count: "exact", head: true })
      .in("estatus", ["planeada", "en_proceso"]),
    supabase
      .from("entregas")
      .select("*, pedidos(folio)")
      .eq("estatus", "programada")
      .lte("fecha_programada", enUnaSemana.toISOString().slice(0, 10))
      .order("fecha_programada"),
    supabase.from("materiales").select("*"),
  ]);

  const bajoStock = (materiales ?? []).filter((m) => m.stock_actual <= m.stock_minimo);

  const kpis = [
    { href: "/pedidos", label: "Pedidos activos", valor: pedidosActivos ?? 0, icon: ClipboardList, color: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
    { href: "/produccion", label: "Órdenes en producción", valor: lotesEnProceso ?? 0, icon: Factory, color: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
    { href: "/entregas", label: "Entregas esta semana", valor: entregasProximas?.length ?? 0, icon: Truck, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del taller.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Link key={kpi.href} href={kpi.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
                  <kpi.icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none">{kpi.valor}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="size-4 text-muted-foreground" />
            Próximas entregas
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entregasProximas?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/entregas/${e.id}`} className="hover:underline">
                      {e.pedidos?.folio}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.fecha_programada}</TableCell>
                </TableRow>
              ))}
              {!entregasProximas?.length && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin entregas próximas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-4 text-muted-foreground" />
            Alertas de inventario
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bajoStock.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/materiales/${m.id}`} className="hover:underline">
                      {m.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {m.stock_actual} / mínimo {m.stock_minimo} {m.unidad_medida}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!bajoStock.length && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Sin alertas de inventario.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
