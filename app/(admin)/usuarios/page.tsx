import { createClient } from "@/lib/supabase/server";
import { NuevoUsuarioDialog } from "@/components/forms/NuevoUsuarioDialog";
import { UsuariosTable } from "@/components/usuarios/UsuariosTable";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const [{ data: perfiles }, { data: etapasCatalogo }, { data: asignaciones }] = await Promise.all([
    supabase.from("perfiles").select("*").order("nombre_completo"),
    supabase.from("etapas_proceso").select("*").eq("activo", true).order("nombre"),
    supabase.from("colaborador_etapas").select("*"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">Personal administrativo y colaboradores del taller.</p>
        </div>
        <NuevoUsuarioDialog />
      </div>

      <UsuariosTable
        perfiles={perfiles ?? []}
        etapasCatalogo={etapasCatalogo ?? []}
        asignaciones={asignaciones ?? []}
      />
    </div>
  );
}
