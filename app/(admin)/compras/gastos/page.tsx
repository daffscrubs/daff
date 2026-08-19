import { createClient } from "@/lib/supabase/server";
import { NuevoGastoDialog } from "@/components/compras/NuevoGastoDialog";
import { GastosTable } from "@/components/compras/GastosTable";

export default async function GastosPage() {
  const supabase = await createClient();
  const { data: gastos } = await supabase.from("gastos").select("*").order("fecha", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NuevoGastoDialog />
      </div>
      <GastosTable gastos={gastos ?? []} />
    </div>
  );
}
