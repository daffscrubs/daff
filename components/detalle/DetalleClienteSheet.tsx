"use client";

import Link from "next/link";
import { obtenerDetalleCliente } from "@/actions/detalle.actions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLASE_ESTATUS_PEDIDO } from "@/lib/estatus-colores";
import { ESTATUS_PEDIDO_LABEL } from "@/lib/labels";
import type { Database } from "@/types/database.types";

export type DetalleCliente = Awaited<ReturnType<typeof obtenerDetalleCliente>>;

export function DetalleClienteSheet({
  open,
  onOpenChange,
  detalle,
  cargando,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalle: DetalleCliente | null;
  cargando: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {cargando || !detalle ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{detalle.cliente?.nombre_comercial}</SheetTitle>
              <SheetDescription>{detalle.cliente?.razon_social || "Datos del cliente"}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Contacto</p>
                  <p>{detalle.cliente?.contacto_nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Teléfono</p>
                  <p>{detalle.cliente?.telefono ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Correo</p>
                  <p>{detalle.cliente?.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">RFC</p>
                  <p>{detalle.cliente?.rfc ?? "—"}</p>
                </div>
              </div>
              {detalle.cliente?.direccion && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Dirección</p>
                  <p>{detalle.cliente.direccion}</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-medium">Historial de pedidos ({detalle.pedidos.length})</p>
                <ul className="space-y-2">
                  {detalle.pedidos.map((p: Database["public"]["Tables"]["pedidos"]["Row"]) => (
                    <li key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <Link href={`/pedidos/${p.id}`} className="font-medium hover:underline">
                        {p.folio}
                      </Link>
                      <Badge className={CLASE_ESTATUS_PEDIDO[p.estatus]}>{ESTATUS_PEDIDO_LABEL[p.estatus]}</Badge>
                    </li>
                  ))}
                  {!detalle.pedidos.length && (
                    <p className="text-sm text-muted-foreground">Sin pedidos todavía.</p>
                  )}
                </ul>
              </div>

              {detalle.cliente && (
                <Button
                  variant="outline"
                  className="w-full"
                  render={<Link href={`/clientes/${detalle.cliente.id}`} />}
                  nativeButton={false}
                >
                  Editar cliente
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
