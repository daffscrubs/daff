"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { ENCABEZADOS_FIJOS } from "@/lib/excel/inventarioPlantilla";
import { filaProductoImportadoSchema, type FilaProductoImportado } from "@/lib/validaciones/inventarioImportar.schema";

export interface ResultadoImportacion {
  creados: number;
  errores: { fila: number; mensaje: string }[];
}

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
  await requerirPerfil(["admin", "supervisor"]);
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
    encabezados[colNumero] = String(celda.value ?? "").trim();
  });

  const colNombre = encabezados.indexOf("Nombre");
  const colDescripcion = encabezados.indexOf("Descripción");
  const colCategoria = encabezados.indexOf("Categoría");
  const colCosto = encabezados.indexOf("Costo de producción");
  const colPrecio = encabezados.indexOf("Precio de venta general");

  if (colNombre === -1) {
    throw new Error('El archivo no tiene la columna "Nombre". Descarga la plantilla más reciente.');
  }

  const columnasTalla: { col: number; tallaId: string; codigo: string }[] = [];
  encabezados.forEach((h, col) => {
    if (!h || ENCABEZADOS_FIJOS.includes(h)) return;
    const tallaId = tallaIdPorCodigo.get(h.trim().toUpperCase());
    if (tallaId) columnasTalla.push({ col, tallaId, codigo: h });
  });

  const filasValidas: { datos: FilaProductoImportado; fila: number }[] = [];
  const errores: { fila: number; mensaje: string }[] = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;

    const nombre = leerTexto(fila, colNombre);
    const hayContenido = (fila.values as unknown[] | undefined)?.some((v) => v != null && v !== "");
    if (!nombre) {
      if (hayContenido) errores.push({ fila: numeroFila, mensaje: "Falta el nombre" });
      return;
    }

    const costoUnitario = leerNumero(fila, colCosto);
    const precioVenta = leerNumero(fila, colPrecio);
    if (Number.isNaN(costoUnitario)) {
      errores.push({ fila: numeroFila, mensaje: "Costo de producción no es un número válido" });
      return;
    }
    if (Number.isNaN(precioVenta)) {
      errores.push({ fila: numeroFila, mensaje: "Precio de venta general no es un número válido" });
      return;
    }

    const tallas: { tallaId: string; precioVenta: number }[] = [];
    let tallaInvalida = false;
    for (const { col, tallaId, codigo } of columnasTalla) {
      const precio = leerNumero(fila, col);
      if (precio === undefined) continue;
      if (Number.isNaN(precio)) {
        errores.push({ fila: numeroFila, mensaje: `El precio de la talla ${codigo} no es un número válido` });
        tallaInvalida = true;
        break;
      }
      tallas.push({ tallaId, precioVenta: precio });
    }
    if (tallaInvalida) return;

    const parseo = filaProductoImportadoSchema.safeParse({
      nombre,
      descripcion: leerTexto(fila, colDescripcion),
      categoria: leerTexto(fila, colCategoria),
      costoUnitario,
      precioVenta,
      tallas,
    });
    if (!parseo.success) {
      errores.push({ fila: numeroFila, mensaje: parseo.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }
    filasValidas.push({ datos: parseo.data, fila: numeroFila });
  });

  let creados = 0;
  for (const { datos, fila } of filasValidas) {
    const { data: modelo, error } = await supabase
      .from("modelos")
      .insert({
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        categoria: datos.categoria || null,
        costo_unitario: datos.costoUnitario ?? null,
        precio_venta: datos.precioVenta ?? null,
      })
      .select("id")
      .single();

    if (error || !modelo) {
      errores.push({ fila, mensaje: error?.message ?? "Error al crear el producto" });
      continue;
    }

    if (datos.tallas.length) {
      const { error: errorTallas } = await supabase
        .from("modelo_tallas")
        .insert(datos.tallas.map((t) => ({ modelo_id: modelo.id, talla_id: t.tallaId, precio_venta: t.precioVenta })));
      if (errorTallas) {
        errores.push({ fila, mensaje: `"${datos.nombre}" se creó, pero fallaron sus tallas: ${errorTallas.message}` });
      }
    }
    creados++;
  }

  revalidatePath("/inventario");
  return { creados, errores };
}
