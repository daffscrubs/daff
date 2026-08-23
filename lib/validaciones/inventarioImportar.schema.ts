import { z } from "zod";

export const filaVarianteImportadaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  categoria: z.string().trim().optional(),
  tallaId: z.string().uuid().optional(),
  stock: z.number().min(0, "No puede ser negativo").optional(),
  costoUnitario: z.number().min(0, "No puede ser negativo").optional(),
  precioVenta: z.number().min(0, "No puede ser negativo").optional(),
});

export type FilaVarianteImportada = z.infer<typeof filaVarianteImportadaSchema>;
