import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditarClienteForm } from "@/components/clientes/EditarClienteForm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: pedidos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase
      .from("pedidos")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!cliente) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{cliente.nombre_comercial}</h1>
        <p className="text-muted-foreground">Datos del cliente e historial de pedidos.</p>
      </div>

      <div className="max-w-2xl">
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

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial de pedidos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Fecha</TableHead>
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
                <TableCell className="text-muted-foreground">{pedido.fecha_pedido}</TableCell>
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
    </div>
  );
}
