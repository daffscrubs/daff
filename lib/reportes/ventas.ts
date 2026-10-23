import { sumarDias } from "@/lib/fechas";

export type Agrupacion = "mes" | "dia" | "anio";

export interface RangoReporte {
  desde: string;
  hasta: string;
  agrupar: Agrupacion;
}

export interface Preset extends RangoReporte {
  id: string;
  etiqueta: string;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

const partes = (f: string) => f.slice(0, 10).split("-").map(Number) as [number, number, number];

export function esFechaReal(f: string): boolean {
  if (!FECHA_VALIDA.test(f)) return false;
  const [a, m, d] = partes(f);
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}

export const inicioDeMes = (f: string) => `${f.slice(0, 7)}-01`;
export const inicioDeAnio = (f: string) => `${f.slice(0, 4)}-01-01`;

/** Último día del mes de una fecha "YYYY-MM-DD". */
export function finDeMes(f: string): string {
  const [a, m] = partes(f);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Primer día del mes `n` meses antes (o después, si n es negativo) del mes de la fecha. */
export function mesesAntes(f: string, n: number): string {
  const [a, m] = partes(f);
  return new Date(Date.UTC(a, m - 1 - n, 1)).toISOString().slice(0, 10);
}

/** "octubre 2026" / "jue 23 oct 2026" / "2026" según la agrupación. */
export function etiquetaPeriodo(periodo: string, agrupar: Agrupacion): string {
  const [a, m, d] = partes(periodo);
  if (agrupar === "anio") return String(a);
  if (agrupar === "mes") return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} ${a}`;
  const dia = DIAS_CORTOS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia} ${d} ${MESES_CORTOS[m - 1]} ${a}`;
}

/** Versión corta para el eje de la gráfica: "oct 26" / "23 oct" / "2026". */
export function etiquetaCorta(periodo: string, agrupar: Agrupacion): string {
  const [a, m, d] = partes(periodo);
  if (agrupar === "anio") return String(a);
  if (agrupar === "mes") return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

export function presetsReporte(hoy: string, primera: string | null): Preset[] {
  const mesPasadoInicio = mesesAntes(hoy, 1);
  return [
    { id: "hoy", etiqueta: "Hoy", desde: hoy, hasta: hoy, agrupar: "dia" },
    { id: "7d", etiqueta: "Últimos 7 días", desde: sumarDias(hoy, -6), hasta: hoy, agrupar: "dia" },
    { id: "mes", etiqueta: "Este mes", desde: inicioDeMes(hoy), hasta: hoy, agrupar: "dia" },
    { id: "mes-pasado", etiqueta: "Mes pasado", desde: mesPasadoInicio, hasta: finDeMes(mesPasadoInicio), agrupar: "dia" },
    { id: "3m", etiqueta: "Últimos 3 meses", desde: mesesAntes(hoy, 2), hasta: hoy, agrupar: "mes" },
    { id: "anio", etiqueta: "Este año", desde: inicioDeAnio(hoy), hasta: hoy, agrupar: "mes" },
    { id: "todo", etiqueta: "Todo el historial", desde: primera && primera < hoy ? primera : inicioDeAnio(hoy), hasta: hoy, agrupar: "mes" },
  ];
}

/** Rango y agrupación a partir de los parámetros de la URL; si no son válidos, "todo el historial por mes". */
export function leerRango(params: { desde?: string; hasta?: string; agrupar?: string }, hoy: string, primera: string | null): RangoReporte {
  const base = presetsReporte(hoy, primera).find((p) => p.id === "todo")!;
  const desde = params.desde && esFechaReal(params.desde) ? params.desde : base.desde;
  const hasta = params.hasta && esFechaReal(params.hasta) ? params.hasta : base.hasta;
  const agrupar: Agrupacion = params.agrupar === "dia" || params.agrupar === "anio" || params.agrupar === "mes" ? params.agrupar : base.agrupar;
  return hasta < desde ? { desde: hasta, hasta: desde, agrupar } : { desde, hasta, agrupar };
}

/** Rango que cubre un periodo completo, para "ver el detalle de este mes por día". */
export function rangoDePeriodo(periodo: string, agrupar: Agrupacion): RangoReporte | null {
  if (agrupar === "mes") return { desde: periodo, hasta: finDeMes(periodo), agrupar: "dia" };
  if (agrupar === "anio") return { desde: periodo, hasta: `${periodo.slice(0, 4)}-12-31`, agrupar: "mes" };
  return null;
}
