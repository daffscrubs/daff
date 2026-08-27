import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { EtiquetaUnidadMaterial, type EtiquetaUnidadPDF } from "@/lib/pdf/EtiquetaUnidadMaterial";

// El nombre del material no tiene límite de longitud en la base, pero la
// etiqueta física sí (62x30mm reales — el PDF no crece, un nombre largo
// simplemente se saldría de la hoja al imprimir). Se recorta aquí, antes de
// mandarlo al PDF, a lo que cabe cómodo en 2 líneas junto al QR.
const LARGO_MAXIMO_NOMBRE = 34;
function truncarNombre(nombre: string): string {
  if (nombre.length <= LARGO_MAXIMO_NOMBRE) return nombre;
  return nombre.slice(0, LARGO_MAXIMO_NOMBRE - 1).trimEnd() + "…";
}

// Recibe ?ids=uuid1,uuid2,uuid3 (las unidades que salieron de una misma
// compra, por ejemplo) y regresa un solo PDF con una etiqueta 62x30mm por
// unidad, en el mismo orden en que se pidieron, listo para imprimir de un
// jalón y recortar.
export async function GET(req: Request) {
  await requerirPerfil(["admin", "supervisor"]);
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!ids.length) return new Response("Faltan los ids de las unidades (?ids=...)", { status: 400 });

  const supabase = await createClient();
  const { data: unidades, error } = await supabase
    .from("unidades_material")
    .select("id, codigo, numero_unidad, cantidad_inicial, materiales(nombre, unidad_medida)")
    .in("id", ids);

  if (error) return new Response(error.message, { status: 500 });
  if (!unidades?.length) return new Response("No se encontraron unidades con esos ids", { status: 404 });

  // .in() no garantiza el orden de vuelta; se reordena según se pidió.
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const ordenadas = ids.map((id) => porId.get(id)).filter((u): u is NonNullable<typeof u> => !!u);

  const etiquetas: EtiquetaUnidadPDF[] = await Promise.all(
    ordenadas.map(async (u) => ({
      codigo: u.codigo,
      qrDataUrl: await QRCode.toDataURL(u.codigo, { margin: 0, width: 300 }),
      nombreMaterial: truncarNombre(u.materiales?.nombre ?? "—"),
      numeroUnidad: u.numero_unidad,
      cantidadInicial: u.cantidad_inicial,
      unidadMedida: u.materiales?.unidad_medida ?? "",
    }))
  );

  const buffer = await renderToBuffer(EtiquetaUnidadMaterial({ etiquetas }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="etiquetas-unidades.pdf"',
    },
  });
}
