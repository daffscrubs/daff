import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NuevoUsuarioDialog } from "@/components/forms/NuevoUsuarioDialog";
import { BotonToggleActivo } from "@/components/forms/BotonToggleActivo";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("*")
    .order("nombre_completo");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">Personal administrativo y colaboradores del taller.</p>
        </div>
        <NuevoUsuarioDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {perfiles?.map((perfil) => (
            <TableRow key={perfil.id}>
              <TableCell>{perfil.nombre_completo}</TableCell>
              <TableCell className="capitalize">{perfil.rol}</TableCell>
              <TableCell>{perfil.usuario_corto ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={perfil.activo ? "default" : "secondary"}>
                  {perfil.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <BotonToggleActivo id={perfil.id} activo={perfil.activo} />
              </TableCell>
            </TableRow>
          ))}
          {!perfiles?.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin usuarios todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
