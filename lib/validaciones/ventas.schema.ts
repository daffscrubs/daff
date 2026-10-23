import { z } from "zod";

export const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta"] as const;

export const registrarVentaSchema = z.object({
  ubicacionId: z.string().uuid("Elige la ubicación de la venta"),
  clienteId: z.string().uuid().nullable(),
  items: z
    .array(
      z.object({
        modeloId: z.string().uuid(),
        tallaId: z.string().uuid(),
        cantidad: z.number().int("La cantidad debe ser entera").min(1, "La cantidad mínima es 1").max(10_000),
      })
    )
    .min(1, "Agrega al menos un producto a la venta"),
  pagos: z
    .array(
      z.object({
        metodo: z.enum(METODOS_PAGO),
        monto: z.number().positive("Cada pago debe ser mayor a cero"),
        // Solo efectivo: lo que entregó el cliente (el cambio es la diferencia).
        recibido: z.number().positive().optional(),
        referencia: z.string().trim().max(120).optional(),
      })
    )
    .min(1, "Indica cómo se pagó la venta"),
  descuento: z.number().min(0, "El descuento no puede ser negativo").default(0),
  notas: z.string().trim().max(500).optional(),
});

export const cancelarVentaSchema = z.object({
  ventaId: z.string().uuid(),
  motivo: z.string().trim().min(3, "Escribe el motivo de la cancelación").max(300),
});

export const abrirCajaSchema = z.object({
  ubicacionId: z.string().uuid("Elige la ubicación"),
  fondoInicial: z.number().min(0, "El fondo no puede ser negativo").max(1_000_000),
});

export const movimientoCajaSchema = z.object({
  sesionId: z.string().uuid(),
  tipo: z.enum(["ingreso", "retiro"]),
  monto: z.number().positive("El monto debe ser mayor a cero").max(1_000_000),
  concepto: z.string().trim().min(2, "Escribe el motivo del movimiento").max(200),
});

export const cerrarCajaSchema = z.object({
  sesionId: z.string().uuid(),
  efectivoContado: z.number().min(0, "Cuenta el efectivo del cajón (puede ser 0)").max(10_000_000),
  notas: z.string().trim().max(500).optional(),
});

export type RegistrarVentaInput = z.input<typeof registrarVentaSchema>;
