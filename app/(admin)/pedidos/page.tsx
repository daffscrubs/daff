import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import { totalesPorPedido } from "@/lib/pedidos/totales";

export default async function PedidosPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: clientes }, { data: items }] = await Promise.all([
    supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
    supabase.from("clientes").select("id, nombre_comercial"),
    supabase.from("items_pedido").select("*"),
  ]);

  const totales = totalesPorPedido(items ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-muted-foreground">Pedidos de clientes y su estatus.</p>
        </div>
        <Button render={<Link href="/pedidos/nuevo" />} nativeButton={false}>Nuevo pedido</Button>
      </div>

      <PedidosTable pedidos={pedidos ?? []} clientes={clientes ?? []} totales={totales} />
    </div>
  );
}
