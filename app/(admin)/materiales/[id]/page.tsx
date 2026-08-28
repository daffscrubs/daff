import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormMovimiento } from "@/components/materiales/FormMovimiento";
import { UnidadesDeMaterial } from "@/components/materiales/UnidadesDeMaterial";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MaterialDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: material }, { data: movimientos }, { data: unidades }] = await Promise.all([
    supabase.from("materiales").select("*").eq("id", id).single(),
    supabase
      .from("movimientos_inventario")
      .select("*")
      .eq("material_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("unidades_material").select("*").eq("material_id", id).order("numero_unidad"),
  ]);

  if (!material) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{material.nombre}</h1>
          <p className="text-muted-foreground">{material.categoria ?? "Sin categoría"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">
            {material.stock_actual} {material.unidad_medida}
          </p>
          {material.stock_actual <= material.stock_minimo && (
            <Badge variant="destructive">Stock bajo (mínimo {material.stock_minimo})</Badge>
          )}
        </div>
      </div>

      {material.seguimiento_por_unidad && (
        <UnidadesDeMaterial
          materialId={id}
          costoUnitarioMaterial={material.costo_unitario}
          mideCantidadPorUnidad={material.mide_cantidad_por_unidad}
          unidades={unidades ?? []}
          unidadMedida={material.unidad_medida}
        />
      )}

      <FormMovimiento materialId={id} />

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial de movimientos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
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
                  {m.cantidad} {material.unidad_medida}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.motivo ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!movimientos?.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
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
