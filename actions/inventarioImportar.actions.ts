"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { filaVarianteImportadaSchema, type FilaVarianteImportada } from "@/lib/validaciones/inventarioImportar.schema";
import { accionError, accionOk, type AccionResultado } from "@/lib/tipos/accion";
import { normalizarTexto } from "@/lib/texto";

export interface ResultadoImportacion {
  creados: number;
  /** Productos que ya existían en el sistema (mismo nombre) y se dejaron como estaban. */
  omitidos: number;
  /** Piezas que entraron al inventario, por ubicación. */
  piezasPorUbicacion: { ubicacion: string; piezas: number }[];
  errores: { fila: number; mensaje: string }[];
}

// Encabezados ya normalizados (sin acentos, minúsculas). Se aceptan tanto el
// formato de Pulpos (hoja "Inventario", encabezados en la fila 3) como el de la
// plantilla anterior (hoja "Productos", encabezados en la fila 1).
const COL_NOMBRE = ["nombre del producto"];
const COL_CATEGORIA = ["categoria"];
const COL_TALLA = ["variantes de tamano", "variante de tamano (talla)"];
const COL_STOCK_SIMPLE = ["stock"];
const COL_COSTO = ["costo"];
const COL_PRECIO = ["precio publico", "precio de venta"];

const MAX_FILAS_ENCABEZADO = 10;
const TAMANO_LOTE = 500;

/** Texto visible de una celda: Pulpos guarda los textos con formato (richText), que String() convertiría en "[object Object]". */
function valorCelda(celda: ExcelJS.Cell): unknown {
  const valor = celda.value;
  if (valor == null || typeof valor !== "object" || valor instanceof Date) return valor;
  if ("richText" in valor) return valor.richText.map((parte) => parte.text).join("");
  if ("result" in valor) return valor.result;
  if ("text" in valor) return valor.text;
  return undefined;
}

function leerTexto(fila: ExcelJS.Row, col: number): string | undefined {
  if (col === -1) return undefined;
  const valor = valorCelda(fila.getCell(col));
  if (valor == null) return undefined;
  const texto = String(valor).trim();
  return texto || undefined;
}

function leerNumero(fila: ExcelJS.Row, col: number): number | undefined {
  if (col === -1) return undefined;
  const valor = valorCelda(fila.getCell(col));
  if (valor == null || valor === "") return undefined;
  const num = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(num) ? num : NaN;
}

function dividirEnLotes<T>(lista: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
  return lotes;
}

