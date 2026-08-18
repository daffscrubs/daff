import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";

export default async function PedidosPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: clientes }] = await Promise.all([
    supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
    supabase.from("clientes").select("id, nombre_comercial"),
  ]);

  const nombreCliente = (id: string) =>
    clientes?.find((c) => c.id === id)?.nombre_comercial ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-muted-foreground">Pedidos de clientes y su estatus.</p>
        </div>
        <Button render={<Link href="/pedidos/nuevo" />} nativeButton={false}>Nuevo pedido</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Compromiso</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pedidos?.map((pedido) => (
            <TableRow key={pedido.id}>
              <TableCell>
                <Link href={`/pedidos/${pedido.id}`} className="font-medium hover:underline">
                  {pedido.folio}
                </Link>
              </TableCell>
              <TableCell>{nombreCliente(pedido.cliente_id)}</TableCell>
              <TableCell className="text-muted-foreground">{pedido.fecha_compromiso}</TableCell>
              <TableCell>
                <Badge variant="secondary">{ESTATUS_PEDIDO_LABEL[pedido.estatus]}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {!pedidos?.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin pedidos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
