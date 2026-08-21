import { notFound } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EstatusPedidoSelect } from "@/components/pedidos/EstatusPedidoSelect";
import { BotonCancelarPedido } from "@/components/pedidos/BotonCancelarPedido";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatearMoneda } from "@/lib/dinero";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pedido }, { data: items }, { data: modelos }, { data: tallas }] =
    await Promise.all([
      supabase.from("pedidos").select("*, clientes(nombre_comercial)").eq("id", id).single(),
      supabase.from("items_pedido").select("*").eq("pedido_id", id),
      supabase.from("modelos").select("*"),
      supabase.from("tallas").select("*"),
    ]);

  if (!pedido) notFound();

  const cliente = pedido.clientes;
  const nombre = (id: string, lista: { id: string; nombre?: string; codigo?: string }[]) =>
    lista.find((x) => x.id === id)?.nombre ?? lista.find((x) => x.id === id)?.codigo ?? "—";
  const puedeModificar = pedido.estatus !== "cancelado";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pedido.folio}</h1>
          <p className="text-muted-foreground">
            Cliente:{" "}
            <Link href={`/clientes/${pedido.cliente_id}`} className="hover:underline">
              {cliente?.nombre_comercial ?? "—"}
            </Link>
            {" · "}Compromiso: {pedido.fecha_compromiso}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/api/pdf/pedidos/${id}`} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Descargar PDF
          </Button>
          {puedeModificar && (
            <Button variant="outline" size="sm" render={<Link href={`/pedidos/${id}/editar`} />} nativeButton={false}>
              Editar
            </Button>
          )}
          <EstatusPedidoSelect id={id} estatus={pedido.estatus} />
          {puedeModificar && <BotonCancelarPedido id={id} />}
        </div>
      </div>

      {pedido.notas && <p className="text-sm text-muted-foreground">{pedido.notas}</p>}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Productos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio unit.</TableHead>
              <TableHead>Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{nombre(item.modelo_id, modelos ?? [])}</TableCell>
                <TableCell>{nombre(item.talla_id, tallas ?? [])}</TableCell>
                <TableCell>{item.cantidad}</TableCell>
                <TableCell>{item.precio_unitario != null ? formatearMoneda(item.precio_unitario) : "—"}</TableCell>
                <TableCell>
                  {item.precio_unitario != null ? formatearMoneda(item.cantidad * item.precio_unitario) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!!items?.some((i) => i.precio_unitario != null) && (
          <p className="mt-2 text-right text-sm font-medium">
            Total: {formatearMoneda(items!.reduce((acc, i) => acc + i.cantidad * (i.precio_unitario ?? 0), 0))}
          </p>
        )}
      </div>
    </div>
  );
}
