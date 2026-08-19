import { createClient } from "@/lib/supabase/server";
import { FormCompra } from "@/components/compras/FormCompra";

export default async function NuevaCompraPage() {
  const supabase = await createClient();
  const { data: materiales } = await supabase.from("materiales").select("*").order("nombre");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Nueva compra</h2>
        <p className="text-sm text-muted-foreground">
          Al registrar la compra se suma automáticamente al inventario y se actualiza el costo del material.
        </p>
      </div>
      <FormCompra materiales={materiales ?? []} />
    </div>
  );
}
