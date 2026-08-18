import { z } from "zod";

export const entregaSchema = z.object({
  pedidoId: z.string().uuid("Selecciona un pedido"),
  fechaProgramada: z.string().min(1, "Requerido"),
  notas: z.string().optional(),
});

export const registrarEntregaRealSchema = z.object({
  recibidoPor: z.string().min(2, "Requerido"),
  firmaUrl: z.string().optional().nullable(),
  notas: z.string().optional(),
});

export type EntregaInput = z.infer<typeof entregaSchema>;
export type RegistrarEntregaRealInput = z.infer<typeof registrarEntregaRealSchema>;
