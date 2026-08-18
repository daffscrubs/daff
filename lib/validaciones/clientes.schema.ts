import { z } from "zod";

export const clienteSchema = z.object({
  nombreComercial: z.string().min(2, "Requerido"),
  razonSocial: z.string().optional(),
  rfc: z.string().optional(),
  contactoNombre: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
  notas: z.string().optional(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;
