import { z } from "zod";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const registrarEntregaSchema = z.object({
  loteId: z.string().uuid(),
  fecha: z.string().regex(FECHA, "Indica la fecha de la entrega"),
  /** Entrega interna: el colaborador del taller que entrega. En maquila es el maquilero de la orden. */
  entregadoPor: z.string().uuid("Elige quién entrega").optional().nullable(),
  recibidoPor: z.string().uuid("Elige quién recibe"),
  /** Solo maquila; si no se manda, la base usa fecha de entrega + 15 días. */
  fechaPago: z.string().regex(FECHA, "Fecha de pago inválida").optional().nullable(),
  notas: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        itemOrdenId: z.string().uuid(),
        cantidad: z.coerce.number().int("La cantidad debe ser entera").min(1, "La cantidad mínima es 1").max(100_000),
      })
    )
    .min(1, "Captura al menos una cantidad entregada"),
});

export const cancelarEntregaSchema = z.object({
  entregaId: z.string().uuid(),
  motivo: z.string().trim().min(3, "Escribe el motivo de la cancelación").max(300),
});

export const cerrarOrdenSchema = z.object({
  loteId: z.string().uuid(),
  motivo: z.string().trim().min(3, "Escribe por qué se cierra con faltantes").max(300),
});

export const marcarPagoSchema = z.object({
  pagoId: z.string().uuid(),
  pagado: z.boolean(),
  fecha: z.string().regex(FECHA, "Fecha inválida").optional().nullable(),
});

export const reprogramarPagoSchema = z.object({
  pagoId: z.string().uuid(),
  fecha: z.string().regex(FECHA, "Indica la nueva fecha de pago"),
});

export type RegistrarEntregaInput = z.input<typeof registrarEntregaSchema>;
