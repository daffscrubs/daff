import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { NuevoMaterialDialog } from "@/components/materiales/NuevoMaterialDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MaterialesPage() {
  const supabase = await createClient();
  const { data: materiales } = await supabase.from("materiales").select("*").order("nombre");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materiales</h1>
          <p className="text-muted-foreground">Telas, hilos y accesorios, con su stock actual.</p>
        </div>
        <NuevoMaterialDialog />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Stock actual</TableHead>
            <TableHead>Stock mínimo</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {materiales?.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <Link href={`/materiales/${m.id}`} className="font-medium hover:underline">
                  {m.nombre}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{m.categoria ?? "—"}</TableCell>
              <TableCell>{m.stock_actual} {m.unidad_medida}</TableCell>
              <TableCell className="text-muted-foreground">{m.stock_minimo} {m.unidad_medida}</TableCell>
              <TableCell>
                {m.stock_actual <= m.stock_minimo && <Badge variant="destructive">Stock bajo</Badge>}
              </TableCell>
            </TableRow>
          ))}
          {!materiales?.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Sin materiales todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
