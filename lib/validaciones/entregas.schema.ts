import { z } from "zod";

export const entregarPedidoSchema = z.object({
  pedidoId: z.string().uuid(),
  recibidoPor: z.string().optional(),
});

export type EntregarPedidoInput = z.infer<typeof entregarPedidoSchema>;
