import { createClient } from "@/lib/supabase/server";
import { NuevoClienteDialog } from "@/components/clientes/NuevoClienteDialog";
import { ClientesTable } from "@/components/clientes/ClientesTable";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre_comercial");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-muted-foreground">Datos comerciales y contacto de tus clientes.</p>
        </div>
        <NuevoClienteDialog />
      </div>

      <ClientesTable clientes={clientes ?? []} />
    </div>
  );
}
