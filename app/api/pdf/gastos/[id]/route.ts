import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { GastoDocumento } from "@/lib/pdf/GastoDocumento";

const ETIQUETA_CATEGORIA: Record<string, string> = {
  renta: "Renta",
  servicios: "Servicios",
  nomina: "Nómina",
  transporte: "Transporte",
  mantenimiento: "Mantenimiento",
  otro: "Otro",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await requerirPerfil(["admin", "ventas", "supervisor"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: gasto } = await supabase.from("gastos").select("*").eq("id", id).single();
  if (!gasto) return new Response("No encontrado", { status: 404 });

  const { data: registrador } = gasto.registrado_por
    ? await supabase.from("perfiles").select("nombre_completo").eq("id", gasto.registrado_por).single()
    : { data: null };

  const buffer = await renderToBuffer(
    GastoDocumento({
      folio: `GASTO-${gasto.id.slice(0, 8).toUpperCase()}`,
      fecha: gasto.fecha,
      categoria: ETIQUETA_CATEGORIA[gasto.categoria] ?? gasto.categoria,
      concepto: gasto.concepto,
      monto: gasto.monto,
      notas: gasto.notas,
      registradoPor: registrador?.nombre_completo ?? perfil.nombre_completo,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="gasto-${gasto.fecha}.pdf"`,
    },
  });
}
