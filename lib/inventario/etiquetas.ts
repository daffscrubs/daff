import type { EtiquetaProductoPDF } from "@/lib/pdf/EtiquetaProducto";

// Lo que cabe en una etiqueta de 62mm junto al logo (el PDF no crece: un nombre largo
// simplemente se saldría de la hoja al imprimir).
const LARGO_MAXIMO_NOMBRE = 32;
const LARGO_MAXIMO_CATEGORIA = 18;
// Talla que usa el sistema internamente para productos sin tallas: en la etiqueta no se imprime.
export const TALLA_SIN_TALLAS = "UNITALLA";

/** Máximo de etiquetas de una misma talla en un PDF. */
export const MAX_POR_VARIANTE = 500;
/** Máximo de etiquetas en un PDF: un PDF de miles de páginas se come la memoria del servidor; se piden en partes. */
export const MAX_TOTAL_ETIQUETAS = 2000;

export function truncar(texto: string, largoMaximo: number): string {
  if (texto.length <= largoMaximo) return texto;
  return texto.slice(0, largoMaximo - 1).trimEnd() + "…";
}

/** Una talla con la cantidad de etiquetas que se quieren de ella. */
export interface PedidoEtiqueta { modelo_id: string; talla_id: string; cantidad: number }

interface ModeloEtiqueta { id: string; nombre: string; categoria: string | null }
interface TallaEtiqueta { id: string; codigo: string; orden: number }
interface VarianteEtiqueta { modelo_id: string; talla_id: string; codigo_barras: string | null }

/**
 * Las etiquetas pedidas: por cada talla de cada producto, la cantidad que se quiere de ella.
 * Una talla sin código de barras no se puede etiquetar y se cuenta aparte. Salen ordenadas por
 * producto (alfabético) y luego por talla, para que las de un mismo producto queden juntas.
 */
export function construirEtiquetas(
  modelos: ModeloEtiqueta[],
  tallas: TallaEtiqueta[],
  variantes: VarianteEtiqueta[],
  pedidos: PedidoEtiqueta[]
): { etiquetas: EtiquetaProductoPDF[]; sinCodigo: number } {
  const modeloPorId = new Map(modelos.map((m) => [m.id, m]));
  const tallaPorId = new Map(tallas.map((t) => [t.id, t]));
  const cantidadPor = new Map<string, number>();
  for (const p of pedidos) {
    const clave = `${p.modelo_id}|${p.talla_id}`;
    cantidadPor.set(clave, (cantidadPor.get(clave) ?? 0) + p.cantidad);
  }

  const pedidas = variantes.filter((v) => modeloPorId.has(v.modelo_id) && (cantidadPor.get(`${v.modelo_id}|${v.talla_id}`) ?? 0) > 0);
  const conCodigo = pedidas.filter((v) => v.codigo_barras?.trim());

  conCodigo.sort((a, b) => {
    const porNombre = modeloPorId.get(a.modelo_id)!.nombre.localeCompare(modeloPorId.get(b.modelo_id)!.nombre, "es");
    return porNombre || (tallaPorId.get(a.talla_id)?.orden ?? 0) - (tallaPorId.get(b.talla_id)?.orden ?? 0);
  });

  const etiquetas: EtiquetaProductoPDF[] = [];
  for (const v of conCodigo) {
    const modelo = modeloPorId.get(v.modelo_id)!;
    const talla = tallaPorId.get(v.talla_id)?.codigo.trim() ?? "";
    const etiqueta: EtiquetaProductoPDF = {
      nombre: truncar(modelo.nombre, LARGO_MAXIMO_NOMBRE),
      categoria: modelo.categoria?.trim() ? truncar(modelo.categoria.trim(), LARGO_MAXIMO_CATEGORIA) : null,
      // Sin talla (o la talla interna UNITALLA) no se imprime nada en su lugar.
      talla: talla && talla.toUpperCase() !== TALLA_SIN_TALLAS ? truncar(talla, 10) : null,
      codigo: v.codigo_barras!.trim(),
    };
    const copias = cantidadPor.get(`${v.modelo_id}|${v.talla_id}`)!;
    for (let c = 0; c < copias; c++) etiquetas.push(etiqueta);
  }
  return { etiquetas, sinCodigo: pedidas.length - conCodigo.length };
}
