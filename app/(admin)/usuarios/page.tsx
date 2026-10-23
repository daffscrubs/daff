import { createClient } from "@/lib/supabase/server";
import { NuevoUsuarioDialog } from "@/components/forms/NuevoUsuarioDialog";
import { UsuariosTable } from "@/components/usuarios/UsuariosTable";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: perfiles } = await supabase.from("perfiles").select("*").order("nombre_completo");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">Personal administrativo y colaboradores del taller.</p>
        </div>
        <NuevoUsuarioDialog />
      </div>

      <UsuariosTable perfiles={perfiles ?? []} />
    </div>
  );
}
