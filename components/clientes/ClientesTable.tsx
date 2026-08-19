"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DetalleClienteSheet, type DetalleCliente } from "@/components/detalle/DetalleClienteSheet";
import { obtenerDetalleCliente } from "@/actions/detalle.actions";
import type { Database } from "@/types/database.types";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleCliente | null>(null);
  const [cargando, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.nombre_comercial, c.contacto_nombre, c.telefono, c.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [clientes, busqueda]);

  function abrirDetalle(id: string) {
    setAbierto(true);
    startTransition(async () => {
      setDetalle(await obtenerDetalleCliente(id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, contacto, teléfono o correo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre comercial</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Correo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((cliente) => (
            <TableRow
              key={cliente.id}
              className="cursor-pointer"
              onClick={() => abrirDetalle(cliente.id)}
            >
              <TableCell className="font-medium">{cliente.nombre_comercial}</TableCell>
              <TableCell className="text-muted-foreground">{cliente.contacto_nombre ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{cliente.telefono ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{cliente.email ?? "—"}</TableCell>
            </TableRow>
          ))}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {clientes.length ? "Sin resultados." : "Sin clientes todavía."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DetalleClienteSheet open={abierto} onOpenChange={setAbierto} detalle={detalle} cargando={cargando} />
    </div>
  );
}
