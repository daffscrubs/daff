import { z } from "zod";

export const materialSchema = z.object({
  nombre: z.string().min(2, "Requerido"),
  categoria: z.string().optional(),
  unidadMedida: z.string().min(1, "Requerido"),
  stockMinimo: z.coerce.number().min(0).default(0),
  costoUnitario: z.coerce.number().min(0).optional(),
});

export const movimientoSchema = z
  .object({
    materialId: z.string().uuid(),
    tipo: z.enum(["entrada", "salida", "ajuste"]),
    cantidad: z.coerce.number().refine((n) => n !== 0, "La cantidad no puede ser 0"),
    loteId: z.string().uuid().optional().nullable(),
    motivo: z.string().optional(),
  })
  .refine((v) => v.tipo === "ajuste" || v.cantidad > 0, {
    message: "Entradas y salidas deben ser cantidades positivas",
    path: ["cantidad"],
  });

export const consumoEstimadoSchema = z.object({
  loteId: z.string().uuid(),
  materialId: z.string().uuid(),
  cantidadEstimada: z.coerce.number().min(0),
});

export type MaterialInput = z.infer<typeof materialSchema>;
export type MovimientoInput = z.infer<typeof movimientoSchema>;
export type ConsumoEstimadoInput = z.infer<typeof consumoEstimadoSchema>;
