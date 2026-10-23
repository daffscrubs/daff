import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { EtiquetaProducto } from "@/lib/pdf/EtiquetaProducto";
import { construirEtiquetas, MAX_POR_VARIANTE, MAX_TOTAL_ETIQUETAS, type PedidoEtiqueta } from "@/lib/inventario/etiquetas";

// Con cientos de etiquetas el PDF tarda más que el límite por defecto.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Una URL de PostgREST con cientos de ids se pasa del tamaño permitido: se consulta por tandas.
const TANDA = 100;
const tandas = <T,>(lista: T[]) => Array.from({ length: Math.ceil(lista.length / TANDA) }, (_, i) => lista.slice(i * TANDA, (i + 1) * TANDA));

function leerPedidos(crudo: unknown): PedidoEtiqueta[] | string {
  let datos: unknown;
  try {
    datos = JSON.parse(String(crudo ?? ""));
  } catch {
    return "No se entendió la lista de etiquetas.";
  }
  if (!Array.isArray(datos) || !datos.length) return "Elige al menos una etiqueta.";
  const pedidos: PedidoEtiqueta[] = [];
  for (const d of datos) {
    const cantidad = Number(d?.cantidad);
    if (!UUID.test(String(d?.modelo_id)) || !UUID.test(String(d?.talla_id)) || !Number.isInteger(cantidad)) {
      return "La lista de etiquetas tiene datos inválidos.";
    }
    if (cantidad < 1) continue;
    pedidos.push({ modelo_id: d.modelo_id, talla_id: d.talla_id, cantidad: Math.min(cantidad, MAX_POR_VARIANTE) });
  }
  if (!pedidos.length) return "Elige al menos una etiqueta.";
  return pedidos;
}

// Recibe un formulario (POST, para no chocar con el largo máximo de una URL cuando son muchos
// productos) con items = [{modelo_id, talla_id, cantidad}, ...] y regresa un solo PDF de
// etiquetas 62x25mm, que el navegador descarga directamente.
export async function POST(req: Request) {
  await requerirPerfil(["admin", "supervisor"]);
  const form = await req.formData();
  const pedidos = leerPedidos(form.get("items"));
  if (typeof pedidos === "string") return new Response(pedidos, { status: 400 });

  const total = pedidos.reduce((acc, p) => acc + p.cantidad, 0);
  if (total > MAX_TOTAL_ETIQUETAS) {
    return new Response(
      `Pediste ${total.toLocaleString("es-MX")} etiquetas y el máximo por PDF es ${MAX_TOTAL_ETIQUETAS.toLocaleString("es-MX")}. Créalas en partes.`,
      { status: 400 }
    );
  }

  const ids = [...new Set(pedidos.map((p) => p.modelo_id))];
  const supabase = await createClient();
  const [{ data: tallas, error: errorTallas }, ...resultados] = await Promise.all([
    supabase.from("tallas").select("id, codigo, orden"),
    ...tandas(ids).flatMap((grupo) => [
      supabase.from("modelos").select("id, nombre, categoria").in("id", grupo),
      supabase.from("modelo_tallas").select("modelo_id, talla_id, codigo_barras").in("modelo_id", grupo),
    ]),
  ]);
  const error = errorTallas ?? resultados.find((r) => r.error)?.error;
  if (error) return new Response(error.message, { status: 500 });

  const modelos = resultados.filter((_, i) => i % 2 === 0).flatMap((r) => (r.data ?? []) as { id: string; nombre: string; categoria: string | null }[]);
  const variantes = resultados.filter((_, i) => i % 2 === 1).flatMap((r) => (r.data ?? []) as { modelo_id: string; talla_id: string; codigo_barras: string | null }[]);

  const { etiquetas } = construirEtiquetas(modelos, tallas ?? [], variantes, pedidos);
  if (!etiquetas.length) {
    return new Response("Ninguna de las tallas elegidas tiene código de barras.", { status: 404 });
  }

  const buffer = await renderToBuffer(EtiquetaProducto({ etiquetas }));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // attachment: el navegador lo descarga directamente en vez de abrirlo en una pestaña.
      "Content-Disposition": 'attachment; filename="etiquetas-productos.pdf"',
    },
  });
}
