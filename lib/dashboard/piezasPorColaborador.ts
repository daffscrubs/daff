import { fechaISOLocal } from "@/lib/fechas";

export interface PiezasColaborador {
  colaborador: string;
  piezas: number;
}

export function piezasPorColaboradorSemana(
  registros: { colaboradorId: string; colaborador: string; cantidad: number; fecha: string }[],
  hoy = new Date()
): PiezasColaborador[] {
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() - 6);
  const desde = fechaISOLocal(inicio);
  const hasta = fechaISOLocal(hoy);

  const mapa = new Map<string, PiezasColaborador>();
  for (const r of registros) {
    if (r.fecha < desde || r.fecha > hasta) continue;
    const actual = mapa.get(r.colaboradorId) ?? { colaborador: r.colaborador, piezas: 0 };
    actual.piezas += r.cantidad;
    mapa.set(r.colaboradorId, actual);
  }

  return [...mapa.values()].sort((a, b) => b.piezas - a.piezas);
}
