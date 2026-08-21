import { z } from "zod";

export const itemPedidoSchema = z.object({
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  precioUnitario: z.coerce.number().min(0.01, "El precio es obligatorio"),
  notas: z.string().optional(),
});

export const pedidoSchema = z.object({
  clienteId: z.string().uuid("Selecciona un cliente"),
  fechaCompromiso: z.string().min(1, "Requerido"),
  notas: z.string().optional(),
  diasCredito: z.coerce.number().int().min(0).default(0),
  items: z.array(itemPedidoSchema).min(1, "Agrega al menos un producto"),
});

export const pagoPedidoSchema = z.object({
  pedidoId: z.string().uuid(),
  monto: z.coerce.number().min(0.01, "Mínimo 0.01"),
  fecha: z.string().min(1, "Requerido"),
  notas: z.string().optional(),
});

export const estatusPedidoSchema = z.enum([
  "cotizacion",
  "confirmado",
  "en_produccion",
  "listo",
  "entregado",
  "cancelado",
]);

export type ItemPedidoInput = z.infer<typeof itemPedidoSchema>;
export type PedidoInput = z.infer<typeof pedidoSchema>;
export type PagoPedidoInput = z.infer<typeof pagoPedidoSchema>;
