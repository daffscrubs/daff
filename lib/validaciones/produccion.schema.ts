import { z } from "zod";

export const TIPOS_PRODUCCION = ["interna", "maquila"] as const;
export type TipoProduccion = (typeof TIPOS_PRODUCCION)[number];

export const itemOrdenSchema = z.object({
  modeloId: z.string().uuid("Selecciona un modelo"),
  tallaId: z.string().uuid("Selecciona una talla"),
  cantidadPlaneada: z.coerce.number().int().min(1, "Mínimo 1"),
});

export const insumoOrdenSchema = z.object({
  materialId: z.string().uuid("Selecciona un material"),
  cantidadEstimada: z.coerce.number().min(0, "Mínimo 0"),
});

// Precio acordado con el maquilero por pieza de un modelo (el mismo para todas sus tallas).
export const precioModeloSchema = z.object({
  modeloId: z.string().uuid(),
  precioPorPieza: z.coerce.number().min(0, "El precio no puede ser negativo").max(1_000_000),
});

const produccionCamposSchema = z.object({
  tipoProduccion: z.enum(TIPOS_PRODUCCION).default("interna"),
  maquileroId: z.string().uuid().optional().nullable(),
  /** Solo lo guarda quien tiene el permiso de pagos de maquila; para el resto se ignora. */
  precios: z.array(precioModeloSchema).optional(),
});

const exigirMaquilero = (d: { tipoProduccion: TipoProduccion; maquileroId?: string | null }, ctx: z.RefinementCtx) => {
  if (d.tipoProduccion === "maquila" && !d.maquileroId) {
    ctx.addIssue({ code: "custom", path: ["maquileroId"], message: "Elige el maquilero de esta orden" });
  }
};

export const ordenProduccionSchema = produccionCamposSchema
  .extend({
    folio: z.string().min(1, "Requerido"),
    pedidoId: z.string().uuid().optional().nullable(),
    fechaFinEstimada: z.string().optional(),
    ubicacionDestinoId: z.string().uuid("Elige dónde entrarán las piezas terminadas"),
    items: z.array(itemOrdenSchema).min(1, "Agrega al menos un producto"),
    insumos: z.array(insumoOrdenSchema).optional().default([]),
  })
  .superRefine(exigirMaquilero);

export const editarOrdenProduccionSchema = produccionCamposSchema
  .extend({
    fechaFinEstimada: z.string().optional(),
    ubicacionDestinoId: z.string().uuid().optional().nullable(),
    items: z.array(itemOrdenSchema).min(1, "Agrega al menos un producto"),
  })
  .superRefine(exigirMaquilero);

export const incidenciaSchema = z.object({
  loteId: z.string().uuid(),
  descripcion: z.string().min(3, "Describe la incidencia"),
  gravedad: z.enum(["baja", "media", "alta"]).default("baja"),
  fotoUrl: z.string().optional().nullable(),
});

export type ItemOrdenInput = z.infer<typeof itemOrdenSchema>;
export type InsumoOrdenInput = z.infer<typeof insumoOrdenSchema>;
export type PrecioModeloInput = z.infer<typeof precioModeloSchema>;
export type OrdenProduccionInput = z.input<typeof ordenProduccionSchema>;
export type EditarOrdenProduccionInput = z.input<typeof editarOrdenProduccionSchema>;
export type IncidenciaInput = z.infer<typeof incidenciaSchema>;
