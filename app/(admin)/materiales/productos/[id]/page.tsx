import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FormMovimientoStock } from "@/components/materiales/FormMovimientoStock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductoStockDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: stock } = await supabase
    .from("stock_productos")
    .select("*, modelos(nombre), tallas(codigo)")
    .eq("id", id)
    .single();

  if (!stock) notFound();

  const { data: movimientos } = await supabase
    .from("movimientos_stock_producto")
    .select("*, lotes_produccion(folio)")
    .eq("modelo_id", stock.modelo_id)
    .eq("talla_id", stock.talla_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {stock.modelos?.nombre} · Talla {stock.tallas?.codigo}
          </h1>
        </div>
        <p className="text-2xl font-semibold">{stock.cantidad_actual} pzas</p>
      </div>

      <FormMovimientoStock modeloId={stock.modelo_id} tallaId={stock.talla_id} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial de movimientos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Orden de producción</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString("es-MX")}
                </TableCell>
                <TableCell className="capitalize">{m.tipo}</TableCell>
                <TableCell className={m.tipo === "salida" ? "text-destructive" : ""}>
                  {m.tipo === "salida" ? "-" : ""}
                  {m.cantidad}
                </TableCell>
                <TableCell>
                  {m.orden_produccion_id ? (
                    <Link href={`/produccion/${m.orden_produccion_id}`} className="hover:underline">
                      {m.lotes_produccion?.folio}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.motivo ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!movimientos?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Sin movimientos todavía.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
