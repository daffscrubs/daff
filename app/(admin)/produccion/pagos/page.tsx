import { createClient } from "@/lib/supabase/server";
import { leerTodo } from "@/lib/supabase/leer-todo";
import { requerirPermiso } from "@/lib/supabase/auth-helpers";
import { hoyMexico, sumarDias } from "@/lib/fechas";
import { NavProduccion } from "@/components/produccion/NavProduccion";
import { PagosMaquila, type PagoFila } from "@/components/produccion/PagosMaquila";

export default async function PagosMaquilaPage() {
  await requerirPermiso("produccion.pagos_maquila");
  const supabase = await createClient();

  const { data: pagos } = await leerTodo((d, h) =>
    supabase
      .from("pagos_maquila")
      .select("id, maquilero_id, monto, fecha_programada, estatus, fecha_pago_real, maquileros(nombre), entregas_produccion(fecha, lote_id, lotes_produccion(folio))")
      .neq("estatus", "cancelado")
      .order("id")
      .range(d, h)
  ).then((r) => ({ data: r.data }));

  const hoy = hoyMexico();
  // Domingo de esta semana (la semana va de lunes a domingo).
  const [a, m, d] = hoy.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  const finSemana = sumarDias(hoy, (7 - diaSemana) % 7);

  const filas: PagoFila[] = (pagos ?? []).map((p) => ({
    id: p.id,
    maquileroId: p.maquilero_id,
    maquilero: p.maquileros?.nombre ?? "—",
    monto: Number(p.monto),
    fechaProgramada: p.fecha_programada,
    estatus: p.estatus === "pagado" ? "pagado" : "pendiente",
    fechaPagoReal: p.fecha_pago_real,
    fechaEntrega: p.entregas_produccion?.fecha ?? p.fecha_programada,
    loteId: p.entregas_produccion?.lote_id ?? "",
    folio: p.entregas_produccion?.lotes_produccion?.folio ?? "—",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Producción</h1>
        <p className="text-muted-foreground">Lo que le debes a tus maquileros y cuándo vence.</p>
      </div>
      <NavProduccion puedeVerPagos />
      <PagosMaquila hoy={hoy} finSemana={finSemana} pagos={filas} />
    </div>
  );
}
