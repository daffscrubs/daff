import { z } from "zod";

// Una fila en compra_items puede generar varias unidades físicas (ej. una
// línea de compra de 145m de tela se reparte en 4 rollos de 25 y uno de 45).
// El arreglo ya viene expandido: una cantidad por unidad física a crear.
export const crearUnidadesDesdeCompraSchema = z.object({
  compraItemId: z.string().uuid(),
  cantidades: z
    .array(z.coerce.number().positive("Cada cantidad debe ser mayor a 0"))
    .min(1, "Agrega al menos una cantidad"),
});

// cantidadDeUnidades permite dar de alta de un jalón varios rollos/bolsas
// físicos que ya existen con exactamente la misma cantidad (ej. inventario
// inicial: "20 rollos de 25m cada uno") sin repetir el formulario 20 veces.
export const crearUnidadIndividualSchema = z.object({
  materialId: z.string().uuid(),
  cantidadInicial: z.coerce.number().positive("Debe ser mayor a 0"),
  cantidadDeUnidades: z.coerce.number().int().positive("Debe ser al menos 1").default(1),
  costoUnitario: z.coerce.number().min(0).optional(),
  proveedor: z.string().optional(),
  fechaRecepcion: z.string().optional(),
});

export const asignarUnidadAOrdenSchema = z.object({
  loteId: z.string().uuid(),
  unidadId: z.string().uuid(),
  cantidadEstimada: z.coerce.number().min(0),
});

export type CrearUnidadesDesdeCompraInput = z.infer<typeof crearUnidadesDesdeCompraSchema>;
export type CrearUnidadIndividualInput = z.infer<typeof crearUnidadIndividualSchema>;
export type AsignarUnidadAOrdenInput = z.infer<typeof asignarUnidadAOrdenSchema>;
