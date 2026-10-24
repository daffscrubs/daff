import Link from "next/link";
import { ClipboardList, Factory, AlertTriangle, HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { formatearMoneda } from "@/lib/dinero";
import { hoyMexico } from "@/lib/fechas";
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
import { MetricasFinancieras } from "@/components/dashboard/MetricasFinancieras";
import { totalesPorPedido } from "@/lib/pedidos/totales";
import { stockPorUnidadesPorMaterial, stockEfectivo } from "@/lib/materiales/stock";

export default async function DashboardPage() {
  const supabase = await createClient();

  const perfil = await requerirPerfil();
  const puedeVerPagos = tienePermiso(perfil, "produccion.pagos_maquila");

  // Las consultas no dependen una de otra: salen todas en paralelo. Las columnas se acotan a lo que se usa.
  const [
    { count: pedidosActivos },
    { count: lotesEnProceso },
    { data: materiales },
    { data: pedidos },
    { data: itemsPedido },
    { data: compras },
    { data: gastos },
    { data: entregadas },
    { data: unidadesMaterial },
    { data: pagosPagados },
    { data: pagosPendientes },
  ] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .in("estatus", ["confirmado", "en_produccion"]),
    supabase
      .from("lotes_produccion")
      .select("id", { count: "exact", head: true })
      .in("estatus", ["planeada", "en_proceso"]),
    supabase.from("materiales").select("id, nombre, unidad_medida, stock_actual, stock_minimo, seguimiento_por_unidad"),
    supabase.from("pedidos").select("id, fecha_pedido"),
    supabase.from("items_pedido").select("pedido_id, cantidad, precio_unitario"),
    supabase.from("compras").select("fecha, total"),
    supabase.from("gastos").select("fecha, monto"),
    leerTodo((d, h) =>
      supabase
        .from("entrega_produccion_items")
        .select("id, cantidad, entregas_produccion!inner(fecha, estatus)")
        .eq("entregas_produccion.estatus", "registrada")
        .order("id")
        .range(d, h)
    ),
    supabase.from("unidades_material").select("material_id, cantidad_actual, estatus"),
    // Montos de maquila: solo los ve quien tiene el permiso (la base de datos devuelve vacío al resto).
    supabase.from("pagos_maquila").select("monto, fecha_pago_real").eq("estatus", "pagado"),
    supabase.from("pagos_maquila").select("monto, fecha_programada").eq("estatus", "pendiente"),
  ]);

  // Un material por unidad nunca recibe movimientos_inventario -- su
  // stock_actual de bulto queda congelado en 0 desde que se activa el
  // seguimiento por unidad. Comparar contra ese 0 marcaría "stock bajo" a
  // cualquier material por unidad sin importar cuántos rollos/bolsas tenga
  // en realidad, así que se compara contra la suma de sus unidades.
  const stockPorUnidades = stockPorUnidadesPorMaterial(unidadesMaterial ?? []);
  const bajoStock = (materiales ?? [])
    .map((m) => ({ ...m, stockActual: stockEfectivo(m, stockPorUnidades) }))
    .filter((m) => m.stockActual <= m.stock_minimo);

  const totalesPedidos = totalesPorPedido(itemsPedido ?? []);
  const pedidosParaMetricas = (pedidos ?? []).map((p) => ({
    fecha: p.fecha_pedido,
    total: totalesPedidos[p.id] ?? 0,
  }));
  const comprasParaMetricas = (compras ?? []).map((c) => ({ fecha: c.fecha, monto: c.total }));
  // Los pagos a maquileros cuentan como gasto cuando se marcan como pagados (en la fecha en que se pagaron).
  const gastosParaMetricas = [
    ...(gastos ?? []).map((g) => ({ fecha: g.fecha, monto: g.monto })),
    ...(pagosPagados ?? []).filter((p) => p.fecha_pago_real).map((p) => ({ fecha: p.fecha_pago_real as string, monto: Number(p.monto) })),
  ];
  const entregasParaMetricas = entregadas.map((e) => ({ fecha: e.entregas_produccion.fecha, monto: e.cantidad }));
  const porPagarMaquila = (pagosPendientes ?? []).reduce((acc, p) => acc + Number(p.monto), 0);
  const hoyISO = hoyMexico();
  const vencidoMaquila = (pagosPendientes ?? []).filter((p) => p.fecha_programada < hoyISO).reduce((acc, p) => acc + Number(p.monto), 0);

  const kpis = [
    { href: "/pedidos", label: "Pedidos activos", valor: pedidosActivos ?? 0, icon: ClipboardList, color: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
    { href: "/produccion", label: "Órdenes en producción", valor: lotesEnProceso ?? 0, icon: Factory, color: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
    ...(puedeVerPagos
      ? [
          {
            href: "/produccion/pagos",
            label: vencidoMaquila > 0 ? `Por pagar a maquileros · ${formatearMoneda(vencidoMaquila)} vencido` : "Por pagar a maquileros",
            valor: formatearMoneda(porPagarMaquila),
            icon: HandCoins,
            color: "text-violet-600 bg-violet-100 dark:bg-violet-950",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general del taller.</p>
      </div>

      <MetricasFinancieras
        pedidos={pedidosParaMetricas}
        compras={comprasParaMetricas}
        gastos={gastosParaMetricas}
        entregas={entregasParaMetricas}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                    {m.stockActual} / mínimo {m.stock_minimo} {m.unidad_medida}
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
  );
}
