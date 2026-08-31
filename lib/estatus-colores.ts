import type { EstatusEntrega, EstatusOrden, EstatusPedido, EstatusPrendaBordado } from "@/types/database.types";

const COLOR_CLASES = {
  gris: "bg-muted text-muted-foreground border-transparent",
  azul: "bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300",
  ambar: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  verde: "bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  rojo: "bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300",
  morado: "bg-violet-100 text-violet-700 border-transparent dark:bg-violet-950 dark:text-violet-300",
} as const;

export const CLASE_ESTATUS_PEDIDO: Record<EstatusPedido, string> = {
  cotizacion: COLOR_CLASES.gris,
  confirmado: COLOR_CLASES.azul,
  en_produccion: COLOR_CLASES.ambar,
  listo: COLOR_CLASES.morado,
  entregado: COLOR_CLASES.verde,
  cancelado: COLOR_CLASES.rojo,
};

export const CLASE_ESTATUS_ORDEN: Record<EstatusOrden, string> = {
  planeada: COLOR_CLASES.gris,
  en_proceso: COLOR_CLASES.ambar,
  terminada: COLOR_CLASES.verde,
  cancelada: COLOR_CLASES.rojo,
};

export const CLASE_ESTATUS_ENTREGA: Record<EstatusEntrega, string> = {
  programada: COLOR_CLASES.azul,
  en_ruta: COLOR_CLASES.ambar,
  entregada: COLOR_CLASES.verde,
  cancelada: COLOR_CLASES.rojo,
};

export const CLASE_ESTATUS_PRENDA_BORDADO: Record<EstatusPrendaBordado, string> = {
  recibida_en_tienda: COLOR_CLASES.gris,
  recogida_para_bordar: COLOR_CLASES.azul,
  bordada: COLOR_CLASES.ambar,
  regresada_a_tienda: COLOR_CLASES.verde,
};
