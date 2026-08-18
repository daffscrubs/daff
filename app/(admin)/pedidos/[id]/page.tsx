import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EstatusPedidoSelect } from "@/components/pedidos/EstatusPedidoSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pedido }, { data: items }, { data: modelos }, { data: tallas }, { data: variantes }] =
    await Promise.all([
      supabase.from("pedidos").select("*, clientes(nombre_comercial)").eq("id", id).single(),
      supabase.from("items_pedido").select("*").eq("pedido_id", id),
      supabase.from("modelos").select("*"),
      supabase.from("tallas").select("*"),
      supabase.from("variantes").select("*"),
    ]);

  if (!pedido) notFound();

  const cliente = pedido.clientes;
  const nombre = (id: string, lista: { id: string; nombre?: string; codigo?: string }[]) =>
    lista.find((x) => x.id === id)?.nombre ?? lista.find((x) => x.id === id)?.codigo ?? "—";

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
        <EstatusPedidoSelect id={id} estatus={pedido.estatus} />
      </div>

      {pedido.notas && <p className="text-sm text-muted-foreground">{pedido.notas}</p>}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Productos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Talla</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Precio unit.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{nombre(item.modelo_id, modelos ?? [])}</TableCell>
                <TableCell>{nombre(item.talla_id, tallas ?? [])}</TableCell>
                <TableCell>
                  {item.variante_id
                    ? (variantes ?? []).find((v) => v.id === item.variante_id)?.color ?? "—"
                    : "—"}
                </TableCell>
                <TableCell>{item.cantidad}</TableCell>
                <TableCell>{item.precio_unitario ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
