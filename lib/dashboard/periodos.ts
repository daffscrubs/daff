export type TipoPeriodo = "hoy" | "semana" | "mes" | "personalizado";

function aFechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Calcula el rango [desde, hasta] (inclusive, formato YYYY-MM-DD) para un periodo predefinido. */
export function rangoDePeriodo(tipo: Exclude<TipoPeriodo, "personalizado">): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = aFechaISO(hoy);

  if (tipo === "hoy") {
    return { desde: hasta, hasta };
  }

  if (tipo === "semana") {
    const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diaSemana);
    return { desde: aFechaISO(lunes), hasta };
  }

  // mes
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: aFechaISO(primerDiaMes), hasta };
}
