import ExcelJS from "exceljs";

export const ENCABEZADOS_FIJOS = [
  "NOMBRE DEL PRODUCTO",
  "CATEGORIA",
  "VARIANTE DE TAMAÑO (TALLA)",
  "STOCK",
  "COSTO",
  "PRECIO DE VENTA",
];

export async function generarPlantillaInventario(tallas: { codigo: string }[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();

  const hoja = libro.addWorksheet("Productos");
  hoja.addRow(ENCABEZADOS_FIJOS);
  hoja.getRow(1).font = { bold: true };
  hoja.columns = ENCABEZADOS_FIJOS.map((h) => ({ width: Math.max(h.length + 4, 16) }));

  if (tallas.length) {
    const listaTallas = `"${tallas.map((t) => t.codigo).join(",")}"`;
    for (let fila = 2; fila <= 1000; fila++) {
      hoja.getCell(`C${fila}`).dataValidation = {
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
  instrucciones.columns = [{ width: 95 }];
  const lineas = [
    "Instrucciones para cargar productos",
    "",
    '1. Cada fila es UNA variante (producto + talla) en la hoja "Productos".',
    "2. Si un producto tiene varias tallas, repite el nombre en varias filas — una por talla.",
    '   Ejemplo: "Filipina Clásica" / S    y    "Filipina Clásica" / M en dos filas distintas.',
    '3. "NOMBRE DEL PRODUCTO" es obligatorio.',
    '4. "VARIANTE DE TAMAÑO (TALLA)" debe ser una talla del catálogo (hay una lista para elegir en la celda).',
    "   Si la dejas en blanco, el producto se crea sin existencias ni precio para esa fila.",
    '5. "STOCK", "COSTO" y "PRECIO DE VENTA" son opcionales — usa solo números, sin signo de $.',
    '   "STOCK" es la cantidad de existencias con la que arranca esa talla.',
    '   "PRECIO DE VENTA" es el precio de esa talla en particular.',
    "6. No cambies los nombres de las columnas ni el orden de las hojas.",
  ];
  lineas.forEach((linea) => instrucciones.addRow([linea]));
  instrucciones.getRow(1).font = { bold: true, size: 13 };

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
