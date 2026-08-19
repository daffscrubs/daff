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
import { BotonEliminarActivo } from "@/components/forms/BotonEliminarActivo";
import { FuncionesColaboradorDialog } from "@/components/forms/FuncionesColaboradorDialog";
import { cambiarEstadoUsuario } from "@/actions/usuarios.actions";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const [{ data: perfiles }, { data: etapasCatalogo }, { data: asignaciones }] = await Promise.all([
    supabase.from("perfiles").select("*").order("nombre_completo"),
    supabase.from("etapas_proceso").select("*").eq("activo", true).order("nombre"),
    supabase.from("colaborador_etapas").select("*"),
  ]);

  const nombreEtapa = (id: string) => etapasCatalogo?.find((e) => e.id === id)?.nombre ?? "—";
  const etapasDe = (perfilId: string) =>
    (asignaciones ?? []).filter((a) => a.perfil_id === perfilId).map((a) => a.etapa_id);

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
            <TableHead>Procesos</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {perfiles?.map((perfil) => {
            const etapasAsignadas = etapasDe(perfil.id);
            return (
              <TableRow key={perfil.id}>
                <TableCell>{perfil.nombre_completo}</TableCell>
                <TableCell className="capitalize">{perfil.rol}</TableCell>
                <TableCell>{perfil.usuario_corto ?? "—"}</TableCell>
                <TableCell>
                  {perfil.rol === "colaborador" ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {etapasAsignadas.length ? (
                        etapasAsignadas.map((id) => (
                          <Badge key={id} variant="secondary">{nombreEtapa(id)}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Todos</span>
                      )}
                      <FuncionesColaboradorDialog
                        perfilId={perfil.id}
                        nombreColaborador={perfil.nombre_completo}
                        etapasCatalogo={etapasCatalogo ?? []}
                        etapasAsignadasIniciales={etapasAsignadas}
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={perfil.activo ? "default" : "secondary"}>
                    {perfil.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <BotonEliminarActivo
                    activo={perfil.activo}
                    entidad="usuario"
                    onCambiarEstado={cambiarEstadoUsuario.bind(null, perfil.id)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {!perfiles?.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Sin usuarios todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
