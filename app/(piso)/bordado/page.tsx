import { createClient } from "@/lib/supabase/server";
import { EscanearPrendaDialog } from "@/components/bordados/EscanearPrendaDialog";
import { PrendasBordadoPisoLista } from "@/components/bordados/PrendasBordadoPisoLista";

// Cualquiera de los 4 roles puede recoger/bordar/regresar una prenda desde
// aquí -- (piso) no restringe por rol (mismo layout que Mi día), a
// diferencia de /bordados en (admin) que sí exige admin/ventas/supervisor.
export default async function BordadoPage() {
  const supabase = await createClient();
  const { data: prendas } = await supabase
    .from("prendas_bordado")
    .select("*")
    .neq("estatus", "regresada_a_tienda")
    .order("fecha_entrega_compromiso");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Bordado</h1>
        <p className="text-sm text-muted-foreground">Escanea el ticket o márcalo aquí abajo.</p>
      </div>

      <EscanearPrendaDialog className="w-full" />

      <PrendasBordadoPisoLista prendas={prendas ?? []} />
    </div>
  );
}
