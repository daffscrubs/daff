import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ComprasTable } from "@/components/compras/ComprasTable";

export default async function ComprasPage() {
  const supabase = await createClient();
  const [{ data: compras }, { data: items }, { data: materiales }] = await Promise.all([
    supabase.from("compras").select("*").order("fecha", { ascending: false }),
    supabase.from("compra_items").select("*"),
    supabase.from("materiales").select("*"),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button render={<Link href="/compras/nueva" />} nativeButton={false}>Nueva compra</Button>
      </div>
      <ComprasTable compras={compras ?? []} items={items ?? []} materiales={materiales ?? []} />
    </div>
  );
}
