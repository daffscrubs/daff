/**
 * Resultado de una Server Action que puede fallar por una razón esperada
 * (validación, regla de negocio, conflicto de datos).
 *
 * En producción, Next.js redacta el mensaje de cualquier error que se
 * propague fuera de la Server Action vía `throw` — el cliente solo recibe
 * un `digest` genérico, no el texto específico (confirmado en Next.js
 * 16.3.1 con una reproducción real de `npm run build && npm run start`).
 * Por eso los errores que el usuario debe poder leer tal cual ("Ya existe
 * una orden con ese folio.") se devuelven como dato normal (`{ ok: false,
 * error }`) en vez de lanzarse — los `throw` quedan solo para fallas
 * realmente inesperadas (bugs, conexión), donde un mensaje genérico está bien.
 */
export type AccionResultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function accionOk<T>(data: T): AccionResultado<T> {
  return { ok: true, data };
}

export function accionError(error: string): AccionResultado<never> {
  return { ok: false, error };
}
