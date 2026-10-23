import { createClient } from "@/lib/supabase/server";
import { requerirPermiso } from "@/lib/supabase/auth-helpers";
import { hoyMexico } from "@/lib/fechas";
import { leerRango, presetsReporte } from "@/lib/reportes/ventas";
import { NavReportes } from "@/components/reportes/NavReportes";
import { ReporteVentas } from "@/components/reportes/ReporteVentas";

export default async function ReporteVentasPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; agrupar?: string }> }) {
  await requerirPermiso("modulo.reportes");
  const params = await searchParams;
  const supabase = await createClient();
  const hoy = hoyMexico();

  const { data: rango } = await supabase.rpc("fn_rango_ventas");
  const primera = rango?.[0]?.primera ?? null;
  const { desde, hasta, agrupar } = leerRango(params, hoy, primera);

  const [{ data: periodos, error }, { data: clientes }, { data: cajeros }] = await Promise.all([
    supabase.rpc("fn_reporte_ventas", { p_desde: desde, p_hasta: hasta, p_agrupar: agrupar }),
    supabase.rpc("fn_reporte_ventas_por", { p_desde: desde, p_hasta: hasta, p_dimension: "cliente", p_limite: 15 }),
    supabase.rpc("fn_reporte_ventas_por", { p_desde: desde, p_hasta: hasta, p_dimension: "cajero", p_limite: 15 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-muted-foreground">Ventas y piezas entregadas por tu taller y tus maquileros.</p>
      </div>
      <NavReportes />
      <ReporteVentas
        desde={desde}
        hasta={hasta}
        agrupar={agrupar}
        presets={presetsReporte(hoy, primera)}
        periodos={(periodos ?? []).map((p) => ({
          periodo: p.periodo,
          ventas: Number(p.ventas),
          bruto: Number(p.bruto),
          descuentos: Number(p.descuentos),
          reembolsos: Number(p.reembolsos),
          neto: Number(p.neto),
          efectivo: Number(p.efectivo),
          tarjeta: Number(p.tarjeta),
          transferencia: Number(p.transferencia),
          porCobrar: Number(p.por_cobrar),
        }))}
        clientes={(clientes ?? []).map((c) => ({ clave: c.clave, ventas: Number(c.ventas), neto: Number(c.neto) }))}
        cajeros={(cajeros ?? []).map((c) => ({ clave: c.clave, ventas: Number(c.ventas), neto: Number(c.neto) }))}
        error={error?.message ?? null}
      />
    </div>
  );
}
