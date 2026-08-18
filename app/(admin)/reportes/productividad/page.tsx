import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReporteProductividadPage() {
  const supabase = await createClient();

  const [{ data: registros }, { data: etapasCatalogo }] = await Promise.all([
    supabase
      .from("registros_avance_colaborador")
      .select("*, perfiles!registros_avance_colaborador_colaborador_id_fkey(nombre_completo), lote_etapas(etapa_id)")
      .order("fecha", { ascending: false }),
    supabase.from("etapas_proceso").select("*"),
  ]);

  const nombreEtapa = (id?: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";

  const resumen = new Map<string, { colaborador: string; etapa: string; total: number }>();
  for (const r of registros ?? []) {
    const etapa = nombreEtapa(r.lote_etapas?.etapa_id);
    const colaborador = r.perfiles?.nombre_completo ?? "—";
    const clave = `${colaborador}::${etapa}`;
    const actual = resumen.get(clave) ?? { colaborador, etapa, total: 0 };
    actual.total += r.cantidad;
    resumen.set(clave, actual);
  }

  const filas = [...resumen.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Productividad por colaborador</h1>
        <p className="text-muted-foreground">Piezas netas registradas por colaborador y etapa (incluye ajustes).</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Total piezas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={`${fila.colaborador}-${fila.etapa}`}>
              <TableCell>{fila.colaborador}</TableCell>
              <TableCell>{fila.etapa}</TableCell>
              <TableCell>{fila.total}</TableCell>
            </TableRow>
          ))}
          {!filas.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin registros de avance todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Detalle diario</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros?.slice(0, 100).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{r.fecha}</TableCell>
                <TableCell>{r.perfiles?.nombre_completo ?? "—"}</TableCell>
                <TableCell>{nombreEtapa(r.lote_etapas?.etapa_id)}</TableCell>
                <TableCell className={r.cantidad < 0 ? "text-destructive" : ""}>{r.cantidad}</TableCell>
                <TableCell>{r.origen === "ajuste_supervisor" ? "Ajuste" : "Colaborador"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
