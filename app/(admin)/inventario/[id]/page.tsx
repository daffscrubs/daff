import { notFound } from "next/navigation";
import { obtenerDetalleModelo } from "@/actions/detalle.actions";
import { DetalleProducto } from "@/components/inventario/DetalleProducto";

function firma(d: Awaited<ReturnType<typeof obtenerDetalleModelo>>) {
  return JSON.stringify([
    d.modelo?.nombre,
    d.modelo?.descripcion,
    d.modelo?.categoria,
    d.variantes,
    d.existencias.map((e) => [e.talla_id, e.ubicacion_id, e.cantidad_actual]),
  ]);
}

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalle = await obtenerDetalleModelo(id);

  if (!detalle.modelo) notFound();

  return (
    // La key cambia cuando cambian los datos guardados (tras guardar o traspasar), para que la
    // pantalla de edición arranque con lo que de verdad quedó en la base de datos.
    <DetalleProducto key={firma(detalle)} detalle={detalle} />
  );
}
