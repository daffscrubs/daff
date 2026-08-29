import type { EstatusEntrega, EstatusOrden, EstatusPedido, EstatusPrendaBordado } from "@/types/database.types";

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

export const ESTATUS_PRENDA_BORDADO_LABEL: Record<EstatusPrendaBordado, string> = {
  recibida_en_tienda: "Recibida en tienda",
  recogida_para_bordar: "Recogida para bordar",
  bordada: "Bordada",
  regresada_a_tienda: "Regresada a tienda",
};

export const TIPO_BORDADO_LABEL: Record<string, string> = {
  logo: "Logo",
  nombre: "Nombre",
  texto_libre: "Texto libre",
};
