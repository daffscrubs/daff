import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NuevoMovimientoStockDialog } from "@/components/materiales/NuevoMovimientoStockDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductosTerminadosPage() {
  const supabase = await createClient();

  const [{ data: stock }, { data: modelos }, { data: tallas }] = await Promise.all([
    supabase.from("stock_productos").select("*, modelos(nombre), tallas(codigo)"),
    supabase.from("modelos").select("*").eq("activo", true).order("nombre"),
    supabase.from("tallas").select("*").order("orden"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Productos terminados</h1>
          <p className="text-muted-foreground">Inventario de prendas ya producidas, listas en bodega.</p>
        </div>
        <NuevoMovimientoStockDialog modelos={modelos ?? []} tallas={tallas ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Modelo</TableHead>
            <TableHead>Talla</TableHead>
            <TableHead>Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stock?.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link href={`/materiales/productos/${s.id}`} className="font-medium hover:underline">
                  {s.modelos?.nombre ?? "—"}
                </Link>
              </TableCell>
              <TableCell>{s.tallas?.codigo ?? "—"}</TableCell>
              <TableCell>{s.cantidad_actual}</TableCell>
            </TableRow>
          ))}
          {!stock?.length && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Sin stock de productos todavía. Se genera automáticamente al completar una orden de producción, o puedes registrar uno manual.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
