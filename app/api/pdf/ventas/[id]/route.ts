import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { tienePermiso } from "@/lib/permisos";
import { TicketVenta, type TicketVentaPDF } from "@/lib/pdf/TicketVenta";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await requerirPerfil();
  if (!tienePermiso(perfil, "modulo.pos") && !tienePermiso(perfil, "modulo.caja")) {
    return new Response("No tienes permiso para ver tickets de venta.", { status: 403 });
  }
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Venta inválida.", { status: 400 });

  const supabase = await createClient();
  const { data: venta, error } = await supabase
    .from("ventas")
    .select(
      "folio, created_at, subtotal, descuento, total, estatus, motivo_cancelacion, ubicaciones(nombre), vendedor:perfiles!ventas_vendedor_id_fkey(nombre_completo), clientes(nombre_comercial), venta_items(descripcion, cantidad, unidad, precio_unitario, importe), venta_pagos(metodo, monto, recibido)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!venta) return new Response("No se encontró la venta.", { status: 404 });

  const ticket: TicketVentaPDF = {
    folio: venta.folio,
    // Hora de México, no la del servidor.
    fecha: new Date(venta.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" }),
    ubicacion: venta.ubicaciones?.nombre ?? "",
    vendedor: venta.vendedor?.nombre_completo ?? "",
    cliente: venta.clientes?.nombre_comercial ?? null,
    cancelada: venta.estatus === "cancelada",
    motivoCancelacion: venta.motivo_cancelacion,
    partidas: venta.venta_items.map((i) => ({ descripcion: i.descripcion, cantidad: Number(i.cantidad), unidad: i.unidad, precioUnitario: Number(i.precio_unitario), importe: Number(i.importe) })),
    subtotal: Number(venta.subtotal),
    descuento: Number(venta.descuento),
    total: Number(venta.total),
    pagos: venta.venta_pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto), recibido: p.recibido === null ? null : Number(p.recibido) })),
  };

  const buffer = await renderToBuffer(TicketVenta({ ticket }));
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="ticket-${venta.folio}.pdf"` },
  });
}
