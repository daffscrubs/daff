import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProduccionTable } from "@/components/produccion/ProduccionTable";

export default async function ProduccionPage() {
  const supabase = await createClient();
  const [{ data: lotes }, { data: items }, { data: modelos }, { data: tallas }] = await Promise.all([
    supabase.from("lotes_produccion").select("*").order("created_at", { ascending: false }),
    supabase.from("items_orden_produccion").select("*"),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="text-muted-foreground">Órdenes de producción y su avance por etapa.</p>
        </div>
        <Button render={<Link href="/produccion/nuevo" />} nativeButton={false}>Nueva orden de producción</Button>
      </div>

      <ProduccionTable
        lotes={lotes ?? []}
        items={items ?? []}
        modelos={modelos ?? []}
        tallas={tallas ?? []}
      />
    </div>
  );
}
