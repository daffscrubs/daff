import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del taller.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pedidos activos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{pedidosActivos ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Lotes en producción</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{lotesEnProceso ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Entregas esta semana</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{entregasProximas?.length ?? 0}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Próximas entregas</h2>
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
          <h2 className="mb-3 text-lg font-semibold">Alertas de inventario</h2>
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
