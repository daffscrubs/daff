import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Hourglass, Mail, Phone, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditarClienteForm } from "@/components/clientes/EditarClienteForm";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PEDIDO } from "@/lib/estatus-colores";
import { ESTATUS_COMPRA, formatearTelefono, inicialesCliente } from "@/lib/clientes";
import { formatearMoneda } from "@/lib/dinero";
import { formatearFechaCorta, formatearFechaHoraMexico } from "@/lib/fechas";
import { cn } from "@/lib/utils";

function Dato({ icono: Icono, titulo, valor, tono }: { icono: typeof Wallet; titulo: string; valor: string; tono?: "ambar" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icono className="size-4" />
        {titulo}
      </div>
      <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", tono === "ambar" && "text-amber-600")}>{valor}</p>
    </div>
  );
}

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: pedidos }, { data: compras }, { data: resumen }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("pedidos").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
    supabase.rpc("fn_ventas_cliente", { p_cliente_id: id }),
    supabase.rpc("fn_resumen_clientes"),
  ]);

  if (!cliente) notFound();
  const mio = (resumen ?? []).find((r) => r.cliente_id === id);
  const total = Number(mio?.total ?? 0);
  const nCompras = Number(mio?.ventas ?? 0);
  const saldo = Number(mio?.saldo ?? 0);

  return (
    <div className="space-y-6">
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Clientes
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xl font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">{inicialesCliente(cliente.nombre_comercial)}</span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{cliente.nombre_comercial}</h1>
          {cliente.razon_social && <p className="text-muted-foreground">{cliente.razon_social}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {cliente.telefono && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {formatearTelefono(cliente.telefono)}
              </span>
            )}
            {cliente.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {cliente.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato icono={Wallet} titulo="Total comprado" valor={formatearMoneda(total)} />
        <Dato icono={ShoppingBag} titulo="Compras" valor={nCompras.toLocaleString("es-MX")} />
        <Dato icono={Receipt} titulo="Ticket promedio" valor={formatearMoneda(nCompras ? total / nCompras : 0)} />
        <Dato icono={Hourglass} titulo="Saldo por cobrar" valor={formatearMoneda(saldo)} tono={saldo > 0 ? "ambar" : undefined} />
      </div>

      <Tabs defaultValue="compras">
        <TabsList>
          <TabsTrigger value="compras">Compras ({(compras ?? []).length})</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos ({(pedidos ?? []).length})</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        <TabsContent value="compras">
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Venta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="pr-4">Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(compras ?? []).map((c) => {
                  const estatus = ESTATUS_COMPRA[c.estatus] ?? { etiqueta: c.estatus, clase: "" };
                  return (
                    <TableRow key={`${c.origen}-${c.referencia}`}>
                      <TableCell className="pl-4">
                        {c.venta_id ? (
                          <a href={`/api/pdf/ventas/${c.venta_id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                            {c.referencia}
                          </a>
                        ) : (
                          <span className="font-medium">{c.referencia}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">{c.origen === "historica" ? "Sistema anterior" : "Punto de venta"}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatearFechaHoraMexico(c.fecha)}</TableCell>
                      <TableCell>
                        <Badge className={estatus.clase}>{estatus.etiqueta}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatearMoneda(Number(c.total))}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatearMoneda(Number(c.pagado))}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", Number(c.saldo) > 0 ? "font-semibold text-amber-600" : "text-muted-foreground")}>{Number(c.saldo) > 0 ? formatearMoneda(Number(c.saldo)) : "—"}</TableCell>
                      <TableCell className="max-w-64 truncate pr-4 text-muted-foreground" title={c.nota ?? undefined}>
                        {c.nota ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!compras?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Este cliente todavía no tiene compras.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {mio?.ultima_compra && <p className="mt-2 text-xs text-muted-foreground">Última compra: {formatearFechaCorta(mio.ultima_compra)}.</p>}
        </TabsContent>

        <TabsContent value="pedidos">
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Folio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Compromiso</TableHead>
                  <TableHead className="pr-4">Estatus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos?.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="pl-4">
                      <Link href={`/pedidos/${pedido.id}`} className="font-medium hover:underline">
                        {pedido.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatearFechaCorta(pedido.fecha_pedido)}</TableCell>
                    <TableCell className="text-muted-foreground">{pedido.fecha_compromiso ? formatearFechaCorta(pedido.fecha_compromiso) : "—"}</TableCell>
                    <TableCell className="pr-4">
                      <Badge className={CLASE_ESTATUS_PEDIDO[pedido.estatus]}>{ESTATUS_PEDIDO_LABEL[pedido.estatus]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!pedidos?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin pedidos todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="datos">
          <div className="max-w-2xl rounded-xl border bg-card p-5 shadow-sm">
            <EditarClienteForm
              id={id}
              valoresIniciales={{
                nombreComercial: cliente.nombre_comercial,
                razonSocial: cliente.razon_social ?? "",
                rfc: cliente.rfc ?? "",
                contactoNombre: cliente.contacto_nombre ?? "",
                telefono: cliente.telefono ?? "",
                email: cliente.email ?? "",
                direccion: cliente.direccion ?? "",
                notas: cliente.notas ?? "",
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
