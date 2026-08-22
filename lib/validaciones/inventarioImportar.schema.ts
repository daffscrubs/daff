import { z } from "zod";

export const filaProductoImportadoSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  descripcion: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  costoUnitario: z.number().min(0, "No puede ser negativo").optional(),
  precioVenta: z.number().min(0, "No puede ser negativo").optional(),
  tallas: z.array(z.object({ tallaId: z.string().uuid(), precioVenta: z.number().min(0, "No puede ser negativo") })),
});

export type FilaProductoImportado = z.infer<typeof filaProductoImportadoSchema>;
