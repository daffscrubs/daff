import { z } from "zod";

export const itemOrdenSchema = z.object({
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
  varianteId: z.string().uuid().optional().nullable(),
  cantidadPlaneada: z.coerce.number().int().min(1, "Mínimo 1"),
});

export const insumoOrdenSchema = z.object({
  materialId: z.string().uuid("Selecciona un material"),
  cantidadEstimada: z.coerce.number().min(0, "Mínimo 0"),
});

export const ordenProduccionSchema = z.object({
  folio: z.string().min(1, "Requerido"),
  pedidoId: z.string().uuid().optional().nullable(),
  fechaFinEstimada: z.string().optional(),
  items: z.array(itemOrdenSchema).min(1, "Agrega al menos un producto"),
  insumos: z.array(insumoOrdenSchema).optional().default([]),
});

export const agregarEtapaLoteSchema = z.object({
  loteId: z.string().uuid(),
  etapaId: z.string().uuid("Selecciona una etapa"),
});

export const incidenciaSchema = z.object({
  loteId: z.string().uuid(),
  loteEtapaId: z.string().uuid().optional().nullable(),
  descripcion: z.string().min(3, "Describe la incidencia"),
  gravedad: z.enum(["baja", "media", "alta"]).default("baja"),
  fotoUrl: z.string().optional().nullable(),
});

export type ItemOrdenInput = z.infer<typeof itemOrdenSchema>;
export type InsumoOrdenInput = z.infer<typeof insumoOrdenSchema>;
export type OrdenProduccionInput = z.infer<typeof ordenProduccionSchema>;
export type AgregarEtapaLoteInput = z.infer<typeof agregarEtapaLoteSchema>;
export type IncidenciaInput = z.infer<typeof incidenciaSchema>;
