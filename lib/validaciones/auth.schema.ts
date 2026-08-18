import { z } from "zod";

export const dominioColaborador = "taller.local";

export const loginPersonalSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export const loginColaboradorSchema = z.object({
  usuarioCorto: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .regex(/^[a-z0-9_.]+$/, "Solo minúsculas, números, punto o guion bajo"),
  pin: z.string().regex(/^\d{6}$/, "El PIN debe tener 6 dígitos"),
});

export type LoginPersonalInput = z.infer<typeof loginPersonalSchema>;
export type LoginColaboradorInput = z.infer<typeof loginColaboradorSchema>;
