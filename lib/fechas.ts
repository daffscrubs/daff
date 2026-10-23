const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Formatea una fecha "YYYY-MM-DD" (sin hora) como "19 de agosto de 2026".
 * No pasa por Date(): un string sin hora que se parsea con `new Date(...)`
 * se ancla a medianoche UTC y puede mostrar el día anterior (u otra hora
 * inventada) según la zona horaria de quien lo ve.
 */
export function formatearFechaSolo(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return fecha;
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/** Formatea un timestamp real (con hora) en la zona horaria de quien lo ve. */
export function formatearFechaHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * "YYYY-MM-DD" de un Date en la zona horaria LOCAL de quien lo ejecuta.
 * `Date.toISOString().slice(0, 10)` da la fecha en UTC, no en local: pasadas
 * las 6pm en México (UTC-6) ya cae en el día siguiente en UTC, así que "hoy"
 * calculado así se adelanta un día (y todo lo que dependa de ese valor
 * —rangos de reportes, valores por defecto de formularios, gráficas— queda
 * corrido). Esta función usa los componentes locales del Date en vez de
 * convertir a UTC.
 */
export function fechaISOLocal(d: Date): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Suma (o resta) días a una fecha "YYYY-MM-DD" y devuelve otra "YYYY-MM-DD".
 * Usa componentes UTC de punta a punta (nunca se mezcla con hora local), así
 * que es pura aritmética de calendario sin riesgo de saltar de día.
 */
export function sumarDias(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  const anioOut = d.getUTCFullYear();
  const mesOut = String(d.getUTCMonth() + 1).padStart(2, "0");
  const diaOut = String(d.getUTCDate()).padStart(2, "0");
  return `${anioOut}-${mesOut}-${diaOut}`;
}

// La caja y las ventas del día se cortan en la hora de México, no en la del servidor (UTC): una venta de las
// 8 pm en Puebla ya es "mañana" en UTC y caería en el día equivocado. México no tiene horario de verano desde
// 2022, así que el desfase es fijo (UTC-6).
const ZONA_MEXICO = "America/Mexico_City";
const DESFASE_MEXICO = "-06:00";

/** "YYYY-MM-DD" de hoy en la hora de México. */
export function hoyMexico(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_MEXICO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Inicio (inclusive) y fin (exclusive) de un día de México, como instantes ISO para consultar timestamptz. */
export function rangoDiaMexico(fecha: string): { desde: string; hasta: string } {
  return {
    desde: new Date(`${fecha}T00:00:00${DESFASE_MEXICO}`).toISOString(),
    hasta: new Date(new Date(`${fecha}T00:00:00${DESFASE_MEXICO}`).getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Hora legible ("9:05 p. m.") en la hora de México. */
export function formatearHoraMexico(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-MX", { timeZone: ZONA_MEXICO, hour: "numeric", minute: "2-digit" });
}
