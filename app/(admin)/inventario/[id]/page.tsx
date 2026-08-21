import { notFound } from "next/navigation";
import Link from "next/link";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { DetalleProducto } from "@/components/inventario/DetalleProducto";

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalle = await obtenerDetalleModelo(id);

  if (!detalle.modelo) notFound();

  return (
    <div className="space-y-6">
      <Link href="/inventario" className="text-sm text-muted-foreground hover:underline">
        ← Inventario
      </Link>
      <DetalleProducto detalle={detalle} />
    </div>
  );
}
