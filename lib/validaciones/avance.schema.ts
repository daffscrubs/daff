import { z } from "zod";

export const registrarAvanceSchema = z.object({
  loteId: z.string().uuid(),
  loteEtapaId: z.string().uuid(),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  observaciones: z.string().optional(),
  fotoUrl: z.string().optional().nullable(),
});

export const ajusteAvanceSchema = z.object({
  colaboradorId: z.string().uuid("Selecciona el colaborador a corregir"),
  loteId: z.string().uuid(),
  loteEtapaId: z.string().uuid(),
  cantidad: z.coerce.number().int().refine((n) => n !== 0, "La cantidad no puede ser 0"),
  observaciones: z.string().min(3, "Explica el motivo del ajuste"),
});

export type RegistrarAvanceInput = z.infer<typeof registrarAvanceSchema>;
export type AjusteAvanceInput = z.infer<typeof ajusteAvanceSchema>;
