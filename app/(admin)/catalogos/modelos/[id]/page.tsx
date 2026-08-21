import { notFound } from "next/navigation";
import Link from "next/link";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { DetalleModeloPagina } from "@/components/detalle/DetalleModeloPagina";

export default async function ModeloDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalle = await obtenerDetalleModelo(id);

  if (!detalle.modelo) notFound();

  return (
    <div className="space-y-6">
      <Link href="/catalogos/modelos" className="text-sm text-muted-foreground hover:underline">
        ← Catálogos / Modelos
      </Link>
      <DetalleModeloPagina detalle={detalle} />
    </div>
  );
}
