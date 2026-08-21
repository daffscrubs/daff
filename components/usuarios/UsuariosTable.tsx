"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import { eliminarUsuario, obtenerUsuarioParaEditar } from "@/actions/usuarios.actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { BotonEliminarConfirmacion } from "@/components/forms/BotonEliminarConfirmacion";
import { FuncionesColaboradorDialog } from "@/components/forms/FuncionesColaboradorDialog";
import { EditarUsuarioDialog, type UsuarioParaEditar } from "@/components/usuarios/EditarUsuarioDialog";
import type { Database } from "@/types/database.types";

type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
type EtapaProceso = Database["public"]["Tables"]["etapas_proceso"]["Row"];
type Asignacion = Database["public"]["Tables"]["colaborador_etapas"]["Row"];

export function UsuariosTable({
  perfiles,
  etapasCatalogo,
  asignaciones,
}: {
  perfiles: Perfil[];
  etapasCatalogo: EtapaProceso[];
  asignaciones: Asignacion[];
}) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [detalle, setDetalle] = useState<UsuarioParaEditar | null>(null);
  const [cargando, startTransitionDetalle] = useTransition();

  const nombreEtapa = (id: string) => etapasCatalogo.find((e) => e.id === id)?.nombre ?? "—";
  const etapasDe = (perfilId: string) =>
    asignaciones.filter((a) => a.perfil_id === perfilId).map((a) => a.etapa_id);

  function abrirDetalle(id: string) {
    setDetalleAbierto(true);
    startTransitionDetalle(async () => {
      try {
        setDetalle(await obtenerUsuarioParaEditar(id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar el usuario");
        setDetalleAbierto(false);
      }
    });
  }

  return (
    <>
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
          {perfiles.map((perfil) => {
            const etapasAsignadas = etapasDe(perfil.id);
            return (
              <TableRow key={perfil.id} className="cursor-pointer" onClick={() => abrirDetalle(perfil.id)}>
                <TableCell>{perfil.nombre_completo}</TableCell>
                <TableCell className="capitalize">{perfil.rol}</TableCell>
                <TableCell>{perfil.usuario_corto ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
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
                        etapasCatalogo={etapasCatalogo}
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
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <BotonEliminarConfirmacion
                    entidad="usuario"
                    onEliminar={() => eliminarUsuario(perfil.id)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {!perfiles.length && (
            <TableRow>
              <TableCell colSpan={6}>
                <EstadoVacio icon={UserCog} titulo="Sin usuarios todavía" descripcion="El personal que agregues va a aparecer aquí." />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EditarUsuarioDialog
        open={detalleAbierto}
        onOpenChange={setDetalleAbierto}
        detalle={detalle}
        cargando={cargando}
      />
    </>
  );
}
