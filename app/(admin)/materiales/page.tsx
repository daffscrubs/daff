import { createClient } from "@/lib/supabase/server";
import { NuevoMaterialDialog } from "@/components/materiales/NuevoMaterialDialog";
import { MaterialesTable } from "@/components/materiales/MaterialesTable";

export default async function MaterialesPage() {
  const supabase = await createClient();
  const { data: materiales } = await supabase.from("materiales").select("*").order("nombre");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materiales</h1>
          <p className="text-muted-foreground">Telas, hilos y accesorios, con su stock actual.</p>
        </div>
        <NuevoMaterialDialog />
      </div>

      <MaterialesTable materiales={materiales ?? []} />
    </div>
  );
}
