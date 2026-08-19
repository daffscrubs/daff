export interface PuntoSerieDiaria {
  fecha: string;
  etiqueta: string;
  valor: number;
}

/** Construye una serie de los últimos `dias` días (incluyendo hoy) sumando los montos por fecha. */
export function serieDiaria(
  registros: { fecha: string; monto: number }[],
  dias = 7
): PuntoSerieDiaria[] {
  const hoy = new Date();
  const puntos: PuntoSerieDiaria[] = [];

  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - i);
    const fecha = d.toISOString().slice(0, 10);
    const etiqueta = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "");
    const valor = registros.filter((r) => r.fecha === fecha).reduce((acc, r) => acc + r.monto, 0);
    puntos.push({ fecha, etiqueta, valor });
  }

  return puntos;
}
