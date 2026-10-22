import ExcelJS from "exceljs";

// Mismas columnas, mismo orden y misma hoja que la exportación de productos
// de Pulpos, para poder subir ese archivo tal cual. Solo algunas se usan
// al importar (ver COLUMNAS_USADAS); el resto se conserva para que la
// plantilla y la exportación tengan exactamente el mismo formato.
export const ENCABEZADOS_PULPOS = [
  "Nombre del Producto",
  "Identificador (No Cambiar)",
  "Es un Servicio",
  "Se Vende",
  "Descripción",
  "Categoría",
  "Marca",
  "Unidad de Venta",
  "Código de Barras",
  "SKU",
  "Variantes de Tamaño",
  "Variantes de Color",
  "Variantes de Material",
  "Variantes de Estilo",
  "Usa Lotes",
  "Lote",
  "Fabricación del Lote",
  "Caducidad del Lote",
  "Utiliza Stock",
  "Stock Total Acapol",
  "Stock Mínimo Acapol",
  "Stock Apartado Acapol",
  "Ubicación Acapol",
  "Stock Zona Industrial",
  "Stock Mínimo Zona Industrial",
  "Stock Apartado Zona Industrial",
  "Ubicación Zona Industrial",
  "Stock Tizapa",
  "Stock Mínimo Tizapa",
  "Stock Apartado Tizapa",
  "Ubicación Tizapa",
  "Precio Público",
  "Precio de Venta 2",
  "Precio de Venta 3",
  "Precio de Venta 4",
  "Costo",
  "Impuestos",
  "IVA",
  "IEPS",
  "Clave SAT",
  "Receta Médica",
  "Catálogo en Línea",
] as const;

// Fila donde están los encabezados en el formato de Pulpos (las dos de arriba
// van vacías).
export const FILA_ENCABEZADOS = 3;

const COLUMNAS_USADAS = [
  "Nombre del Producto",
  "Categoría",
  "Variantes de Tamaño (talla)",
  "Stock Total Acapol",
  "Stock Zona Industrial",
  "Costo",
  "Precio Público",
];

export async function generarPlantillaInventario(tallas: { codigo: string }[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();

  const hoja = libro.addWorksheet("Inventario");
  hoja.getRow(FILA_ENCABEZADOS).values = [...ENCABEZADOS_PULPOS];
  hoja.columns = ENCABEZADOS_PULPOS.map((h, i) => ({
    width: i === 0 ? 34 : Math.max(h.length + 4, 14),
  }));

  const encabezado = hoja.getRow(FILA_ENCABEZADOS);
  encabezado.font = { bold: true, size: 10, name: "Arial" };
  encabezado.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4F0F1" } };
  });

  if (tallas.length) {
    const listaTallas = `"${tallas.map((t) => t.codigo).join(",")}"`;
    const colTalla = ENCABEZADOS_PULPOS.indexOf("Variantes de Tamaño") + 1;
    for (let fila = FILA_ENCABEZADOS + 1; fila <= 1000; fila++) {
      hoja.getCell(fila, colTalla).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [listaTallas],
        showErrorMessage: true,
        errorTitle: "Talla inválida",
        error: "Elige una talla de la lista del catálogo.",
      };
    }
  }

  const instrucciones = libro.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 100 }];
  const lineas = [
    "Instrucciones para cargar productos",
    "",
    "Esta plantilla tiene el mismo formato que la exportación de productos de Pulpos: puedes llenarla aquí o subir directamente el archivo exportado de Pulpos.",
    "",
    '1. Cada fila es UNA variante (producto + talla) en la hoja "Inventario". Los encabezados van en la fila 3.',
    "2. Si un producto tiene varias tallas, repite el nombre en varias filas — una por talla.",
    '   Ejemplo: "Filipina Clásica" / M   y   "Filipina Clásica" / G en dos filas distintas.',
    "3. Se leen solamente estas columnas (las demás se ignoran):",
    ...COLUMNAS_USADAS.map((c) => `     • ${c}`),
    '4. "Nombre del Producto" es obligatorio. Si llenas "Variantes de Color", el color se agrega al nombre y se crea',
    '   un producto por color (ej. "Babero Largo" + Gris = "Babero Largo Gris"), como ya manejas tus productos.',
    '5. "Variantes de Tamaño" debe ser una talla del catálogo (hay una lista para elegir en la celda).',
    "   Si la dejas en blanco y el producto tiene existencias, se cargan en la talla UNITALLA (debe existir en el catálogo).",
    "   Si la dejas en blanco y no hay existencias, el producto se crea sin tallas ni precio por talla.",
    '6. Las existencias se cargan POR UBICACIÓN: "Stock Total Acapol" entra al inventario de Acapol y',
    '   "Stock Zona Industrial" al de Zona Industrial (no se suman). "Stock Tizapa" no se carga.',
    "   Un stock en cero o negativo no genera existencias.",
    '7. "Precio Público" es el precio de esa talla; "Costo" es el costo del producto. Solo números, sin signo de $.',
    "8. Si un producto con el mismo nombre ya existe en el sistema, se omite (no se duplica ni se le suman existencias).",
    "9. No cambies los nombres de las columnas.",
  ];
  lineas.forEach((linea) => instrucciones.addRow([linea]));
  instrucciones.getRow(1).font = { bold: true, size: 13 };

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
