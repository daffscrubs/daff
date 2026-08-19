import { z } from "zod";

export const compraItemSchema = z.object({
  materialId: z.string().uuid("Selecciona un material"),
  cantidad: z.coerce.number().min(0.01, "Mínimo 0.01"),
  costoUnitario: z.coerce.number().min(0, "No puede ser negativo"),
});

export const compraSchema = z.object({
  proveedor: z.string().min(2, "Requerido"),
  fecha: z.string().min(1, "Requerido"),
  notas: z.string().optional(),
  items: z.array(compraItemSchema).min(1, "Agrega al menos un material"),
});

export const CATEGORIAS_GASTO = [
  "renta",
  "servicios",
  "nomina",
  "transporte",
  "mantenimiento",
  "otro",
] as const;

export const gastoSchema = z.object({
  fecha: z.string().min(1, "Requerido"),
  categoria: z.enum(CATEGORIAS_GASTO),
  concepto: z.string().min(2, "Requerido"),
  monto: z.coerce.number().min(0.01, "Mínimo 0.01"),
  notas: z.string().optional(),
});

export type CompraItemInput = z.infer<typeof compraItemSchema>;
export type CompraInput = z.infer<typeof compraSchema>;
export type GastoInput = z.infer<typeof gastoSchema>;
