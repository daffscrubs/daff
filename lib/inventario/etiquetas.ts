import { formatearMoneda } from "@/lib/dinero";
import type { EtiquetaProductoPDF } from "@/lib/pdf/EtiquetaProducto";

// Lo que cabe en una etiqueta de 62mm junto a la talla (el PDF no crece: un nombre largo
// simplemente se saldría de la hoja al imprimir).
const LARGO_MAXIMO_NOMBRE = 30;
export const MAX_COPIAS = 50;

export function truncar(texto: string, largoMaximo: number): string {
  if (texto.length <= largoMaximo) return texto;
  return texto.slice(0, largoMaximo - 1).trimEnd() + "…";
}

interface ModeloEtiqueta { id: string; nombre: string; precio_venta: number | null }
interface TallaEtiqueta { id: string; codigo: string; orden: number }
interface VarianteEtiqueta { modelo_id: string; talla_id: string; precio_venta: number | null; codigo_barras: string | null }

/**
 * Una etiqueta por cada talla con código de barras de los productos dados (las tallas sin código
 * no se pueden etiquetar y se cuentan aparte), repetida `copias` veces. Ordenadas por producto
 * (alfabético) y luego por talla, para que salgan juntas las de un mismo producto.
 */
export function construirEtiquetas(
  modelos: ModeloEtiqueta[],
  tallas: TallaEtiqueta[],
  variantes: VarianteEtiqueta[],
  copias: number
): { etiquetas: EtiquetaProductoPDF[]; sinCodigo: number } {
  const modeloPorId = new Map(modelos.map((m) => [m.id, m]));
  const tallaPorId = new Map(tallas.map((t) => [t.id, t]));
  const delProducto = variantes.filter((v) => modeloPorId.has(v.modelo_id));
  const conCodigo = delProducto.filter((v) => v.codigo_barras?.trim());

  conCodigo.sort((a, b) => {
    const porNombre = modeloPorId.get(a.modelo_id)!.nombre.localeCompare(modeloPorId.get(b.modelo_id)!.nombre, "es");
    return porNombre || (tallaPorId.get(a.talla_id)?.orden ?? 0) - (tallaPorId.get(b.talla_id)?.orden ?? 0);
  });

  const etiquetas: EtiquetaProductoPDF[] = [];
  for (const v of conCodigo) {
    const modelo = modeloPorId.get(v.modelo_id)!;
    const precio = v.precio_venta ?? modelo.precio_venta;
    const etiqueta: EtiquetaProductoPDF = {
      nombre: truncar(modelo.nombre, LARGO_MAXIMO_NOMBRE),
      talla: truncar(tallaPorId.get(v.talla_id)?.codigo.trim() ?? "", 8),
      codigo: v.codigo_barras!.trim(),
      precio: precio ? formatearMoneda(precio) : null,
    };
    for (let c = 0; c < copias; c++) etiquetas.push(etiqueta);
  }
  return { etiquetas, sinCodigo: delProducto.length - conCodigo.length };
}
