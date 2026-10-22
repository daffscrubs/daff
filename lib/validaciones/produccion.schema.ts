import { z } from "zod";

export const itemOrdenSchema = z.object({
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
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
  ubicacionDestinoId: z.string().uuid("Elige dónde entrarán las piezas terminadas"),
  items: z.array(itemOrdenSchema).min(1, "Agrega al menos un producto"),
  insumos: z.array(insumoOrdenSchema).optional().default([]),
});

export const editarOrdenProduccionSchema = z.object({
  fechaFinEstimada: z.string().optional(),
  ubicacionDestinoId: z.string().uuid().optional().nullable(),
  items: z.array(itemOrdenSchema).min(1, "Agrega al menos un producto"),
});

export const agregarEtapaLoteSchema = z.object({
  loteId: z.string().uuid(),
  etapaId: z.string().uuid("Selecciona una etapa"),
});

// Sub-procesos opcionales dentro de un proceso (ej. Confección con Manga,
// Delantero, Trasero, Cuello). Se configuran por orden, no en el catálogo.
export const agregarSubprocesosLoteSchema = z.object({
  loteId: z.string().uuid(),
  ordenSecuencia: z.coerce.number().int().positive(),
  nombres: z
    .array(z.string().trim().min(1, "El nombre no puede estar vacío"))
    .min(1, "Agrega al menos un sub-proceso"),
});

export const quitarSubprocesoLoteSchema = z.object({
  loteId: z.string().uuid(),
  ordenSecuencia: z.coerce.number().int().positive(),
  nombreSubproceso: z.string().trim().min(1),
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
export type EditarOrdenProduccionInput = z.infer<typeof editarOrdenProduccionSchema>;
export type AgregarEtapaLoteInput = z.infer<typeof agregarEtapaLoteSchema>;
export type AgregarSubprocesosLoteInput = z.infer<typeof agregarSubprocesosLoteSchema>;
export type QuitarSubprocesoLoteInput = z.infer<typeof quitarSubprocesoLoteSchema>;
export type IncidenciaInput = z.infer<typeof incidenciaSchema>;
