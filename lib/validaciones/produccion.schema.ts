import { z } from "zod";

export const loteSchema = z.object({
  pedidoId: z.string().uuid().optional().nullable(),
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
  varianteId: z.string().uuid().optional().nullable(),
  cantidadPlaneada: z.coerce.number().int().min(1, "Mínimo 1"),
  fechaFinEstimada: z.string().optional(),
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

export type LoteInput = z.infer<typeof loteSchema>;
export type AgregarEtapaLoteInput = z.infer<typeof agregarEtapaLoteSchema>;
export type IncidenciaInput = z.infer<typeof incidenciaSchema>;
