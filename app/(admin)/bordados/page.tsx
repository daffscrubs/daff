import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PrendasBordadoTable } from "@/components/bordados/PrendasBordadoTable";
import { EscanearPrendaDialog } from "@/components/bordados/EscanearPrendaDialog";

export default async function BordadosPage() {
  const supabase = await createClient();
  const { data: prendas } = await supabase
    .from("prendas_bordado")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prendas para bordar</h1>
          <p className="text-muted-foreground">Prendas que los clientes traen a la tienda para bordar.</p>
        </div>
        <div className="flex items-center gap-2">
          <EscanearPrendaDialog />
          <Button render={<Link href="/bordados/nueva" />} nativeButton={false}>
            Nueva prenda
          </Button>
        </div>
      </div>

      <PrendasBordadoTable prendas={prendas ?? []} />
    </div>
  );
}
