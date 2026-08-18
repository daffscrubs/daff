import type { EventoHistorial } from "@/lib/produccion/historial";

export function HistorialOrden({ eventos }: { eventos: EventoHistorial[] }) {
  if (!eventos.length) {
    return <p className="text-sm text-muted-foreground">Sin eventos todavía.</p>;
  }

  return (
    <ol className="space-y-4 border-l pl-4">
      {eventos.map((evento, index) => (
        <li key={index} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
          <p className="font-medium">{evento.titulo}</p>
          {evento.detalle && <p className="text-sm text-muted-foreground">{evento.detalle}</p>}
          <p className="text-xs text-muted-foreground">
            {new Date(evento.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </li>
      ))}
    </ol>
  );
}
