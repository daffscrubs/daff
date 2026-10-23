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
import { EditarUsuarioDialog, type UsuarioParaEditar } from "@/components/usuarios/EditarUsuarioDialog";
import type { Database } from "@/types/database.types";

type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];

export function UsuariosTable({ perfiles }: { perfiles: Perfil[] }) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [detalle, setDetalle] = useState<UsuarioParaEditar | null>(null);
  const [cargando, startTransitionDetalle] = useTransition();

  function abrirDetalle(id: string) {
    setDetalleAbierto(true);
    startTransitionDetalle(async () => {
      const res = await obtenerUsuarioParaEditar(id);
      if (!res.ok) {
        toast.error(res.error);
        setDetalleAbierto(false);
        return;
      }
      setDetalle(res.data);
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
            <TableHead>Estatus</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {perfiles.map((perfil) => {
            return (
              <TableRow key={perfil.id} className="cursor-pointer" onClick={() => abrirDetalle(perfil.id)}>
                <TableCell>{perfil.nombre_completo}</TableCell>
                <TableCell className="capitalize">{perfil.rol}</TableCell>
                <TableCell>{perfil.usuario_corto ?? "—"}</TableCell>
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
              <TableCell colSpan={5}>
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
