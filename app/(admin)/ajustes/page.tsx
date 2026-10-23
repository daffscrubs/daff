import { createClient } from "@/lib/supabase/server";
import { requerirPerfil } from "@/lib/supabase/auth-helpers";
import { PermisosUsuarios } from "@/components/ajustes/PermisosUsuarios";

export default async function AjustesPage() {
  await requerirPerfil(["admin"]);
  const supabase = await createClient();
  // Los colaboradores solo usan "Mi día" desde el celular: no tienen pantallas del panel que permitir.
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rol, activo, permisos")
    .neq("rol", "colaborador")
    .order("nombre_completo");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-muted-foreground">Elige un usuario y decide a qué pantallas y acciones tiene acceso.</p>
      </div>
      <PermisosUsuarios perfiles={perfiles ?? []} />
    </div>
  );
}
