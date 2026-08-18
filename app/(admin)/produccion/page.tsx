import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ESTATUS_ORDEN_LABEL } from "@/lib/labels";
import { CLASE_ESTATUS_ORDEN } from "@/lib/estatus-colores";

export default async function ProduccionPage() {
  const supabase = await createClient();
  const [{ data: lotes }, { data: items }, { data: modelos }, { data: tallas }] = await Promise.all([
    supabase.from("lotes_produccion").select("*").order("created_at", { ascending: false }),
    supabase.from("items_orden_produccion").select("*"),
    supabase.from("modelos").select("id, nombre"),
    supabase.from("tallas").select("id, codigo"),
  ]);

  const nombreModelo = (id: string) => modelos?.find((m) => m.id === id)?.nombre ?? "—";
  const codigoTalla = (id: string) => tallas?.find((t) => t.id === id)?.codigo ?? "—";

  const itemsDe = (loteId: string) => items?.filter((i) => i.lote_id === loteId) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="text-muted-foreground">Órdenes de producción y su avance por etapa.</p>
        </div>
        <Button render={<Link href="/produccion/nuevo" />} nativeButton={false}>Nueva orden de producción</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Cantidad total</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes?.map((lote) => {
            const itemsLote = itemsDe(lote.id);
            return (
              <TableRow key={lote.id}>
                <TableCell>
                  <Link href={`/produccion/${lote.id}`} className="font-medium hover:underline">
                    {lote.folio}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {itemsLote
                    .map((i) => `${nombreModelo(i.modelo_id)} ${codigoTalla(i.talla_id)} (${i.cantidad_planeada})`)
                    .join(", ") || "—"}
                </TableCell>
                <TableCell>{itemsLote.reduce((acc, i) => acc + i.cantidad_planeada, 0)}</TableCell>
                <TableCell>
                  <Badge className={CLASE_ESTATUS_ORDEN[lote.estatus]}>{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {!lotes?.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin órdenes de producción todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
