import { z } from "zod";

const dinero = z.number().min(0, "El precio y el costo no pueden ser negativos").max(9999999).nullable();

export const guardarProductoSchema = z.object({
  modeloId: z.string().uuid(),
  nombre: z.string().trim().min(2, "El nombre es obligatorio"),
  descripcion: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  variantes: z
    .array(
      z.object({
        tallaId: z.string().uuid(),
        precioVenta: dinero,
        costoUnitario: dinero,
        codigoBarras: z.string().trim().optional(),
        sku: z.string().trim().optional(),
      })
    )
    .min(1, "El producto necesita al menos una talla"),
  // Solo las existencias que el usuario cambió: la cantidad que debe quedar en esa ubicación.
  existencias: z.array(
    z.object({
      tallaId: z.string().uuid(),
      ubicacionId: z.string().uuid(),
      cantidad: z.number().int("Las existencias deben ser un número entero").min(0, "Las existencias no pueden ser negativas"),
    })
  ),
});

export type GuardarProductoInput = z.infer<typeof guardarProductoSchema>;
