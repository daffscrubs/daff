import { z } from "zod";

export const detalleBordadoSchema = z.object({
  ubicacion: z.string().min(1, "Requerido"),
  tipo: z.enum(["logo", "nombre", "texto_libre"]),
  descripcion: z.string().min(1, "Requerido"),
});

export const crearPrendaBordadoSchema = z.object({
  descripcion: z.string().min(2, "Requerido"),
  clienteNombre: z.string().min(2, "Requerido"),
  clienteTelefono: z.string().optional(),
  fechaEntregaCompromiso: z.string().min(1, "Requerido"),
  detalles: z.array(detalleBordadoSchema).min(1, "Agrega al menos un bordado"),
});

export type DetalleBordadoInput = z.infer<typeof detalleBordadoSchema>;
export type CrearPrendaBordadoInput = z.infer<typeof crearPrendaBordadoSchema>;
