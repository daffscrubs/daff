import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { generarPlantillaInventario } from "@/lib/excel/inventarioPlantilla";

export async function GET() {
  await requerirPerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { data: tallas } = await supabase.from("tallas").select("codigo").order("orden");

  const buffer = await generarPlantillaInventario(tallas ?? []);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-inventario.xlsx"',
    },
  });
}
