"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_PEDIDO } from "@/lib/estatus-colores";
import { formatearMoneda } from "@/lib/dinero";
import { fechaISOLocal, sumarDias } from "@/lib/fechas";
import type { Database, EstatusPedido } from "@/types/database.types";

type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];

const OPCIONES_ESTATUS = [
  { value: "todos", label: "Todos los estatus" },
  ...Object.entries(ESTATUS_PEDIDO_LABEL).map(([value, label]) => ({ value, label })),
];

export function PedidosTable({
  pedidos,
  clientes,
  totales,
  pagados,
}: {
  pedidos: Pedido[];
  clientes: { id: string; nombre_comercial: string }[];
  totales: Record<string, number>;
  pagados: Record<string, number>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estatus, setEstatus] = useState("todos");

  const nombreCliente = (id: string) => clientes.find((c) => c.id === id)?.nombre_comercial ?? "—";

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (estatus !== "todos" && p.estatus !== estatus) return false;
      if (!q) return true;
      return [p.folio, nombreCliente(p.cliente_id)].some((v) => v.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, busqueda, estatus, clientes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio o cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select items={OPCIONES_ESTATUS} value={estatus} onValueChange={(v) => setEstatus(v ?? "todos")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ESTATUS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Compromiso</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((pedido) => {
            const total = totales[pedido.id] ?? 0;
            const pagado = pagados[pedido.id] ?? 0;
            const saldo = Math.max(total - pagado, 0);
            const fechaLimite = pedido.dias_credito > 0 ? sumarDias(pedido.fecha_pedido, pedido.dias_credito) : null;
            const vencido = !!fechaLimite && saldo > 0 && fechaLimite < fechaISOLocal(new Date());
            return (
              <TableRow key={pedido.id}>
                <TableCell>
                  <Link href={`/pedidos/${pedido.id}`} className="font-medium hover:underline">
                    {pedido.folio}
                  </Link>
                </TableCell>
                <TableCell>{nombreCliente(pedido.cliente_id)}</TableCell>
                <TableCell className="text-muted-foreground">{pedido.fecha_compromiso}</TableCell>
                <TableCell>{total ? formatearMoneda(total) : "—"}</TableCell>
                <TableCell>
                  {total ? (
                    <span className="flex items-center gap-1.5">
                      <span className={saldo > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {formatearMoneda(saldo)}
                      </span>
                      {vencido && <Badge variant="destructive">Vencido</Badge>}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={CLASE_ESTATUS_PEDIDO[pedido.estatus as EstatusPedido]}>
                    {ESTATUS_PEDIDO_LABEL[pedido.estatus as EstatusPedido]}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {!filtrados.length && (
            <TableRow>
              <TableCell colSpan={6}>
                <EstadoVacio
                  icon={ClipboardList}
                  titulo={pedidos.length ? "Sin resultados" : "Sin pedidos todavía"}
                  descripcion={pedidos.length ? "Prueba con otra búsqueda o filtro." : "Los pedidos que crees van a aparecer aquí."}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
