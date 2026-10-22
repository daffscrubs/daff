import { z } from "zod";

export const movimientoStockProductoSchema = z
  .object({
    modeloId: z.string().uuid("Selecciona un modelo"),
    tallaId: z.string().uuid("Selecciona una talla"),
    ubicacionId: z.string().uuid("Selecciona una ubicación"),
    tipo: z.enum(["entrada", "salida", "ajuste"]),
    cantidad: z.coerce.number().int().refine((n) => n !== 0, "La cantidad no puede ser 0"),
    motivo: z.string().optional(),
  })
  .refine((v) => v.tipo === "ajuste" || v.cantidad > 0, {
    message: "Entradas y salidas deben ser cantidades positivas",
    path: ["cantidad"],
  });

export const traspasoStockProductoSchema = z.object({
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
  origenId: z.string().uuid("Selecciona la ubicación de origen"),
  destinoId: z.string().uuid("Selecciona la ubicación de destino"),
  cantidad: z.coerce.number().int().min(1, "La cantidad debe ser mayor a cero"),
  motivo: z.string().optional(),
});

export type MovimientoStockProductoInput = z.infer<typeof movimientoStockProductoSchema>;
export type TraspasoStockProductoInput = z.infer<typeof traspasoStockProductoSchema>;
