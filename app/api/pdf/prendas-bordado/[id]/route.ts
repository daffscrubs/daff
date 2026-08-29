import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { TicketPrendaBordado, type TicketPrendaBordadoPDF } from "@/lib/pdf/TicketPrendaBordado";
import { formatearFechaSolo } from "@/lib/fechas";

// Ninguno de estos campos tiene límite de longitud en la base, pero el
// ticket físico sí (80x50mm reales) -- se recortan aquí antes de mandarlos
// al PDF, igual que ya hace el label de unidades de materia prima con el
// nombre del material.
function truncar(texto: string, largoMaximo: number): string {
  if (texto.length <= largoMaximo) return texto;
  return texto.slice(0, largoMaximo - 1).trimEnd() + "…";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirPerfil();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: prenda, error }, { data: detalles, error: errorDetalles }] = await Promise.all([
    supabase.from("prendas_bordado").select("*").eq("id", id).single(),
    supabase.from("detalles_bordado").select("*").eq("prenda_id", id).order("created_at"),
  ]);

  if (error) return new Response(error.message, { status: 500 });
  if (!prenda) return new Response("No se encontró la prenda", { status: 404 });
  if (errorDetalles) return new Response(errorDetalles.message, { status: 500 });

  const ticket: TicketPrendaBordadoPDF = {
    folio: prenda.folio,
    qrDataUrl: await QRCode.toDataURL(prenda.folio, { margin: 0, width: 300 }),
    descripcion: truncar(prenda.descripcion, 40),
    clienteNombre: truncar(prenda.cliente_nombre, 28),
    clienteTelefono: prenda.cliente_telefono,
    fechaEntregaCompromiso: formatearFechaSolo(prenda.fecha_entrega_compromiso),
    bordados: (detalles ?? []).map((d) => ({
      ubicacion: truncar(d.ubicacion, 20),
      tipo: d.tipo,
      descripcion: truncar(d.descripcion, 30),
    })),
  };

  const buffer = await renderToBuffer(TicketPrendaBordado({ ticket }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${prenda.folio}.pdf"`,
    },
  });
}
