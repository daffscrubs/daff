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