export async function importarProductosExcel(formData: FormData): Promise<AccionResultado<ResultadoImportacion>> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return accionError("Selecciona un archivo");

  const supabase = await createClient();
  const [{ data: tallasCatalogo }, { data: modelosExistentes }, { data: ubicaciones }] = await Promise.all([
    supabase.from("tallas").select("id, codigo"),
    supabase.from("modelos").select("nombre"),
    supabase.from("ubicaciones").select("id, nombre").eq("activa", true).order("orden").order("nombre"),
  ]);
  const tallaIdPorCodigo = new Map((tallasCatalogo ?? []).map((t) => [t.codigo.trim().toUpperCase(), t.id]));
  const nombresExistentes = new Set((modelosExistentes ?? []).map((m) => normalizarTexto(m.nombre.trim())));
  const nombreUbicacion = new Map((ubicaciones ?? []).map((u) => [u.id, u.nombre]));

  const libro = new ExcelJS.Workbook();
  const bytes = Buffer.from(await archivo.arrayBuffer());
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exceljs's own .d.ts shadows the global Buffer type with a broken local stub
    await libro.xlsx.load(bytes as any);
  } catch {
    return accionError("No se pudo leer el archivo. Asegúrate de subir un .xlsx (la plantilla o la exportación de Pulpos).");
  }

  const hoja = libro.getWorksheet("Inventario") ?? libro.getWorksheet("Productos") ?? libro.worksheets[0];
  if (!hoja) return accionError("No se encontró ninguna hoja en el archivo.");

  // Los encabezados están en la fila 3 en el formato de Pulpos y en la 1 en la
  // plantilla anterior: se busca la primera fila (de las de arriba) que tenga
  // la columna del nombre.
  let filaEncabezados = 0;
  let encabezados: string[] = [];
  for (let n = 1; n <= MAX_FILAS_ENCABEZADO && !filaEncabezados; n++) {
    const candidatos: string[] = [];
    hoja.getRow(n).eachCell({ includeEmpty: false }, (celda, colNumero) => {
      candidatos[colNumero] = normalizarTexto(String(valorCelda(celda) ?? "").trim());
    });
    if (COL_NOMBRE.some((c) => candidatos.includes(c))) {
      filaEncabezados = n;
      encabezados = candidatos;
    }
  }
  if (!filaEncabezados) {
    return accionError('El archivo no tiene la columna "Nombre del Producto". Descarga la plantilla más reciente.');
  }

  const buscarColumna = (nombres: string[]) => {
    for (const nombre of nombres) {
      const col = encabezados.indexOf(nombre);
      if (col !== -1) return col;
    }
    return -1;
  };

  const colNombre = buscarColumna(COL_NOMBRE);
  const colCategoria = buscarColumna(COL_CATEGORIA);
  const colTalla = buscarColumna(COL_TALLA);
  const colCosto = buscarColumna(COL_COSTO);
  const colPrecio = buscarColumna(COL_PRECIO);

  // Existencias por ubicación: cada ubicación del sistema toma su propia
  // columna ("Stock Total Acapol", "Stock Zona Industrial"...). Las que no
  // tienen ubicación en el sistema (p. ej. Tizapa) simplemente no se cargan.
  const columnasStock: { ubicacionId: string; col: number }[] = [];
  for (const u of ubicaciones ?? []) {
    const nombre = normalizarTexto(u.nombre.trim());
    const col = buscarColumna([`stock total ${nombre}`, `stock ${nombre}`]);
    if (col !== -1) columnasStock.push({ ubicacionId: u.id, col });
  }
  // Plantilla anterior: una sola columna "Stock" que va a la primera ubicación.
  if (!columnasStock.length && ubicaciones?.length) {
    const col = buscarColumna(COL_STOCK_SIMPLE);
    if (col !== -1) columnasStock.push({ ubicacionId: ubicaciones[0].id, col });
  }

  const errores: { fila: number; mensaje: string }[] = [];
  const filas: { datos: FilaVarianteImportada; fila: number; stock: Map<string, number> }[] = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila <= filaEncabezados) return;

    const nombre = leerTexto(fila, colNombre);
    const hayContenido = (fila.values as unknown[] | undefined)?.some((v) => v != null && v !== "");
    if (!nombre) {
      if (hayContenido) errores.push({ fila: numeroFila, mensaje: "Falta el nombre del producto" });
      return;
    }

    const tallaTexto = leerTexto(fila, colTalla);
    const tallaId = tallaTexto ? tallaIdPorCodigo.get(tallaTexto.toUpperCase()) : undefined;
    if (tallaTexto && !tallaId) {
      errores.push({ fila: numeroFila, mensaje: `La talla "${tallaTexto}" no existe en el catálogo` });
      return;
    }

    const stock = new Map<string, number>();
    for (const { ubicacionId, col } of columnasStock) {
      const cantidad = leerNumero(fila, col);
      if (Number.isNaN(cantidad)) {
        errores.push({ fila: numeroFila, mensaje: `Stock en ${nombreUbicacion.get(ubicacionId)} no es un número válido` });
        return;
      }
      // Se guarda tal cual (incluso negativo: Pulpos permite existencias negativas) para
      // poder sumarlo con las demás filas del mismo producto y talla; solo lo que
      // quede por encima de cero genera existencias.
      if (cantidad !== undefined) stock.set(ubicacionId, cantidad);
    }

    const costoUnitario = leerNumero(fila, colCosto);
    const precioVenta = leerNumero(fila, colPrecio);
    if (Number.isNaN(costoUnitario)) {
      errores.push({ fila: numeroFila, mensaje: "Costo no es un número válido" });
      return;
    }
    if (Number.isNaN(precioVenta)) {
      errores.push({ fila: numeroFila, mensaje: "Precio de venta no es un número válido" });
      return;
    }

    const parseo = filaVarianteImportadaSchema.safeParse({
      nombre,
      categoria: leerTexto(fila, colCategoria),
      tallaId,
      costoUnitario,
      precioVenta,
    });
    if (!parseo.success) {
      errores.push({ fila: numeroFila, mensaje: parseo.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }
    filas.push({ datos: parseo.data, fila: numeroFila, stock });
  });

  type Producto = {
    nombre: string;
    categoria?: string;
    costoUnitario?: number;
    precioVenta?: number;
    primeraFila: number;
    variantes: { tallaId: string; precioVenta?: number; stock: Map<string, number> }[];
  };
  const productos = new Map<string, Producto>();

  for (const { datos, fila, stock } of filas) {
    const clave = normalizarTexto(datos.nombre);
    let producto = productos.get(clave);
    if (!producto) {
      producto = { nombre: datos.nombre, primeraFila: fila, variantes: [] };
      productos.set(clave, producto);
    }
    if (producto.categoria === undefined && datos.categoria) producto.categoria = datos.categoria;
    if (producto.costoUnitario === undefined && datos.costoUnitario !== undefined) producto.costoUnitario = datos.costoUnitario;
    if (producto.precioVenta === undefined && datos.precioVenta !== undefined) producto.precioVenta = datos.precioVenta;

    if (datos.tallaId) {
      const existente = producto.variantes.find((v) => v.tallaId === datos.tallaId);
      if (!existente) {
        producto.variantes.push({ tallaId: datos.tallaId, precioVenta: datos.precioVenta, stock: new Map(stock) });
      } else {
        // Mismo producto y talla en otra fila (en Pulpos suele ser otro color, que aquí no se
        // maneja): sus existencias se suman en vez de perderse.
        for (const [ubicacionId, cantidad] of stock) {
          existente.stock.set(ubicacionId, (existente.stock.get(ubicacionId) ?? 0) + cantidad);
        }
      }
    }
  }

  // Un producto que ya existe se deja tal cual: volver a subir el mismo
  // archivo no debe duplicarlo ni sumarle existencias por segunda vez.
  let omitidos = 0;
  const porCrear: Producto[] = [];
  for (const [clave, producto] of productos) {
    if (nombresExistentes.has(clave)) omitidos++;
    else porCrear.push(producto);
  }

  // Todo se guarda por lotes (un INSERT por cada cientos de filas) en vez de
  // un viaje a la base por producto: un catálogo de cientos de productos con
  // tallas y existencias sería, de lo contrario, demasiado lento.
  let creados = 0;
  const piezasPorUbicacion = new Map<string, number>();
  for (const lote of dividirEnLotes(porCrear, TAMANO_LOTE)) {
    const { data: modelos, error } = await supabase
      .from("modelos")
      .insert(
        lote.map((p) => ({
          nombre: p.nombre,
          categoria: p.categoria || null,
          costo_unitario: p.costoUnitario ?? null,
          precio_venta: p.precioVenta ?? null,
        }))
      )
      .select("id, nombre");

    if (error || !modelos) {
      errores.push({
        fila: lote[0].primeraFila,
        mensaje: `No se pudieron crear ${lote.length} productos (desde "${lote[0].nombre}"): ${error?.message ?? "Error desconocido"}`,
      });
      continue;
    }

    const idPorNombre = new Map(modelos.map((m) => [normalizarTexto(m.nombre), m.id]));
    const tallasPorInsertar: { modelo_id: string; talla_id: string; precio_venta: number | null }[] = [];
    const movimientos: {
      modelo_id: string;
      talla_id: string;
      ubicacion_id: string;
      tipo: "entrada";
      cantidad: number;
      motivo: string;
      registrado_por: string;
    }[] = [];

    for (const producto of lote) {
      const modeloId = idPorNombre.get(normalizarTexto(producto.nombre));
      if (!modeloId) {
        errores.push({ fila: producto.primeraFila, mensaje: `"${producto.nombre}" no se pudo confirmar tras crearlo` });
        continue;
      }
      creados++;
      for (const v of producto.variantes) {
        tallasPorInsertar.push({ modelo_id: modeloId, talla_id: v.tallaId, precio_venta: v.precioVenta ?? null });
        for (const [ubicacionId, cantidad] of v.stock) {
          if (cantidad <= 0) continue;
          movimientos.push({
            modelo_id: modeloId,
            talla_id: v.tallaId,
            ubicacion_id: ubicacionId,
            tipo: "entrada",
            cantidad,
            motivo: "Carga inicial por importación de Excel",
            registrado_por: perfil.id,
          });
        }
      }
    }

    for (const parte of dividirEnLotes(tallasPorInsertar, TAMANO_LOTE)) {
      const { error: errorTallas } = await supabase.from("modelo_tallas").insert(parte);
      if (errorTallas) {
        errores.push({ fila: lote[0].primeraFila, mensaje: `Fallaron las tallas de ${parte.length} variantes: ${errorTallas.message}` });
      }
    }
    for (const parte of dividirEnLotes(movimientos, TAMANO_LOTE)) {
      const { error: errorStock } = await supabase.from("movimientos_stock_producto").insert(parte);
      if (errorStock) {
        errores.push({ fila: lote[0].primeraFila, mensaje: `Fallaron las existencias iniciales de ${parte.length} variantes: ${errorStock.message}` });
        continue;
      }
      for (const m of parte) piezasPorUbicacion.set(m.ubicacion_id, (piezasPorUbicacion.get(m.ubicacion_id) ?? 0) + m.cantidad);
    }
  }

  revalidatePath("/inventario");
  return accionOk({
    creados,
    omitidos,
    piezasPorUbicacion: (ubicaciones ?? []).map((u) => ({ ubicacion: u.nombre, piezas: piezasPorUbicacion.get(u.id) ?? 0 })),
    errores,
  });
}
