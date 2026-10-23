import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { NuevoClienteDialog } from "@/components/clientes/NuevoClienteDialog";
import { ClientesLista } from "@/components/clientes/ClientesLista";

export default async function ClientesPage() {
  const supabase = await createClient();
  const [{ data: clientes }, { data: resumen }] = await Promise.all([
    leerTodo((d, h) =>
      supabase.from("clientes").select("id, nombre_comercial, razon_social, contacto_nombre, telefono, email").order("nombre_comercial").order("id").range(d, h)
    ),
    supabase.rpc("fn_resumen_clientes"),
  ]);

  const porCliente = new Map((resumen ?? []).map((r) => [r.cliente_id, r]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground">Tus clientes, lo que han comprado y lo que te deben.</p>
        </div>
        <NuevoClienteDialog />
      </div>

      <ClientesLista
        clientes={clientes.map((c) => {
          const r = porCliente.get(c.id);
          return {
            id: c.id,
            nombre: c.nombre_comercial,
            razonSocial: c.razon_social,
            contacto: c.contacto_nombre,
            telefono: c.telefono,
            email: c.email,
            compras: Number(r?.ventas ?? 0),
            total: Number(r?.total ?? 0),
            ultimaCompra: r?.ultima_compra ?? null,
            saldo: Number(r?.saldo ?? 0),
          };
        })}
      />
    </div>
  );
}
