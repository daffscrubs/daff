"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { filaVarianteImportadaSchema, type FilaVarianteImportada } from "@/lib/validaciones/inventarioImportar.schema";

export interface ResultadoImportacion {
  creados: number;
  errores: { fila: number; mensaje: string }[];
}

const COL_NOMBRE = "NOMBRE DEL PRODUCTO";
const COL_CATEGORIA = "CATEGORIA";
const COL_TALLA = "VARIANTE DE TAMAÑO (TALLA)";
const COL_STOCK = "STOCK";
const COL_COSTO = "COSTO";
const COL_PRECIO = "PRECIO DE VENTA";

function leerTexto(fila: ExcelJS.Row, col: number): string | undefined {
  if (col === -1) return undefined;
  const valor = fila.getCell(col).value;
  if (valor == null) return undefined;
  const texto = String(valor).trim();
  return texto || undefined;
}

function leerNumero(fila: ExcelJS.Row, col: number): number | undefined {
  if (col === -1) return undefined;
  const valor = fila.getCell(col).value;
  if (valor == null || valor === "") return undefined;
  const num = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(num) ? num : NaN;
}

export async function importarProductosExcel(formData: FormData): Promise<ResultadoImportacion> {
  const perfil = await requerirPerfil(["admin", "supervisor"]);
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("Selecciona un archivo");

  const supabase = await createClient();
  const { data: tallasCatalogo } = await supabase.from("tallas").select("id, codigo");
  const tallaIdPorCodigo = new Map((tallasCatalogo ?? []).map((t) => [t.codigo.trim().toUpperCase(), t.id]));

  const libro = new ExcelJS.Workbook();
  const bytes = Buffer.from(await archivo.arrayBuffer());
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exceljs's own .d.ts shadows the global Buffer type with a broken local stub
    await libro.xlsx.load(bytes as any);
  } catch {
    throw new Error("No se pudo leer el archivo. Asegúrate de subir el .xlsx de la plantilla.");
  }

  const hoja = libro.getWorksheet("Productos") ?? libro.worksheets[0];
  if (!hoja) throw new Error('No se encontró la hoja "Productos" en el archivo.');

  const encabezados: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, colNumero) => {
    encabezados[colNumero] = String(celda.value ?? "").trim().toUpperCase();
  });

  const colNombre = encabezados.indexOf(COL_NOMBRE);
  const colCategoria = encabezados.indexOf(COL_CATEGORIA);
  const colTalla = encabezados.indexOf(COL_TALLA);
  const colStock = encabezados.indexOf(COL_STOCK);
  const colCosto = encabezados.indexOf(COL_COSTO);
  const colPrecio = encabezados.indexOf(COL_PRECIO);

  if (colNombre === -1) {
    throw new Error(`El archivo no tiene la columna "${COL_NOMBRE}". Descarga la plantilla más reciente.`);
  }

  const errores: { fila: number; mensaje: string }[] = [];
  const filas: { datos: FilaVarianteImportada; fila: number }[] = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;

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

    const stock = leerNumero(fila, colStock);
    const costoUnitario = leerNumero(fila, colCosto);
    const precioVenta = leerNumero(fila, colPrecio);
    if (Number.isNaN(stock)) {
      errores.push({ fila: numeroFila, mensaje: "Stock no es un número válido" });
      return;
    }
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
      stock,
      costoUnitario,
      precioVenta,
    });
    if (!parseo.success) {
      errores.push({ fila: numeroFila, mensaje: parseo.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }
    filas.push({ datos: parseo.data, fila: numeroFila });
  });

  const productos = new Map<
    string,
    { nombre: string; categoria?: string; costoUnitario?: number; precioVenta?: number; primeraFila: number; variantes: { tallaId: string; precioVenta?: number; stock?: number; fila: number }[] }
  >();

  for (const { datos, fila } of filas) {
    const clave = datos.nombre.toLowerCase();
    let producto = productos.get(clave);
    if (!producto) {
      producto = { nombre: datos.nombre, primeraFila: fila, variantes: [] };
      productos.set(clave, producto);
    }
    if (producto.categoria === undefined && datos.categoria) producto.categoria = datos.categoria;
    if (producto.costoUnitario === undefined && datos.costoUnitario !== undefined) producto.costoUnitario = datos.costoUnitario;
    if (producto.precioVenta === undefined && datos.precioVenta !== undefined) producto.precioVenta = datos.precioVenta;

    if (datos.tallaId) {
      const yaExiste = producto.variantes.some((v) => v.tallaId === datos.tallaId);
      if (!yaExiste) {
        producto.variantes.push({ tallaId: datos.tallaId, precioVenta: datos.precioVenta, stock: datos.stock, fila });
      }
    }
  }

  let creados = 0;
  for (const producto of productos.values()) {
    const { data: modelo, error } = await supabase
      .from("modelos")
      .insert({
        nombre: producto.nombre,
        categoria: producto.categoria || null,
        costo_unitario: producto.costoUnitario ?? null,
        precio_venta: producto.precioVenta ?? null,
      })
      .select("id")
      .single();

    if (error || !modelo) {
      errores.push({ fila: producto.primeraFila, mensaje: `"${producto.nombre}": ${error?.message ?? "Error al crear el producto"}` });
      continue;
    }

    if (producto.variantes.length) {
      const { error: errorTallas } = await supabase.from("modelo_tallas").insert(
        producto.variantes.map((v) => ({
          modelo_id: modelo.id,
          talla_id: v.tallaId,
          precio_venta: v.precioVenta ?? null,
        }))
      );
      if (errorTallas) {
        errores.push({ fila: producto.primeraFila, mensaje: `"${producto.nombre}" se creó, pero fallaron sus tallas: ${errorTallas.message}` });
      }

      const movimientos = producto.variantes
        .filter((v) => v.stock != null && v.stock > 0)
        .map((v) => ({
          modelo_id: modelo.id,
          talla_id: v.tallaId,
          tipo: "entrada" as const,
          cantidad: v.stock as number,
          motivo: "Carga inicial por importación de Excel",
          registrado_por: perfil.id,
        }));
      if (movimientos.length) {
        const { error: errorStock } = await supabase.from("movimientos_stock_producto").insert(movimientos);
        if (errorStock) {
          errores.push({ fila: producto.primeraFila, mensaje: `"${producto.nombre}" se creó, pero falló su stock inicial: ${errorStock.message}` });
        }
      }
    }
    creados++;
  }

  revalidatePath("/inventario");
  return { creados, errores };
}
