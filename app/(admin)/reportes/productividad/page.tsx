import { createClient } from "@/lib/supabase/server";
import { NavReportes } from "@/components/reportes/NavReportes";
import { ReporteProductividadTable } from "@/components/produccion/ReporteProductividadTable";
import { construirRegistrosReporte } from "@/lib/produccion/registro-reporte";

export default async function ReporteProductividadPage() {
  const supabase = await createClient();

  const [
    { data: registros },
    { data: etapasCatalogo },
    { data: loteEtapas },
    { data: items },
    { data: lotes },
    { data: modelos },
    { data: tallas },
  ] = await Promise.all([
    supabase
      .from("registros_avance_colaborador")
      .select("*, perfiles!registros_avance_colaborador_colaborador_id_fkey(nombre_completo)")
      .order("created_at", { ascending: false }),
    supabase.from("etapas_proceso").select("*"),
    supabase.from("lote_etapas").select("*"),
    supabase.from("items_orden_produccion").select("*"),
    supabase.from("lotes_produccion").select("id, folio"),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
  ]);

  const registrosDetallados = construirRegistrosReporte({
    registros: registros ?? [],
    etapasCatalogo: etapasCatalogo ?? [],
    loteEtapas: loteEtapas ?? [],
    items: items ?? [],
    lotes: lotes ?? [],
    modelos: modelos ?? [],
    tallas: tallas ?? [],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-muted-foreground">Ventas y productividad de tu operación.</p>
      </div>
      <NavReportes />

      <div>
        <h2 className="text-lg font-semibold">Productividad por colaborador</h2>
        <p className="text-muted-foreground">Piezas netas registradas por colaborador y etapa (incluye ajustes). Filtra por fecha.</p>
      </div>

      <ReporteProductividadTable registros={registrosDetallados} />
    </div>
  );
}
