import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Hourglass, PackageCheck, Phone, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { entregadoPorItem as calcularEntregado, type EntregaConItems } from "@/lib/produccion/entregas";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaCorta, hoyMexico } from "@/lib/fechas";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_ORDEN } from "@/lib/estatus-colores";
import { cn } from "@/lib/utils";

function Dato({ icono: Icono, titulo, valor, tono }: { icono: typeof Wallet; titulo: string; valor: string; tono?: "ambar" | "rojo" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icono className="size-4" />
        {titulo}
      </div>
      <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", tono === "ambar" && "text-amber-600", tono === "rojo" && "text-red-600")}>{valor}</p>
    </div>
  );
}

export default async function MaquileroDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const puedeVerPagos = tienePermiso(perfil, "produccion.pagos_maquila");
  const supabase = await createClient();

  const [{ data: maquilero }, { data: lotes }, { data: entregasData }, { data: modelos }, { data: tallas }, { data: perfiles }] = await Promise.all([
    supabase.from("maquileros").select("*").eq("id", id).single(),
    supabase.from("lotes_produccion").select("id, folio, estatus, cerrada_con_faltantes, created_at").eq("maquilero_id", id).order("created_at", { ascending: false }),
    supabase
      .from("entregas_produccion")
      .select("*, entrega_produccion_items(item_orden_id, cantidad)")
      .eq("maquilero_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo, orden"),
    supabase.from("perfiles").select("id, nombre_completo"),
  ]);
  if (!maquilero) notFound();

  const loteIds = (lotes ?? []).map((l) => l.id);
  const [{ data: items }, { data: pagosData }, { data: banco }] = await Promise.all([
    loteIds.length ? supabase.from("items_orden_produccion").select("*").in("lote_id", loteIds) : Promise.resolve({ data: [] }),
    puedeVerPagos ? supabase.from("pagos_maquila").select("*").eq("maquilero_id", id).neq("estatus", "cancelado").order("fecha_programada") : Promise.resolve({ data: null }),
    puedeVerPagos ? supabase.from("maquileros_datos_bancarios").select("*").eq("maquilero_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const entregas = (entregasData ?? []) as EntregaConItems[];
  const entregadoPorItem = calcularEntregado(entregas);
  const folioDe = (loteId: string) => lotes?.find((l) => l.id === loteId)?.folio ?? "—";
  const nombreModelo = (mid: string) => modelos?.find((m) => m.id === mid)?.nombre ?? "—";
  const codigoTalla = (tid: string) => tallas?.find((t) => t.id === tid)?.codigo ?? "—";
  const ordenTalla = (tid: string) => tallas?.find((t) => t.id === tid)?.orden ?? 0;
  const textoItem = (itemId: string) => {
    const it = (items ?? []).find((i) => i.id === itemId);
    return it ? `${nombreModelo(it.modelo_id)} ${codigoTalla(it.talla_id)}` : "—";
  };
  const nombrePerfil = (pid: string) => perfiles?.find((p) => p.id === pid)?.nombre_completo ?? "—";
  const pagoDe = new Map((pagosData ?? []).map((p) => [p.entrega_id, p]));

  const vigentes = entregas.filter((e) => e.estatus === "registrada");
  const piezasEntregadas = vigentes.reduce((acc, e) => acc + e.entrega_produccion_items.reduce((a, i) => a + i.cantidad, 0), 0);
  const abiertas = (lotes ?? []).filter((l) => l.estatus === "planeada" || l.estatus === "en_proceso");
  const pendientePorOrden = abiertas.map((l) => ({
    lote: l,
    filas: (items ?? [])
      .filter((i) => i.lote_id === l.id)
      .map((i) => ({ item: i, entregado: entregadoPorItem.get(i.id) ?? 0, pendiente: Math.max(0, i.cantidad_planeada - (entregadoPorItem.get(i.id) ?? 0)) }))
      .sort((a, b) => nombreModelo(a.item.modelo_id).localeCompare(nombreModelo(b.item.modelo_id), "es") || ordenTalla(a.item.talla_id) - ordenTalla(b.item.talla_id)),
  }));
  const piezasPendientes = pendientePorOrden.reduce((acc, o) => acc + o.filas.reduce((a, f) => a + f.pendiente, 0), 0);

  const hoy = hoyMexico();
  const pendientes = (pagosData ?? []).filter((p) => p.estatus === "pendiente");
  const porPagar = pendientes.reduce((acc, p) => acc + Number(p.monto), 0);
  const vencido = pendientes.filter((p) => p.fecha_programada < hoy).reduce((acc, p) => acc + Number(p.monto), 0);
  const pagado = (pagosData ?? []).filter((p) => p.estatus === "pagado").reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <div className="space-y-8">
      <Link href="/produccion/maquileros" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" />
        Maquileros
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{maquilero.nombre}</h1>
          <Badge variant={maquilero.activo ? "default" : "secondary"}>{maquilero.activo ? "Activo" : "Inactivo"}</Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {maquilero.telefono && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {maquilero.telefono}
            </span>
          )}
          {puedeVerPagos && banco && (banco.banco || banco.clabe) && (
            <span>
              {banco.banco} {banco.clabe && <span className="font-mono">{banco.clabe}</span>}
            </span>
          )}
          {maquilero.notas && <span>{maquilero.notas}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato icono={PackageCheck} titulo="Piezas entregadas" valor={piezasEntregadas.toLocaleString("es-MX")} />
        <Dato icono={Hourglass} titulo="Por entregar" valor={piezasPendientes.toLocaleString("es-MX")} tono={piezasPendientes > 0 ? "ambar" : undefined} />
        {puedeVerPagos && <Dato icono={Wallet} titulo="Le debes" valor={formatearMoneda(porPagar)} tono={vencido > 0 ? "rojo" : porPagar > 0 ? "ambar" : undefined} />}
        {puedeVerPagos && <Dato icono={Wallet} titulo="Ya pagado" valor={formatearMoneda(pagado)} />}
      </div>

      {puedeVerPagos && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Lo que le debes y cuándo</h2>
            <Link href="/produccion/pagos" className="text-sm text-primary hover:underline">
              Ir a Pagos
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Entrega</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Fecha de pago</TableHead>
                  <TableHead className="pr-4 text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientes.map((p) => {
                  const e = entregas.find((x) => x.id === p.entrega_id);
                  const vence = p.fecha_programada < hoy;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">{e ? formatearFechaCorta(e.fecha) : "—"}</TableCell>
                      <TableCell>{e ? folioDe(e.lote_id) : "—"}</TableCell>
                      <TableCell className={cn(vence && "font-medium text-red-600")}>
                        {formatearFechaCorta(p.fecha_programada)}
                        {vence && " · vencido"}
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{formatearMoneda(Number(p.monto))}</TableCell>
                    </TableRow>
                  );
                })}
                {!pendientes.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      No le debes nada por ahora.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pendiente por entregar</h2>
        {pendientePorOrden.length ? (
          pendientePorOrden.map(({ lote, filas }) => (
            <div key={lote.id} className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <Link href={`/produccion/${lote.id}`} className="font-medium hover:underline">
                  {lote.folio}
                </Link>
                <Badge className={CLASE_ESTATUS_ORDEN[lote.estatus]}>{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Producto</TableHead>
                    <TableHead>Talla</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Entregado</TableHead>
                    <TableHead className="pr-4 text-right">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => (
                    <TableRow key={f.item.id}>
                      <TableCell className="pl-4">{nombreModelo(f.item.modelo_id)}</TableCell>
                      <TableCell>{codigoTalla(f.item.talla_id)}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.item.cantidad_planeada}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.entregado}</TableCell>
                      <TableCell className={cn("pr-4 text-right tabular-nums", f.pendiente > 0 ? "font-semibold text-amber-600" : "text-emerald-600")}>{f.pendiente > 0 ? f.pendiente : "Completo"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No tiene órdenes abiertas.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lo que ha entregado</h2>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Fecha</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Piezas por talla</TableHead>
                <TableHead>Recibió</TableHead>
                {puedeVerPagos && <TableHead className="pr-4 text-right">Pago</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entregas.map((e) => {
                const pago = pagoDe.get(e.id);
                const cancelada = e.estatus === "cancelada";
                return (
                  <TableRow key={e.id} className={cn(cancelada && "text-muted-foreground")}>
                    <TableCell className={cn("pl-4 whitespace-nowrap", cancelada && "line-through")}>{formatearFechaCorta(e.fecha)}</TableCell>
                    <TableCell>
                      <Link href={`/produccion/${e.lote_id}`} className="hover:underline">
                        {folioDe(e.lote_id)}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-64 whitespace-normal">
                      {e.entrega_produccion_items.map((i) => `${i.cantidad} ${textoItem(i.item_orden_id)}`).join(", ")}
                      {cancelada && <Badge variant="secondary" className="ml-2">Cancelada</Badge>}
                    </TableCell>
                    <TableCell>{nombrePerfil(e.recibido_por)}</TableCell>
                    {puedeVerPagos && (
                      <TableCell className="pr-4 text-right">
                        {pago ? (
                          <span className={cn("tabular-nums", pago.estatus === "pagado" ? "text-emerald-600" : "text-amber-600")}>
                            {formatearMoneda(Number(pago.monto))} · {pago.estatus === "pagado" ? "pagado" : `vence ${formatearFechaCorta(pago.fecha_programada)}`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {!entregas.length && (
                <TableRow>
                  <TableCell colSpan={puedeVerPagos ? 5 : 4} className="py-6 text-center text-muted-foreground">
                    Todavía no ha entregado nada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
