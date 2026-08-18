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

export default async function ProduccionPage() {
  const supabase = await createClient();
  const [{ data: lotes }, { data: modelos }] = await Promise.all([
    supabase.from("lotes_produccion").select("*").order("created_at", { ascending: false }),
    supabase.from("modelos").select("id, nombre"),
  ]);

  const nombreModelo = (id: string) => modelos?.find((m) => m.id === id)?.nombre ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="text-muted-foreground">Lotes de producción y su avance por etapa.</p>
        </div>
        <Button render={<Link href="/produccion/nuevo" />} nativeButton={false}>Nuevo lote</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Estatus</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes?.map((lote) => (
            <TableRow key={lote.id}>
              <TableCell>
                <Link href={`/produccion/${lote.id}`} className="font-medium hover:underline">
                  {lote.folio}
                </Link>
              </TableCell>
              <TableCell>{nombreModelo(lote.modelo_id)}</TableCell>
              <TableCell>{lote.cantidad_planeada}</TableCell>
              <TableCell>
                <Badge variant="secondary">{ESTATUS_ORDEN_LABEL[lote.estatus]}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {!lotes?.length && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Sin lotes todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
