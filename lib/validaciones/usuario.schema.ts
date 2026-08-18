import { z } from "zod";

export const crearUsuarioSchema = z.discriminatedUnion("rol", [
  z.object({
    rol: z.enum(["admin", "ventas", "supervisor"]),
    nombreCompleto: z.string().min(2, "Requerido"),
    email: z.string().email("Correo inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
  }),
  z.object({
    rol: z.literal("colaborador"),
    nombreCompleto: z.string().min(2, "Requerido"),
    usuarioCorto: z
      .string()
      .min(2, "Mínimo 2 caracteres")
      .regex(/^[a-z0-9_.]+$/, "Solo minúsculas, números, punto o guion bajo"),
    pin: z.string().regex(/^\d{6}$/, "El PIN debe tener 6 dígitos"),
  }),
]);

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
