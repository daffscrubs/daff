import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormCompra } from "@/components/compras/FormCompra";

export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: compra }, { data: items }, { data: materiales }] = await Promise.all([
    supabase.from("compras").select("*").eq("id", id).single(),
    supabase.from("compra_items").select("*").eq("compra_id", id),
    supabase.from("materiales").select("*").order("nombre"),
  ]);

  if (!compra) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Editar {compra.folio}</h2>
        <p className="text-sm text-muted-foreground">
          Al guardar se ajusta el inventario: se revierte lo que sumó esta compra y se vuelve a aplicar con los datos nuevos.
        </p>
      </div>
      <FormCompra
        compraId={id}
        valoresIniciales={{
          proveedor: compra.proveedor,
          fecha: compra.fecha,
          notas: compra.notas ?? "",
          items: (items ?? []).map((item) => ({
            materialId: item.material_id,
            cantidad: item.cantidad,
            costoUnitario: item.costo_unitario,
          })),
        }}
        materiales={materiales ?? []}
      />
    </div>
  );
}
