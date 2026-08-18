import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { NuevaEntregaDialog } from "@/components/entregas/NuevaEntregaDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ESTATUS_ENTREGA_LABEL } from "@/lib/labels";

export default async function EntregasPage() {
  const supabase = await createClient();
  const [{ data: entregas }, { data: pedidos }, { data: pedidosListos }] = await Promise.all([
    supabase.from("entregas").select("*").order("fecha_programada", { ascending: true }),
    supabase.from("pedidos").select("id, folio"),
    supabase.from("pedidos").select("*").eq("estatus", "listo"),
  ]);

  const folioPedido = (id: string) => pedidos?.find((p) => p.id === id)?.folio ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Entregas</h1>
          <p className="text-muted-foreground">Programación y seguimiento de entregas a clientes.</p>
        </div>
        <NuevaEntregaDialog pedidosListos={pedidosListos ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pedido</TableHead>
            <TableHead>Fecha programada</TableHead>
            <TableHead>Fecha real</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entregas?.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link href={`/entregas/${e.id}`} className="font-medium hover:underline">
                  {folioPedido(e.pedido_id)}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{e.fecha_programada}</TableCell>
              <TableCell className="text-muted-foreground">
                {e.fecha_real ? new Date(e.fecha_real).toLocaleDateString("es-MX") : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{ESTATUS_ENTREGA_LABEL[e.estatus]}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {!entregas?.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin entregas programadas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
