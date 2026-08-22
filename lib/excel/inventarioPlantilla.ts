import ExcelJS from "exceljs";

export const ENCABEZADOS_FIJOS = ["Nombre", "Descripción", "Categoría", "Costo de producción", "Precio de venta general"];

export async function generarPlantillaInventario(tallas: { codigo: string }[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();

  const hoja = libro.addWorksheet("Productos");
  const encabezados = [...ENCABEZADOS_FIJOS, ...tallas.map((t) => t.codigo)];
  hoja.addRow(encabezados);
  hoja.getRow(1).font = { bold: true };
  hoja.columns = encabezados.map((h) => ({ width: Math.max(h.length + 4, 14) }));

  const instrucciones = libro.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 95 }];
  const lineas = [
    "Instrucciones para cargar productos",
    "",
    '1. Llena una fila por producto en la hoja "Productos".',
    '2. "Nombre" es el único campo obligatorio.',
    '3. "Costo de producción" y "Precio de venta general" son opcionales — usa solo números, sin signo de $.',
    "4. En las columnas de tallas (XS, S, M, L...) escribe el precio de venta de esa talla si el producto la maneja.",
    "   Déjala en blanco si el producto no se ofrece en esa talla.",
    "5. Si dejas TODAS las columnas de tallas en blanco, el producto podrá usarse con cualquier talla del catálogo.",
    "6. No cambies los nombres de las columnas ni el orden de las hojas.",
  ];
  lineas.forEach((linea) => instrucciones.addRow([linea]));
  instrucciones.getRow(1).font = { bold: true, size: 13 };

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
