import Link from "next/link";
import { ClipboardList, Factory, AlertTriangle } from "lucide-react";
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
import { MetricasFinancieras } from "@/components/dashboard/MetricasFinancieras";
import { ActividadDiariaColaboradores } from "@/components/dashboard/ActividadDiariaColaboradores";
import { PiezasPorColaboradorSemana } from "@/components/dashboard/PiezasPorColaboradorSemana";
import { totalesPorPedido } from "@/lib/pedidos/totales";
import { construirRegistrosReporte } from "@/lib/produccion/registro-reporte";
import { piezasPorColaboradorSemana } from "@/lib/dashboard/piezasPorColaborador";
import { stockPorUnidadesPorMaterial, stockEfectivo } from "@/lib/materiales/stock";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Las dos tandas de consultas de antes no dependían una de otra (ninguna
  // columna de la primera se usaba para armar la segunda) — estaban
  // serializadas sin necesidad, duplicando el tiempo de espera. Se combinan
  // en un solo Promise.all para que las ~15 consultas salgan en paralelo de
  // una vez. También se quitó la consulta de "avances" (fecha, cantidad)
  // que era un segundo escaneo completo de registros_avance_colaborador:
  // esos mismos datos ya vienen en registrosAvance de abajo, así que se
  // derivan en JS (mismo filtro origen='colaborador', mismo resultado) en
  // vez de pedirlos dos veces a la base. Los `select("*")` que solo se
  // usaban parcialmente (materiales, items_pedido, items_orden_produccion,
  // lote_etapas) se acotaron a las columnas que realmente se leen más abajo
  // — mismos datos mostrados, menos bytes que viajan.
  const [
    { count: pedidosActivos },
    { count: lotesEnProceso },
    { data: materiales },
    { data: pedidos },
    { data: itemsPedido },
    { data: compras },
    { data: gastos },
    { data: registrosAvance },
    { data: etapasCatalogo },
    { data: loteEtapas },
    { data: items },
    { data: lotes },
    { data: modelos },
    { data: tallas },
    { data: colaboradores },
    { data: unidadesMaterial },
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
    supabase
      .from("registros_avance_colaborador")
      .select(
        "id, fecha, created_at, cantidad, origen, observaciones, foto_url, colaborador_id, lote_id, lote_etapa_id, perfiles!registros_avance_colaborador_colaborador_id_fkey(nombre_completo)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("etapas_proceso").select("*"),
    supabase.from("lote_etapas").select("id, item_orden_id, etapa_id, parent_lote_etapa_id, nombre_subproceso"),
    supabase.from("items_orden_produccion").select("id, modelo_id, talla_id"),
    supabase.from("lotes_produccion").select("id, folio"),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
    supabase.from("perfiles").select("id, nombre_completo").eq("rol", "colaborador").eq("activo", true).order("nombre_completo"),
    supabase.from("unidades_material").select("material_id, cantidad_actual, estatus"),
  ]);

  const actividadColaboradores = construirRegistrosReporte({
    registros: registrosAvance ?? [],
    etapasCatalogo: etapasCatalogo ?? [],
    loteEtapas: loteEtapas ?? [],
    items: items ?? [],
    lotes: lotes ?? [],
    modelos: modelos ?? [],
    tallas: tallas ?? [],
  });

  const piezasSemana = piezasPorColaboradorSemana(actividadColaboradores);

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
  const gastosParaMetricas = (gastos ?? []).map((g) => ({ fecha: g.fecha, monto: g.monto }));
  // Antes era una consulta aparte a registros_avance_colaborador; ahora se
  // deriva de registrosAvance (mismo filtro, mismos datos) para no pedirle
  // dos veces la misma tabla a la base.
  const avancesParaMetricas = (registrosAvance ?? [])
    .filter((r) => r.origen === "colaborador")
    .map((r) => ({ fecha: r.fecha, monto: r.cantidad }));

  const kpis = [
    { href: "/pedidos", label: "Pedidos activos", valor: pedidosActivos ?? 0, icon: ClipboardList, color: "text-blue-600 bg-blue-100 dark:bg-blue-950" },
    { href: "/produccion", label: "Órdenes en producción", valor: lotesEnProceso ?? 0, icon: Factory, color: "text-amber-600 bg-amber-100 dark:bg-amber-950" },
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
        avances={avancesParaMetricas}
      />

      <PiezasPorColaboradorSemana datos={piezasSemana} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <ActividadDiariaColaboradores
        registros={actividadColaboradores}
        colaboradores={(colaboradores ?? []).map((c) => ({ id: c.id, nombre: c.nombre_completo }))}
      />
    </div>
  );
}
