import { z } from "zod";

export const movimientoStockProductoSchema = z
  .object({
    modeloId: z.string().uuid("Selecciona un modelo"),
    tallaId: z.string().uuid("Selecciona una talla"),
    varianteId: z.string().uuid().optional().nullable(),
    tipo: z.enum(["entrada", "salida", "ajuste"]),
    cantidad: z.coerce.number().int().refine((n) => n !== 0, "La cantidad no puede ser 0"),
    motivo: z.string().optional(),
  })
  .refine((v) => v.tipo === "ajuste" || v.cantidad > 0, {
    message: "Entradas y salidas deben ser cantidades positivas",
    path: ["cantidad"],
  });

export type MovimientoStockProductoInput = z.infer<typeof movimientoStockProductoSchema>;
