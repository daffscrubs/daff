import { z } from "zod";

export const maquileroSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del maquilero").max(120),
  telefono: z.string().trim().max(30).optional(),
  notas: z.string().trim().max(500).optional(),
  // Datos bancarios: opcionales; solo los guarda quien tiene el permiso de pagos de maquila.
  banco: z.string().trim().max(60).optional(),
  clabe: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{18}$/.test(v), "La CLABE debe tener 18 dígitos"),
});

export type MaquileroInput = z.input<typeof maquileroSchema>;
