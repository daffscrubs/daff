import type { EstatusEntrega, EstatusOrden, EstatusPedido } from "@/types/database.types";

export const ESTATUS_PEDIDO_LABEL: Record<EstatusPedido, string> = {
  cotizacion: "Cotización",
  confirmado: "Confirmado",
  en_produccion: "En producción",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const ESTATUS_ORDEN_LABEL: Record<EstatusOrden, string> = {
  planeada: "Planeada",
  en_proceso: "En proceso",
  terminada: "Terminada",
  cancelada: "Cancelada",
};

export const ESTATUS_ENTREGA_LABEL: Record<EstatusEntrega, string> = {
  programada: "Programada",
  en_ruta: "En ruta",
  entregada: "Entregada",
  cancelada: "Cancelada",
};
