import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { EtiquetaProducto } from "@/lib/pdf/EtiquetaProducto";
import { construirEtiquetas, MAX_COPIAS } from "@/lib/inventario/etiquetas";

// Con cientos de etiquetas el PDF tarda más que el límite por defecto.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Una URL de PostgREST con cientos de ids se pasa del tamaño permitido: se consulta por tandas.
const TANDA = 100;
const tandas = <T,>(lista: T[]) => Array.from({ length: Math.ceil(lista.length / TANDA) }, (_, i) => lista.slice(i * TANDA, (i + 1) * TANDA));

// Recibe un formulario (POST, para no chocar con el largo máximo de una URL cuando son todos los
// productos) con modeloIds=uuid1,uuid2,... y copias=N, y regresa un solo PDF de etiquetas 62x25mm.
export async function POST(req: Request) {
  await requerirPerfil(["admin", "supervisor"]);
  const form = await req.formData();
  const ids = String(form.get("modeloIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return new Response("Selecciona al menos un producto.", { status: 400 });
  if (ids.some((id) => !UUID.test(id))) return new Response("Identificadores de producto inválidos.", { status: 400 });
  const copias = Math.min(MAX_COPIAS, Math.max(1, Math.floor(Number(form.get("copias")) || 1)));

  const supabase = await createClient();
  const [{ data: tallas, error: errorTallas }, ...resultados] = await Promise.all([
    supabase.from("tallas").select("id, codigo, orden"),
    ...tandas(ids).flatMap((grupo) => [
      supabase.from("modelos").select("id, nombre, precio_venta").in("id", grupo),
      supabase.from("modelo_tallas").select("modelo_id, talla_id, precio_venta, codigo_barras").in("modelo_id", grupo),
    ]),
  ]);
  const error = errorTallas ?? resultados.find((r) => r.error)?.error;
  if (error) return new Response(error.message, { status: 500 });

  const modelos = resultados.filter((_, i) => i % 2 === 0).flatMap((r) => (r.data ?? []) as { id: string; nombre: string; precio_venta: number | null }[]);
  const variantes = resultados.filter((_, i) => i % 2 === 1).flatMap((r) => (r.data ?? []) as { modelo_id: string; talla_id: string; precio_venta: number | null; codigo_barras: string | null }[]);

  const { etiquetas } = construirEtiquetas(modelos, tallas ?? [], variantes, copias);
  if (!etiquetas.length) {
    return new Response("Ninguno de los productos elegidos tiene código de barras en sus tallas.", { status: 404 });
  }

  const buffer = await renderToBuffer(EtiquetaProducto({ etiquetas }));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="etiquetas-productos.pdf"',
    },
  });
}
