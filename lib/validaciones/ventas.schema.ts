import { z } from "zod";

export const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta"] as const;

export const UNIDADES_VENTA = ["Unidad", "Pieza", "Par", "Metro", "Kilogramo", "Litro", "Caja", "Paquete", "Hora", "Servicio"] as const;
export const TASAS_IVA = [16, 8, 0] as const;
export const TASAS_IEPS = [0, 3, 6, 8, 25, 30, 50] as const;

const maxDecimales = (n: number, decimales: number) => Math.abs(Math.round(n * 10 ** decimales) - n * 10 ** decimales) < 1e-6;

// Partida de "entrada manual": algo que se cobra pero no está en el inventario. El precio lo captura quien vende
// (por eso la base de datos exige el permiso pos.entrada_manual).
export const itemManualSchema = z.object({
  manual: z.literal(true),
  nombre: z.string().trim().min(1, "Escribe el nombre del producto").max(120, "El nombre es demasiado largo"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero").max(999_999).refine((n) => maxDecimales(n, 3), "La cantidad admite hasta 3 decimales"),
  unidad: z.enum(UNIDADES_VENTA),
  precio: z.number().positive("El precio debe ser mayor a cero").max(9_999_999).refine((n) => maxDecimales(n, 2), "El precio admite hasta 2 decimales"),
  costo: z.number().min(0, "El costo no puede ser negativo").max(9_999_999).refine((n) => maxDecimales(n, 2), "El costo admite hasta 2 decimales").nullable().optional(),
  iva: z.number().min(0).max(100),
  ieps: z.number().min(0).max(200),
});

const itemProductoSchema = z.object({
  modeloId: z.string().uuid(),
  tallaId: z.string().uuid(),
  cantidad: z.number().int("La cantidad debe ser entera").min(1, "La cantidad mínima es 1").max(10_000),
});

export const registrarVentaSchema = z.object({
  ubicacionId: z.string().uuid("Elige la ubicación de la venta"),
  clienteId: z.string().uuid().nullable(),
  items: z.array(z.union([itemManualSchema, itemProductoSchema])).min(1, "Agrega al menos un producto a la venta"),
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
  // Opcionales: vacío = "sin contar" (no es lo mismo que contar $0).
  tarjetaContado: z.number().min(0, "El recuento de tarjeta no puede ser negativo").max(10_000_000).nullable().optional(),
  transferenciaContado: z.number().min(0, "El recuento de transferencia no puede ser negativo").max(10_000_000).nullable().optional(),
  notas: z.string().trim().max(500).optional(),
});

export type RegistrarVentaInput = z.input<typeof registrarVentaSchema>;
