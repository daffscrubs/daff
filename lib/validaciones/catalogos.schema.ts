import { z } from "zod";

export const modeloSchema = z.object({
  nombre: z.string().min(2, "Requerido"),
  descripcion: z.string().optional(),
  costoUnitario: z.coerce.number().min(0).optional(),
  precioVenta: z.coerce.number().min(0).optional(),
  tallaIds: z.array(z.string().uuid()).optional(),
});

export const tallaSchema = z.object({
  codigo: z.string().min(1, "Requerido").toUpperCase(),
  orden: z.coerce.number().int().min(0),
});

export const etapaSchema = z.object({
  nombre: z.string().min(2, "Requerido"),
  descripcion: z.string().optional(),
});

export const plantillaSchema = z.object({
  nombre: z.string().min(2, "Requerido"),
  clienteId: z.string().uuid().optional().nullable(),
});

export const plantillaItemSchema = z.object({
  plantillaId: z.string().uuid(),
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
  cantidadSugerida: z.coerce.number().int().min(1).optional(),
});

export type ModeloInput = z.infer<typeof modeloSchema>;
export type TallaInput = z.infer<typeof tallaSchema>;
export type EtapaInput = z.infer<typeof etapaSchema>;
export type PlantillaInput = z.infer<typeof plantillaSchema>;
export type PlantillaItemInput = z.infer<typeof plantillaItemSchema>;
